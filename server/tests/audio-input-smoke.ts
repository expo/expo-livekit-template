import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  Room,
  RoomEvent,
  dispose,
} from '@livekit/rtc-node';
import { joinWithMicrophone, until } from './rtc-client.js';

const QUESTION = 'What is five plus seven? Please answer with only the number.';
const RATE = 24_000;
const FRAME_SAMPLES = 480;
const room = new Room();
const transcripts: { text: string; identity: string; trackId: string }[] = [];
const tasks: Promise<void>[] = [];
const streamErrors: string[] = [];
let agentIdentity = '';
let agentState = '';
let receivedFrames = 0;
let receivedVoicedSamples = 0;
let source: AudioSource | undefined;
let temporaryDirectory: string | undefined;

function readPcmWav(buffer: Buffer): Int16Array {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
  let samples: Int16Array | undefined;
  let hasFormat = false;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const chunk = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert.ok(start + size <= buffer.length, 'WAV chunk is complete');
    if (chunk === 'fmt ') {
      assert.equal(buffer.readUInt16LE(start), 1, 'WAV uses integer PCM');
      assert.equal(buffer.readUInt16LE(start + 2), 1, 'WAV is mono');
      assert.equal(buffer.readUInt32LE(start + 4), RATE, 'WAV uses 24 kHz');
      assert.equal(buffer.readUInt16LE(start + 14), 16, 'WAV uses signed 16-bit samples');
      hasFormat = true;
    } else if (chunk === 'data') {
      assert.equal(size % 2, 0);
      samples = new Int16Array(size / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = buffer.readInt16LE(start + i * 2);
    }
    offset = start + size + (size % 2);
  }
  assert.ok(hasFormat && samples && samples.length > RATE, 'WAV contains spoken audio');
  return samples;
}

async function publish(samples: Int16Array) {
  for (let offset = 0; offset < samples.length; offset += FRAME_SAMPLES) {
    const frame = new Int16Array(FRAME_SAMPLES);
    frame.set(samples.subarray(offset, offset + FRAME_SAMPLES));
    await source!.captureFrame(new AudioFrame(frame, RATE, 1, FRAME_SAMPLES));
  }
}

room.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
  const text = await reader.readAll();
  transcripts.push({ text, identity: participant.identity, trackId: reader.info.attributes?.['lk.transcribed_track_id'] ?? '' });
});
room.registerByteStreamHandler('lk.agent.session', async (reader) => { await reader.readAll(); });
room.on(RoomEvent.ParticipantConnected, (participant) => {
  if (participant.kind === 4) {
    agentIdentity = participant.identity;
    agentState = participant.attributes['lk.agent.state'] ?? '';
  }
});
room.on(RoomEvent.ParticipantAttributesChanged, (_, participant) => {
  if (participant.kind === 4) {
    agentIdentity = participant.identity;
    agentState = participant.attributes['lk.agent.state'] ?? '';
  }
});
room.on(RoomEvent.TrackSubscribed, (track, _, participant) => {
  if (participant.kind !== 4) return;
  tasks.push((async () => {
    for await (const frame of new AudioStream(track)) {
      receivedFrames++;
      for (const sample of frame.data) if (Math.abs(sample) > 50) receivedVoicedSamples++;
    }
  })().catch((error) => { streamErrors.push(String(error)); }));
});

try {
  assert.equal(process.platform, 'darwin', 'The speech fixture uses macOS say and afconvert.');
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'expo-livekit-audio-'));
  const aiff = join(temporaryDirectory, 'question.aiff');
  const wav = join(temporaryDirectory, 'question.wav');
  execFileSync('/usr/bin/say', ['-v', 'Samantha', '-r', '155', '-o', aiff, QUESTION], { stdio: 'pipe' });
  execFileSync('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16@24000', '-c', '1', aiff, wav], { stdio: 'pipe' });
  const speech = readPcmWav(await readFile(wav));
  assert.ok(speech.some((sample) => Math.abs(sample) > 100), 'Speech fixture contains non-silent samples');

  const microphone = await joinWithMicrophone(room, 'live');
  source = microphone.source;
  const userIdentity = room.localParticipant!.identity;

  await until(() => transcripts.some((item) => item.identity === agentIdentity) && receivedVoicedSamples > 2000 && agentState === 'listening', 'Agent finishes a spoken greeting and listens');
  await publish(new Int16Array(RATE / 2));
  await source.waitForPlayout();
  const answerStartSamples = receivedVoicedSamples;
  const answerStartFrames = receivedFrames;
  const beforeQuestion = transcripts.length;
  await publish(speech);
  await publish(new Int16Array(RATE * 2));
  await source.waitForPlayout();

  const userTranscripts = () => transcripts.slice(beforeQuestion).filter((item) => item.identity === userIdentity || item.trackId === microphone.publication.sid);
  const replies = () => transcripts.slice(beforeQuestion).filter((item) => item.identity === agentIdentity);
  await until(() => userTranscripts().some((item) => /five|5/i.test(item.text) && /seven|7/i.test(item.text)), 'Speech recognition transcribes the actual microphone question');
  await until(() => replies().some((item) => /twelve|\b12\b/i.test(item.text)) && receivedVoicedSamples - answerStartSamples > 2000, 'Agent answers the spoken question correctly and publishes voiced audio');
  assert.equal(streamErrors.length, 0, 'No audio receive errors');
  console.log(JSON.stringify({
    result: 'PASS', mode: 'live-audio-input',
    spokenQuestion: QUESTION,
    speechDurationSeconds: Number((speech.length / RATE).toFixed(2)),
    userTranscript: userTranscripts().map((item) => item.text),
    agentReply: replies().map((item) => item.text),
    receivedAnswerAudioFrames: receivedFrames - answerStartFrames,
    receivedAnswerVoicedSamples: receivedVoicedSamples - answerStartSamples,
  }));
} finally {
  await room.disconnect();
  await source?.close();
  dispose();
  await Promise.all(tasks);
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
