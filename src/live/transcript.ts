import { ConnectionState, DataStreamError, DataStreamErrorReason, RoomEvent, type Room, type TextStreamReader } from 'livekit-client';
export type TranscriptEntry = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export function listenToTranscript(room: Room, update: (entries: TranscriptEntry[]) => void) {
  const entries = new Map<string, TranscriptEntry>();
  const readers = new Map<string, AbortController>();
  const registered: string[] = [];

  async function receive(reader: TextStreamReader, sender: { identity: string }) {
    const { topic, attributes, id } = reader.info;
    const segment = topic === 'lk.transcription' ? attributes?.['lk.segment_id'] : undefined;
    const key = JSON.stringify([topic, sender.identity, segment || id]);
    const role = sender.identity === room.localParticipant.identity ? 'user' : 'assistant';
    readers.get(key)?.abort();
    const controller = new AbortController();
    readers.set(key, controller);
    let text = '';
    try {
      for await (const chunk of reader.withAbortSignal(controller.signal)) {
        if (controller.signal.aborted) break;
        text += chunk;
        entries.set(key, { id: key, role, text });
        update([...entries.values()]);
      }
    } catch (error) {
      const disconnected = room.state === ConnectionState.Disconnected &&
        error instanceof DataStreamError && error.reason === DataStreamErrorReason.AbnormalEnd;
      if (!controller.signal.aborted && !disconnected) console.warn('Incoming text stream failed', error);
    } finally {
      if (readers.get(key) === controller) readers.delete(key);
    }
  }

  function stop() {
    room.off(RoomEvent.Disconnected, stop);
    for (const topic of registered.splice(0)) room.unregisterTextStreamHandler(topic);
    for (const controller of readers.values()) controller.abort();
    readers.clear();
  }

  try {
    for (const topic of ['lk.transcription', 'lk.chat']) {
      room.registerTextStreamHandler(topic, receive);
      registered.push(topic);
    }
    room.on(RoomEvent.Disconnected, stop);
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
