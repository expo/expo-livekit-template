import type { JobContext } from '@livekit/agents';
import { AudioFrame, AudioSource, LocalAudioTrack, RoomEvent, TrackPublishOptions, TrackSource } from '@livekit/rtc-node';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { SESSION_LIMIT_MS } from './config.js';

export async function runTransportFixture(ctx: JobContext) {
  await ctx.connect();
  const participant = await ctx.waitForParticipant();
  const local = ctx.room.localParticipant!;
  const source = new AudioSource(24_000, 1);
  const track = LocalAudioTrack.createAudioTrack('Transport test tone', source);
  const options = new TrackPublishOptions();
  options.source = TrackSource.SOURCE_MICROPHONE;
  await local.publishTrack(track, options);
  await local.setAttributes({ 'lk.agent.state': 'listening', 'expo.mode': 'fixture' });
  let closed = false;
  let chain = Promise.resolve();
  const deadline = setTimeout(() => ctx.shutdown('session time limit'), SESSION_LIMIT_MS);
  const reply = (text: string) => {
    chain = chain.then(async () => {
      if (closed) return;
      await local.setAttributes({ 'lk.agent.state': 'thinking' });
      await delay(350);
      if (closed) return;
      await local.setAttributes({ 'lk.agent.state': 'speaking' });
      await local.sendText(text, { topic: 'lk.transcription', attributes: { 'lk.transcription_final': 'true', 'lk.segment_id': randomUUID(), 'lk.transcribed_track_id': track.sid ?? '' } });
      for (let n = 0; n < 75 && !closed; n++) {
        const samples = new Int16Array(480);
        for (let i = 0; i < samples.length; i++) {
          const t = (n * 480 + i) / 24_000;
          samples[i] = Math.sin(2 * Math.PI * 440 * t) * Math.sin(Math.PI * n / 75) * 2200;
        }
        await source.captureFrame(new AudioFrame(samples, 24_000, 1, 480));
      }
      await source.waitForPlayout();
      if (!closed) await local.setAttributes({ 'lk.agent.state': 'listening' });
    }).catch(() => { if (!closed) ctx.shutdown('transport fixture failure'); });
  };
  ctx.room.registerTextStreamHandler('lk.chat', async (reader, info) => {
    if (info.identity !== participant.identity) return;
    const text = await reader.readAll();
    reply(`Transport test received: ${text.slice(0, 240)}. This is a scripted connection check, not an AI response.`);
  });
  ctx.room.on(RoomEvent.ParticipantDisconnected, (remote) => { if (remote.identity === participant.identity) ctx.shutdown('participant disconnected'); });
  ctx.addShutdownCallback(async () => {
    closed = true;
    clearTimeout(deadline);
    ctx.room.unregisterTextStreamHandler('lk.chat');
    source.clearQueue();
    await chain;
    await track.close();
    await source.close();
  });
  reply('Transport test connected. You are hearing a test tone from the LiveKit backend.');
}
