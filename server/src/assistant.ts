import { Agent } from '@livekit/agents';

export class Assistant extends Agent {
  constructor() {
    super({
      instructions: 'You are a friendly voice assistant. Keep replies brief and natural. Be honest about uncertainty and your lack of access to live data or external actions.',
    });
  }
}
