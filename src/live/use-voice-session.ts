import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { fetch } from "expo/fetch";
import { useAgent, useSession } from "@livekit/components-react";
import { AudioSession } from "@livekit/react-native";
import { DisconnectReason, RoomEvent, TokenSource } from "livekit-client";
import {
  requestConnectionDetails,
  type ConnectionDetails,
  type SessionMode,
} from "./token-request";
import { describeSessionFailure } from "./session-errors";
import { listenToTranscript, type TranscriptEntry } from "./transcript";
import type { LiveVoice } from "./voices";

type VoiceSessionPhase = "idle" | "connecting" | "connected" | "ending";
type VoiceSessionOptions = {
  endpoint: string;
  voice: LiveVoice;
  mode: SessionMode;
};

const CONNECT_TIMEOUT_MS = 30_000;
const MAX_SESSION_MS = 10 * 60_000;

type Attempt = {
  controller: AbortController;
  task: Promise<boolean>;
  cleanup?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  roomConnected: boolean;
  stopTranscript?: () => void;
  mute?: Promise<void>;
};

function createCredentialStore() {
  function createGate() {
    let resolve!: (details: ConnectionDetails) => void;
    const promise = new Promise<ConnectionDetails>((done) => { resolve = done; });
    return { promise, resolve };
  }
  let gate = createGate();
  return {
    tokenSource: TokenSource.literal(() => gate.promise),
    provide(details: ConnectionDetails) { gate.resolve(details); },
    reset() { gate = createGate(); },
  };
}

export function useVoiceSession(options: VoiceSessionOptions) {
  const mounted = useRef(true);
  const active = useRef<Attempt | null>(null);
  const [phase, setPhase] = useState<VoiceSessionPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);

  const [credentialStore] = useState(createCredentialStore);
  const session = useSession(credentialStore.tokenSource, {
    agentConnectTimeoutMilliseconds: 20_000,
  });
  const { room } = session;
  const agent = useAgent(session);

  const changePhase = useCallback((next: VoiceSessionPhase) => {
    if (mounted.current) setPhase(next);
  }, []);
  const reportError = useCallback((message: string) => {
    if (mounted.current) setError(message);
  }, []);
  const stopPublishedTracks = useCallback(() => {
    room.localParticipant.trackPublications.forEach((publication) =>
      publication.track?.stop(),
    );
  }, [room]);

  const cleanup = useCallback(
    (attempt: Attempt): Promise<void> => {
      if (attempt.cleanup) return attempt.cleanup;
      changePhase("ending");
      clearTimeout(attempt.timer);
      attempt.controller.abort();
      attempt.stopTranscript?.();
      stopPublishedTracks();
      attempt.cleanup = (async () => {
        await room.disconnect(true).catch(() => {});
        await attempt.task;
        await attempt.mute;
        stopPublishedTracks();
        await room.disconnect(true).catch(() => {});
        if (Platform.OS === "android")
          await AudioSession.stopAudioSession().catch(() => {});
        if (active.current === attempt) {
          active.current = null;
          credentialStore.reset();
          if (mounted.current) setMuted(false);
          changePhase("idle");
        }
      })();
      return attempt.cleanup;
    },
    [changePhase, credentialStore, room, stopPublishedTracks],
  );

  async function end() {
    const attempt = active.current;
    if (attempt) await cleanup(attempt);
  }

  async function start() {
    if (!mounted.current || active.current) return;
    const snapshot = {
      ...options,
      tokenApiKey: process.env.EXPO_PUBLIC_TOKEN_API_KEY,
    };
    const attempt: Attempt = {
      controller: new AbortController(),
      task: Promise.resolve(false),
      roomConnected: false,
    };
    active.current = attempt;
    changePhase("connecting");
    setError(null);
    setMuted(false);
    setMessages([]);
    const ensureActive = () => {
      if (
        !mounted.current ||
        active.current !== attempt ||
        attempt.controller.signal.aborted
      ) {
        throw new Error("Session cancelled");
      }
    };
    attempt.timer = setTimeout(() => {
      if (active.current !== attempt) return;
      reportError(
        "The connection timed out. Check that the token server, LiveKit server, and agent are running.",
      );
      void cleanup(attempt);
    }, CONNECT_TIMEOUT_MS);

    attempt.task = (async () => {
      try {
        const details = await requestConnectionDetails(
          fetch,
          snapshot,
          attempt.controller.signal,
        );
        ensureActive();
        attempt.stopTranscript = listenToTranscript(room, setMessages);
        credentialStore.provide(details);
        if (Platform.OS === "android") await AudioSession.startAudioSession();
        ensureActive();
        await room.connect(details.serverUrl, details.participantToken, {
          autoSubscribe: true,
        });
        ensureActive();
        attempt.roomConnected = true;
        await room.localParticipant.setMicrophoneEnabled(true);
        ensureActive();
        await agent.waitUntilConnected(attempt.controller.signal);
        ensureActive();
        clearTimeout(attempt.timer);
        changePhase("connected");
        attempt.timer = setTimeout(() => {
          if (active.current !== attempt) return;
          reportError(
            "This session reached its 10-minute limit. Start a new conversation to continue.",
          );
          void cleanup(attempt);
        }, MAX_SESSION_MS);
        return true;
      } catch (cause) {
        if (!attempt.controller.signal.aborted && active.current === attempt)
          reportError(describeSessionFailure(cause));
        return false;
      }
    })();
    const connected = await attempt.task;
    if (!connected) await cleanup(attempt);
  }

  async function toggleMute() {
    const attempt = active.current;
    if (!attempt || phase !== "connected" || attempt.controller.signal.aborted || attempt.mute) return;
    attempt.mute = room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
      .then(() => {
        if (!attempt.controller.signal.aborted) setMuted(!room.localParticipant.isMicrophoneEnabled);
      })
      .catch((cause) => {
        if (!attempt.controller.signal.aborted) reportError(describeSessionFailure(cause));
      });
    await attempt.mute;
    attempt.mute = undefined;
  }

  useEffect(() => {
    const onDisconnected = (reason?: DisconnectReason) => {
      const attempt = active.current;
      if (
        !attempt ||
        attempt.controller.signal.aborted ||
        reason === DisconnectReason.CLIENT_INITIATED
      )
        return;
      reportError(
        "The connection ended unexpectedly. Check your network and start a new conversation.",
      );
      void cleanup(attempt);
    };
    const onMediaError = (cause: Error) => {
      const attempt = active.current;
      if (!attempt || attempt.controller.signal.aborted) return;
      reportError(describeSessionFailure(cause));
      void cleanup(attempt);
    };
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.MediaDevicesError, onMediaError);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaError);
    };
  }, [cleanup, reportError, room]);

  useEffect(() => {
    const attempt = active.current;
    if (
      agent.state !== "failed" ||
      !attempt?.roomConnected ||
      attempt.controller.signal.aborted
    )
      return;
    reportError(
      `${agent.failureReasons?.join(" ") || "The agent is unavailable."} Check the agent process, then reconnect.`,
    );
    void cleanup(attempt);
  }, [agent.state, agent.failureReasons, cleanup, reportError]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const attempt = active.current;
      if (attempt) void cleanup(attempt);
    };
  }, [cleanup]);

  return { agent, messages, start, end, toggleMute, phase, muted, error };
}
