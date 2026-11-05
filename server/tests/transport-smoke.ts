import assert from 'node:assert/strict';
import { dispose, AudioSource, AudioStream, Room, RoomEvent } from '@livekit/rtc-node';
import { joinWithMicrophone, until } from './rtc-client.js';

const mode = process.env.SMOKE_MODE === 'live' ? 'live' : 'fixture';
const room = new Room();
const transcript: string[] = [];
let frames = 0;
let nonzeroSamples = 0;
let agentIdentity = '';
const tasks: Promise<void>[] = [];
room.registerTextStreamHandler('lk.transcription', async (reader) => { transcript.push(await reader.readAll()); });
room.on(RoomEvent.ParticipantConnected, (p) => { if (p.kind === 4) agentIdentity = p.identity; });
room.on(RoomEvent.TrackSubscribed, (track) => {
  const task = (async () => {
    const stream = new AudioStream(track);
    for await (const frame of stream) {
      frames++;
      nonzeroSamples += frame.data.filter((sample) => Math.abs(sample) > 10).length;
    }
  })();
  tasks.push(task.catch(() => {}));
});
let source: AudioSource | undefined;
try {
  ({ source } = await joinWithMicrophone(room, mode));
  await until(() => transcript.length > 0 && frames >= 10 && nonzeroSamples > 0,
    'Agent sends a greeting and audible audio over WebRTC');
  assert.ok(!transcript.some((text) => text.includes('credentials need updating')), 'Provider credentials need updating in server/.env.local');
  const firstCount = transcript.length;
  await room.localParticipant!.sendText(mode === 'fixture' ? 'Hello from the transport smoke test' : 'What is two plus two? Answer in one short sentence.', { topic: 'lk.chat' });
  await until(() => transcript.length > firstCount, 'Agent responds to text sent over lk.chat');
  if (mode === 'fixture') assert.ok(transcript.some((text) => text.includes('Hello from the transport smoke test')));
  else assert.ok(transcript.slice(firstCount).some((text) => /four|4/i.test(text)), 'Live model answers the ordinary-language question');
  console.log(JSON.stringify({ mode, transcripts: transcript.length, audioFrames: frames, nonzeroSamples, agentIdentity, result: 'PASS' }));
} finally {
  await room.disconnect();
  await source?.close();
  dispose();
  await Promise.all(tasks);
}
