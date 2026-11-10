import { randomUUID } from 'node:crypto';
import { AccessToken, RoomAgentDispatch, RoomConfiguration, TrackSource } from 'livekit-server-sdk';
import { AGENT_NAME, FIXTURE_AGENT_NAME, type SessionRequest } from './config.js';

export async function createSessionToken(request: SessionRequest, config: { url: string; key: string; secret: string }) {
  const roomName = `expo-${randomUUID()}`;
  const token = new AccessToken(config.key, config.secret, {
    identity: `user-${randomUUID()}`,
    name: 'You',
    ttl: '10m',
  });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false });
  token.roomConfig = new RoomConfiguration({
    name: roomName,
    emptyTimeout: 30,
    departureTimeout: 10,
    maxParticipants: 2,
    agents: [new RoomAgentDispatch({
      agentName: request.mode === 'fixture' ? FIXTURE_AGENT_NAME : AGENT_NAME,
      metadata: JSON.stringify(request),
    })],
  });
  return { server_url: config.url, participant_token: await token.toJwt(), room_name: roomName, mode: request.mode };
}
