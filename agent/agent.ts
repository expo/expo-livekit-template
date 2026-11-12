import { Agent, AgentSession, ServerOptions, cli, defineAgent, inference } from '@livekit/agents';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();

    const session = new AgentSession({
      // A speech-to-speech model from LiveKit Inference. It needs no extra API key.
      // Other models: https://docs.livekit.io/agents/models/
      llm: new inference.RealtimeModel({ model: 'openai/gpt-realtime-2.1', voice: 'marin' }),
    });

    await session.start({
      room: ctx.room,
      // Removes background voices and noise, so nearby talk does not reach the model as a user turn.
      inputOptions: { noiseCancellation: BackgroundVoiceCancellation() },
      agent: new Agent({
        instructions: 'You are a friendly voice assistant. Keep your replies brief and natural.',
      }),
    });

    session.generateReply({
      instructions: 'Greet the user briefly and ask what they would like to talk about.',
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'expo-livekit-agent', // Must match AGENT_NAME in src/app/token+api.ts.
    port: 8082, // The default port, 8081, belongs to Metro.
  }),
);
