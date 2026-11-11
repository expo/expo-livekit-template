import { AccessToken, RoomAgentDispatch, RoomConfiguration } from 'livekit-server-sdk';

// Must match `agentName` in agent/agent.ts.
const AGENT_NAME = 'expo-livekit-agent';

/**
 * Issues a LiveKit token for a new room and dispatches the agent to that room.
 * This route runs on the server, so the API secret never reaches the app.
 * Authenticate your users here before you ship.
 */
export async function POST() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    return Response.json(
      { error: 'Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env.local.' },
      { status: 500 },
    );
  }

  const room = `room-${crypto.randomUUID()}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: `user-${crypto.randomUUID()}`,
    ttl: '10m',
  });
  token.addGrant({ room, roomJoin: true });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME })],
  });

  return Response.json(
    { server_url: url, participant_token: await token.toJwt() },
    { status: 201 },
  );
}
