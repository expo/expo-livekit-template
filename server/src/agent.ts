import { APIError, AgentSession, AgentSessionEventTypes, ServerOptions, cli, defineAgent, inference } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { fileURLToPath } from 'node:url';
import { AGENT_NAME, FIXTURE_AGENT_NAME, SESSION_LIMIT_MS, livekitConfig, parseSessionRequest } from './config.js';
import { Assistant } from './assistant.js';
import { runTransportFixture } from './fixture.js';

const isFixtureWorker = process.env.LIVEKIT_FIXTURE === '1';
if (isFixtureWorker && process.env.FIXTURE_LIVEKIT_URL) {
  const { url, key, secret } = livekitConfig(process.env, 'fixture');
  Object.assign(process.env, { LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret });
}

export default defineAgent({
  entry: async (ctx) => {
    const request = parseSessionRequest(JSON.parse(ctx.job.metadata || '{}'), isFixtureWorker);
    if (request.mode === 'fixture') { await runTransportFixture(ctx); return; }
    if (isFixtureWorker) throw new Error('The fixture worker cannot handle a live session.');
    await ctx.connect();
    const audio = { voice: request.voice, inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' } };
    const session = new AgentSession({
      turnHandling: { turnDetection: 'realtime_llm' },
      llm: process.env.LIVEKIT_MODEL_PROVIDER === 'openai'
        ? new openai.realtime.RealtimeModel({ model: process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime-2.1', ...audio })
        : new inference.RealtimeModel({ model: 'openai/gpt-realtime-2.1', ...audio }),
    });
    const deadline = setTimeout(() => { session.shutdown({ reason: 'Ten minute session limit reached' }); ctx.shutdown('session time limit'); }, SESSION_LIMIT_MS);
    ctx.addShutdownCallback(async () => { clearTimeout(deadline); await session.close(); });
    session.on(AgentSessionEventTypes.Close, () => { clearTimeout(deadline); ctx.shutdown('agent session closed'); });
    let failed = false;
    session.on(AgentSessionEventTypes.Error, (event) => {
      const error = 'error' in event.error ? event.error.error : undefined;
      const body = error instanceof APIError && typeof error.body === 'object' && error.body !== null ? error.body as Record<string, unknown> : {};
      const credentialFailure = ['expired_secret_key', 'invalid_api_key', 'insufficient_quota', 'account_deactivated', 'billing_hard_limit_reached'].includes(String(body.code));
      if (failed || (event.error.recoverable && !credentialFailure)) return;
      failed = true;
      const message = credentialFailure
        ? 'The voice provider credentials need updating. Update server/.env.local, then try again.'
        : 'The voice provider is unavailable. End this call and try again.';
      const notify = ctx.room.localParticipant?.sendText(message, {
        topic: 'lk.transcription',
        attributes: { 'lk.transcription_final': 'true' },
      });
      void Promise.resolve(notify).catch(() => {}).then(() => {
        session.shutdown({ reason: 'voice provider unavailable' });
        ctx.shutdown('voice provider unavailable');
      });
    });
    await session.start({
      room: ctx.room,
      record: false,
      agent: new Assistant(),
    });
    session.generateReply({ instructions: 'Greet the user briefly and ask what they would like to talk about.' });
  },
});

cli.runApp(new ServerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: isFixtureWorker ? FIXTURE_AGENT_NAME : AGENT_NAME,
  port: Number(process.env.AGENT_PORT ?? (isFixtureWorker ? 8083 : 8082)),
  numIdleProcesses: 1,
}));
