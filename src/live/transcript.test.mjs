import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { it } from 'node:test';
import { ConnectionState, DataStreamError, DataStreamErrorReason, RoomEvent } from 'livekit-client';
import { listenToTranscript } from './transcript.ts';

function createRoom() {
  const handlers = new Map();
  const streams = new Set();
  const room = Object.assign(new EventEmitter(), {
    state: ConnectionState.Connected,
    localParticipant: { identity: 'caller' },
    registerTextStreamHandler(topic, handler) {
      if (handlers.has(topic)) throw new Error('Handler already registered');
      handlers.set(topic, handler);
    },
    unregisterTextStreamHandler(topic) { handlers.delete(topic); },
  });
  function open(id, { topic = 'lk.transcription', sender = 'agent', segment = id } = {}) {
    let controller;
    let closed = false;
    const stream = new ReadableStream({
      start(value) { controller = value; },
      cancel() { closed = true; },
    });
    const reader = {
      info: { id, topic, attributes: { 'lk.segment_id': segment } },
      withAbortSignal(signal) { return stream.pipeThrough(new TransformStream(), { signal }); },
    };
    void handlers.get(topic)?.(reader, { identity: sender });
    const incoming = {
      stream,
      async write(text) {
        if (!closed) controller.enqueue(text);
        await setImmediate();
      },
      async end() {
        if (!closed) controller.close();
        closed = true;
        await setImmediate();
      },
      fail(error) {
        if (!closed) controller.error(error);
        closed = true;
      },
    };
    streams.add(incoming);
    return incoming;
  }
  function disconnect() {
    for (const stream of streams) stream.fail(new DataStreamError('Room disconnected', DataStreamErrorReason.AbnormalEnd));
    room.state = ConnectionState.Disconnected;
    room.emit(RoomEvent.Disconnected);
  }
  return { room, handlers, open, disconnect };
}

it('streams speech and chat in arrival order, replacing revised speech segments', async () => {
  const { room, open } = createRoom();
  let entries;
  const stop = listenToTranscript(room, (value) => { entries = value; });
  const original = open('partial', { segment: 'first', sender: 'caller' });
  await original.write('Good');
  const originalId = entries[0].id;
  const revision = open('revision', { segment: 'first', sender: 'caller' });
  await revision.write('Good morning');
  await original.write('bye');
  await revision.end();
  const reply = open('reply', { segment: 'first' });
  await reply.write('Hello');
  await reply.write('!');
  await reply.end();
  const chat = open('first', { topic: 'lk.chat' });
  await chat.write('Fixture message');
  await chat.end();
  assert.equal(entries[0].id, originalId);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, 3);
  assert.deepEqual(entries.map(({ role, text }) => [role, text]), [
    ['user', 'Good morning'], ['assistant', 'Hello!'], ['assistant', 'Fixture message'],
  ]);
  stop();
});

it('keeps partial text on End and starts a fresh transcript in the same room', async () => {
  const { room, open, disconnect } = createRoom();
  let entries;
  const update = (value) => { entries = value; };
  const stop = listenToTranscript(room, update);
  const interrupted = open('old');
  await interrupted.write('Partial');
  const snapshot = entries;
  stop();
  disconnect();
  room.state = ConnectionState.Connected;
  const endNext = listenToTranscript(room, update);
  stop();
  await open('new').write('Fresh');
  assert.deepEqual(entries.map(({ text }) => text), ['Fresh']);
  assert.equal(snapshot[0].text, 'Partial');
  endNext();
});

it('releases pending reads when the room disconnects during a transcript', async (t) => {
  const { room, open, disconnect } = createRoom();
  let entries;
  listenToTranscript(room, (value) => { entries = value; });
  const warning = t.mock.method(console, 'warn', () => {});
  const incoming = open('old');
  await incoming.write('Partial');
  assert.equal(incoming.stream.locked, true);
  disconnect();
  await setImmediate();
  assert.equal(incoming.stream.locked, false);
  assert.equal(entries[0].text, 'Partial');
  assert.equal(warning.mock.callCount(), 0);
});

it('reports a broken active stream and can receive the next one', async (t) => {
  const { room, open } = createRoom();
  let entries;
  const warning = t.mock.method(console, 'warn', () => {});
  const stop = listenToTranscript(room, (value) => { entries = value; });
  const broken = open('broken');
  await broken.write('Short');
  broken.fail(new DataStreamError('Incomplete stream', DataStreamErrorReason.Incomplete));
  await setImmediate();
  assert.equal(warning.mock.calls[0].arguments[1].reasonName, 'Incomplete');
  await open('next').write('Next');
  assert.deepEqual(entries.map(({ text }) => text), ['Short', 'Next']);
  stop();
});

it('releases only its own handlers if another consumer already owns chat', () => {
  const { room, handlers } = createRoom();
  const chat = () => {};
  room.registerTextStreamHandler('lk.chat', chat);
  assert.throws(() => listenToTranscript(room, () => {}));
  assert.equal(handlers.has('lk.transcription'), false);
  assert.equal(handlers.get('lk.chat'), chat);
});
