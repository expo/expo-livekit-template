import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export const VOICES = ['marin', 'cedar', 'coral', 'ash'] as const;
export type Voice = (typeof VOICES)[number];
export const AGENT_NAME = 'expo-livekit-agent';
export const FIXTURE_AGENT_NAME = 'expo-livekit-fixture';
export const SESSION_LIMIT_MS = 10 * 60 * 1000;
export type SessionRequest = { voice: Voice; mode: 'live' | 'fixture' };

export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parseSessionRequest(value: unknown, allowFixture = false): SessionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Send a JSON object with a supported voice.');
  }
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !['voice', 'mode'].includes(key))) {
    throw new RequestError(400, 'Unsupported session option.');
  }
  const voice = data.voice ?? 'marin';
  const mode = data.mode ?? 'live';
  if (!VOICES.includes(voice as Voice)) throw new RequestError(400, 'Unsupported voice.');
  if (!['live', 'fixture'].includes(mode as string)) throw new RequestError(400, 'Unsupported session mode.');
  if (mode === 'fixture' && !allowFixture) throw new RequestError(403, 'Transport testing is disabled on this server.');
  return { voice: voice as Voice, mode: mode as SessionRequest['mode'] };
}

export function livekitConfig(env = process.env, mode: SessionRequest['mode'] = 'live') {
  const prefix = mode === 'fixture' && env.FIXTURE_LIVEKIT_URL ? 'FIXTURE_LIVEKIT_' : 'LIVEKIT_';
  const url = env[`${prefix}URL`];
  const key = env[`${prefix}API_KEY`];
  const secret = env[`${prefix}API_SECRET`];
  if (!url || !key || !secret) {
    throw new RequestError(503, `Set ${prefix}URL, ${prefix}API_KEY and ${prefix}API_SECRET in server/.env.local.`);
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new RequestError(503, 'The LiveKit server URL is invalid.'); }
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new RequestError(503, 'LIVEKIT_URL must begin with ws:// or wss://.');
  return { url, key, secret };
}
