import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { livekitConfig, parseSessionRequest, RequestError, VOICES } from './config.js';
import { createSessionToken } from './token.js';

const MAX_BODY_BYTES = 4096;
async function readBody(request: IncomingMessage) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new RequestError(415, 'Use application/json.');
  let bytes = 0;
  const parts: Buffer[] = [];
  for await (const part of request) {
    bytes += part.length;
    if (bytes > MAX_BODY_BYTES) throw new RequestError(413, 'Request body is too large.');
    parts.push(part);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw new RequestError(400, 'Invalid JSON.'); }
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

export function createApiServer(env = process.env) {
  const attempts = new Map<string, { count: number; reset: number }>();
  return createServer(async (request, response) => {
    const allowedOrigin = env.ALLOWED_ORIGIN;
    if (allowedOrigin && request.headers.origin === allowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
      response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    try {
      if (request.url === '/health' && request.method === 'GET') {
        let configured = true;
        try { livekitConfig(env); } catch { configured = false; }
        json(response, 200, { ok: true, configured, voices: VOICES, fixtureEnabled: env.LIVEKIT_ALLOW_FIXTURE === '1' });
        return;
      }
      if (request.url !== '/token') throw new RequestError(404, 'Not found.');
      if (request.method !== 'POST') throw new RequestError(405, 'Use POST.');
      if (env.TOKEN_API_KEY && request.headers.authorization !== `Bearer ${env.TOKEN_API_KEY}`) throw new RequestError(401, 'Invalid API authorization.');
      if (request.headers.origin && request.headers.origin !== allowedOrigin) throw new RequestError(403, 'Origin not allowed.');
      const address = request.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      for (const [key, attempt] of attempts) if (attempt.reset <= now) attempts.delete(key);
      const attempt = attempts.get(address) ?? { count: 0, reset: now + 60_000 };
      if (++attempt.count > 20) throw new RequestError(429, 'Too many session requests. Wait a minute and retry.');
      attempts.set(address, attempt);
      const input = parseSessionRequest(await readBody(request), env.LIVEKIT_ALLOW_FIXTURE === '1');
      if (input.mode === 'live' && env.LIVEKIT_MODEL_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
        throw new RequestError(503, 'Set OPENAI_API_KEY in server/.env.local to start a live conversation.');
      }
      json(response, 200, await createSessionToken(input, livekitConfig(env, input.mode)));
    } catch (error) {
      if (error instanceof RequestError) json(response, error.status, { error: error.message });
      else json(response, 500, { error: 'Could not create the session. Try again.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST ?? '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !process.env.TOKEN_API_KEY) {
    throw new Error('Set TOKEN_API_KEY before exposing the token endpoint beyond localhost.');
  }
  createApiServer().listen(Number(process.env.PORT ?? 3001), host, () => console.log(`Token API listening on http://${host}:${process.env.PORT ?? 3001}`));
}
