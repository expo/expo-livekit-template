import assert from 'node:assert/strict';
import test from 'node:test';
import { createTools } from '../src/assistant.js';

test('exposes weather but does not advertise unavailable search', () => {
  const key = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.deepEqual(createTools().map((entry: any) => entry.name), ['get_weather']);
  } finally {
    if (key !== undefined) process.env.OPENAI_API_KEY = key;
  }
});

test('search provider failure returns a useful failure without credentials or raw provider details', async () => {
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only-secret';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'provider-internal-message', type: 'server_error' } }), { status: 503, headers: { 'content-type': 'application/json' } });
  try {
    const search = createTools().find((entry: any) => entry.name === 'search_web') as any;
    const result = await search.execute({ query: 'current news' }, { abortSignal: new AbortController().signal, toolCallId: 'test' });
    assert.equal(result.ok, false);
    assert.match(result.error, /Search is unavailable/);
    assert.doesNotMatch(JSON.stringify(result), /test-only-secret|provider-internal-message/);
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
