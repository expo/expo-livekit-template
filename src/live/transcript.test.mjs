import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { it } from 'node:test';
import { ConnectionState, Room, RoomEvent } from 'livekit-client';
import { DataStream_Chunk, DataStream_Header, DataStream_TextHeader, DataStream_Trailer } from '@livekit/protocol';
import { listenToTranscript } from './transcript.ts';

function createRoom() {
  const room = new Room();
  room.state = ConnectionState.Connected;
  room.localParticipant.identity = 'caller';
  const manager = room.incomingDataStreamManager;
  manager.setConnected(true);
  function open(id, { topic = 'lk.transcription', sender = 'agent', segment = id, length } = {}) {
    manager.handleStreamHeader(new DataStream_Header({
      streamId: id, topic, mimeType: 'text/plain', timestamp: 0n,
      totalLength: length === undefined ? undefined : BigInt(length),
      attributes: { 'lk.segment_id': segment },
      contentHeader: { case: 'textHeader', value: new DataStream_TextHeader({}) },
    }), sender, 0);
    let index = 0n;
    return {
      async write(text) {
        manager.handleStreamChunk(new DataStream_Chunk({
          streamId: id, chunkIndex: index++, content: new TextEncoder().encode(text),
        }), 0);
        await setImmediate();
      },
      async end() {
        manager.handleStreamTrailer(new DataStream_Trailer({ streamId: id }), 0);
        await setImmediate();
      },
    };
  }
  return { room, manager, open };
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
  const { room, manager, open } = createRoom();
  let entries;
  const update = (value) => { entries = value; };
  const stop = listenToTranscript(room, update);
  const interrupted = open('old');
  await interrupted.write('Partial');
  const snapshot = entries;
  stop();
  manager.clearControllers();
  room.emit(RoomEvent.Disconnected);
  const endNext = listenToTranscript(room, update);
  stop();
  await open('new').write('Fresh');
  assert.deepEqual(entries.map(({ text }) => text), ['Fresh']);
  assert.equal(snapshot[0].text, 'Partial');
  endNext();
});

it('releases pending reads when the room disconnects during a transcript', async (t) => {
  const { room, manager, open } = createRoom();
  let entries;
  listenToTranscript(room, (value) => { entries = value; });
  const handler = manager.textStreamHandlers.get('lk.transcription');
  let reader;
  manager.textStreamHandlers.set('lk.transcription', (value, sender) => {
    reader = value;
    return handler(value, sender);
  });
  const warning = t.mock.method(console, 'warn', () => {});
  await open('old').write('Partial');
  assert.equal(reader.reader.locked, true);
  manager.clearControllers();
  room.state = ConnectionState.Disconnected;
  room.emit(RoomEvent.Disconnected);
  await setImmediate();
  assert.equal(reader.reader.locked, false);
  assert.equal(entries[0].text, 'Partial');
  assert.equal(warning.mock.callCount(), 0);
});

it('reports a broken active stream and can receive the next one', async (t) => {
  const { room, open } = createRoom();
  let entries;
  const warning = t.mock.method(console, 'warn', () => {});
  const stop = listenToTranscript(room, (value) => { entries = value; });
  const broken = open('broken', { length: 100 });
  await broken.write('Short');
  await broken.end();
  assert.equal(warning.mock.calls[0].arguments[1].reasonName, 'Incomplete');
  await open('next').write('Next');
  assert.deepEqual(entries.map(({ text }) => text), ['Short', 'Next']);
  stop();
});

it('releases only its own handlers if another consumer already owns chat', () => {
  const { room, manager } = createRoom();
  const chat = () => {};
  room.registerTextStreamHandler('lk.chat', chat);
  assert.throws(() => listenToTranscript(room, () => {}));
  assert.equal(manager.textStreamHandlers.has('lk.transcription'), false);
  assert.equal(manager.textStreamHandlers.get('lk.chat'), chat);
});
