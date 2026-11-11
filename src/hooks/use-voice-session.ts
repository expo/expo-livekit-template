import {
  useAgent,
  useLocalParticipant,
  useSession,
  useTranscriptions,
} from '@livekit/components-react';
import { AudioSession } from '@livekit/react-native';
import { ConnectionState, DisconnectReason, RoomEvent, TokenSource } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { LogBox, PermissionsAndroid } from 'react-native';

// Tokens come from the Expo Router API route in src/app/token+api.ts.
const tokenSource = TokenSource.endpoint('/token');

// LiveKit logs these when a conversation ends. They are harmless.
LogBox.ignoreLogs([
  'Room disconnected in the middle of receiving data',
  // Fixed in livekit/client-sdk-js#2192. Delete this line when livekit-client has the fix.
  'error reading from signal stream',
]);

// Android needs an explicit audio session. On iOS, LiveKit configures the session itself.
const android = process.env.EXPO_OS === 'android';
const MICROPHONE_DENIED = 'Allow microphone access to talk to the agent.';

/** One spoken message in the transcript. */
export type Message = { id: string; fromUser: boolean; text: string };

/** One voice conversation with the agent: start, talk, mute, end. */
export function useVoiceSession() {
  const session = useSession(tokenSource);
  const { room } = session;
  const agent = useAgent(session);
  const transcriptions = useTranscriptions({ room });
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant({ room });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const cancel = useRef<AbortController>(null);
  const active = starting || session.connectionState !== ConnectionState.Disconnected;

  useEffect(() => {
    if (!active && android) void AudioSession.stopAudioSession();
  }, [active]);

  useEffect(() => {
    const onDisconnected = (reason?: DisconnectReason) => {
      if (reason !== DisconnectReason.CLIENT_INITIATED) setError('The connection was lost.');
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      void room.disconnect(); // End the conversation when the screen goes away.
    };
  }, [room]);

  async function start() {
    const controller = (cancel.current = new AbortController());
    setStarting(true);
    setError(undefined);
    try {
      if (android) {
        // The permission dialog stops the connection setup, so ask before the connection starts.
        const answer = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (answer !== 'granted') throw new Error(MICROPHONE_DENIED);
        await AudioSession.startAudioSession();
      }
      // Fetches a token, connects, turns the microphone on, and waits for the agent.
      await session.start({ signal: controller.signal });
    } catch (cause) {
      // An abort means the user ended the conversation before the agent joined.
      if (!controller.signal.aborted) {
        // On iOS, a denied microphone arrives as a SecurityError that is not an Error object.
        const { name, message } = (cause ?? {}) as { name?: string; message?: string };
        setError(name === 'SecurityError' ? MICROPHONE_DENIED : (message ?? String(cause)));
      }
      await session.end();
    } finally {
      setStarting(false);
    }
  }

  function end() {
    cancel.current?.abort();
    return session.end();
  }

  return {
    active,
    connected: session.isConnected,
    // The agent reports "disconnected" until the room connects. Show that time as "connecting".
    state: !active ? 'disconnected' : agent.state === 'disconnected' ? 'connecting' : agent.state,
    // The agent reports its own failures, for example when no agent joins the room.
    // Its timer can also fire after a short conversation ends, so read it only during one.
    error: error ?? (active ? agent.failureReasons?.join(' ') : undefined),
    // Each update of a spoken message arrives as a new stream with the same segment id.
    // The segment id keeps the message in its place while its text changes.
    messages: transcriptions.map(
      ({ text, participantInfo, streamInfo }): Message => ({
        id: streamInfo.attributes?.['lk.segment_id'] ?? streamInfo.id,
        fromUser: participantInfo.identity === localParticipant.identity,
        text,
      }),
    ),
    agentTrack: agent.microphoneTrack,
    muted: session.isConnected && !isMicrophoneEnabled,
    start,
    end,
    toggleMute: () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
  } as const;
}
