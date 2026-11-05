import assert from 'node:assert/strict';
import test from 'node:test';
import { TokenVerifier } from 'livekit-server-sdk';
import { livekitConfig, parseSessionRequest, RequestError } from '../src/config.js';
import { createSessionToken } from '../src/token.js';
import { createApiServer } from '../src/api.js';

const config = { url: 'ws://localhost:7880', key: 'devkey', secret: 'secret' };
const env = { LIVEKIT_URL: config.url, LIVEKIT_API_KEY: config.key, LIVEKIT_API_SECRET: config.secret, LIVEKIT_ALLOW_FIXTURE: '1' };

test('validates voice and mode, defaults safely, and rejects client-selected rooms/agents', () => {
  assert.deepEqual(parseSessionRequest({}), { voice: 'marin', mode: 'live' });
  for (const data of [null, [], { voice: 'bogus' }, { mode: 'bogus' }, { room_name: 'another-user' }, { agent_name: 'admin' }]) {
    assert.throws(() => parseSessionRequest(data), RequestError);
  }
  assert.throws(() => parseSessionRequest({ mode: 'fixture' }), (e: any) => e.status === 403);
  assert.equal(parseSessionRequest({ voice: 'cedar', mode: 'fixture' }, true).mode, 'fixture');
});

test('requires server credentials and WebSocket URLs', () => {
  assert.throws(() => livekitConfig({}), /Set LIVEKIT/);
  assert.throws(() => livekitConfig({ ...env, LIVEKIT_URL: 'https://example.com' }), /ws:\/\//);
});

test('signs a single-room microphone-only token with bounded lifetime and explicit dispatch', async () => {
  const result = await createSessionToken({ voice: 'cedar', mode: 'live' }, config);
  const claims = await new TokenVerifier(config.key, config.secret).verify(result.participant_token);
  assert.equal(result.server_url, config.url);
  assert.equal(claims.video?.room, result.room_name);
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.roomAdmin, undefined);
  assert.equal(claims.video?.roomCreate, undefined);
  assert.deepEqual(claims.video?.canPublishSources, ['microphone']);
  assert.equal(claims.video?.canUpdateOwnMetadata, false);
  assert.equal(claims.roomConfig?.agents[0]?.agentName, 'expo-livekit-agent');
  assert.deepEqual(JSON.parse(claims.roomConfig!.agents[0]!.metadata), { voice: 'cedar', mode: 'live' });
  assert.ok(claims.exp! - claims.nbf! <= 600);
  const next = await createSessionToken({ voice: 'marin', mode: 'fixture' }, config);
  assert.notEqual(next.room_name, result.room_name);
  const fixture = await new TokenVerifier(config.key, config.secret).verify(next.participant_token);
  assert.equal(fixture.roomConfig?.agents[0]?.agentName, 'expo-livekit-fixture');
});

test('HTTP endpoint supports creation, rejects malformed/oversized requests and returns no secrets', async (t) => {
  const server = createApiServer({ ...env, FIXTURE_LIVEKIT_URL: 'ws://127.0.0.1:7880', FIXTURE_LIVEKIT_API_KEY: 'fixture-key', FIXTURE_LIVEKIT_API_SECRET: 'fixture-secret' });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  const post = (body: string, headers: Record<string, string> = {}) => fetch(`${url}/token`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  const healthy = await fetch(`${url}/health`);
  assert.equal((await healthy.json()).configured, true);
  const good = await post(JSON.stringify({ voice: 'marin' }));
  assert.equal(good.status, 200);
  assert.equal(good.headers.get('cache-control'), 'no-store');
  assert.ok((await good.json()).participant_token);
  const fixture = await post(JSON.stringify({ mode: 'fixture' }));
  assert.equal(fixture.status, 200);
  const fixtureBody = await fixture.json();
  assert.equal(fixtureBody.server_url, 'ws://127.0.0.1:7880');
  await new TokenVerifier('fixture-key', 'fixture-secret').verify(fixtureBody.participant_token);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(JSON.stringify({ voice: 'not-real' }))).status, 400);
  assert.equal((await post(JSON.stringify({ voice: 'x'.repeat(5000) }))).status, 413);
  assert.equal((await post('{}', { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await fetch(`${url}/token`)).status, 405);
});

test('HTTP auth and configuration failures are explicit and retryable', async (t) => {
  const server = createApiServer({ TOKEN_API_KEY: 'test-only-key' });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/token`;
  const request = { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } };
  assert.equal((await fetch(url, request)).status, 401);
  const response = await fetch(url, { ...request, headers: { ...request.headers, authorization: 'Bearer test-only-key' } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /LIVEKIT_URL/);
});
