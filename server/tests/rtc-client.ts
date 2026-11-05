import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { AudioSource, LocalAudioTrack, Room, TrackPublishOptions, TrackSource } from '@livekit/rtc-node';
import { VOICES, type SessionRequest } from '../src/config.js';

export async function joinWithMicrophone(room: Room, mode: SessionRequest['mode']) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.TOKEN_API_KEY) headers.Authorization = `Bearer ${process.env.TOKEN_API_KEY}`;
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3001}/token`, {
    method: 'POST', headers, body: JSON.stringify({ voice: VOICES[0], mode }),
  });
  assert.equal(response.status, 200, 'Token endpoint issues a session');
  const { server_url, participant_token } = await response.json();
  await room.connect(server_url, participant_token, { autoSubscribe: true, dynacast: false });
  const source = new AudioSource(24_000, 1);
  try {
    const track = LocalAudioTrack.createAudioTrack('Test microphone', source);
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    const publication = await room.localParticipant!.publishTrack(track, options);
    return { source, publication };
  } catch (error) {
    await source.close();
    throw error;
  }
}

export async function until(condition: () => boolean, message: string) {
  const deadline = Date.now() + 45_000;
  while (!condition() && Date.now() < deadline) await delay(100);
  assert.ok(condition(), message);
}
