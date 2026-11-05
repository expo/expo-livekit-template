import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { isVisualizerVariant, type VisualizerVariant } from '@/components/visualizer';
import { isLiveVoice, type LiveVoice } from '@/live/voices';

type Preferences = { voice: LiveVoice; visualizer: VisualizerVariant };
const defaults: Preferences = { voice: 'marin', visualizer: 'aura' };
const key = 'livekit-preferences-v1';
const connection = {
  endpoint: process.env.EXPO_PUBLIC_TOKEN_ENDPOINT ||
    `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:3001/token`,
  mode: process.env.EXPO_PUBLIC_SESSION_MODE === 'fixture' ? 'fixture' : 'live',
} as const;

export function usePreferences() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        setPreferences({
          voice: isLiveVoice(saved?.voice) ? saved.voice : defaults.voice,
          visualizer: isVisualizerVariant(saved?.visualizer) ? saved.visualizer : defaults.visualizer,
        });
      })
      .catch(() => {
        if (active) setStorageError('Could not restore settings. Using defaults.');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!changed.current) return;
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(key, JSON.stringify(preferences)))
      .then(() => setStorageError(null))
      .catch(() => setStorageError('Settings changed, but could not be saved on this device.'));
  }, [preferences]);

  function update(patch: Partial<Preferences>) {
    changed.current = true;
    setPreferences((current) => ({ ...current, ...patch }));
  }

  return { preferences: { ...connection, ...preferences }, update, ready, storageError };
}
