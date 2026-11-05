export const VOICES = [
  { id: 'marin', label: 'Marin' },
  { id: 'ash', label: 'Ash' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'coral', label: 'Coral' },
] as const;

export type LiveVoice = (typeof VOICES)[number]['id'];
export function isLiveVoice(value: unknown): value is LiveVoice {
  return VOICES.some((voice) => voice.id === value);
}
