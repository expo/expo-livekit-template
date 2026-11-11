import { registerGlobals } from '@livekit/react-native';
import { Stack } from 'expo-router';

import { theme } from '@/theme';

// LiveKit needs its WebRTC globals before the first room is created.
registerGlobals();

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
    />
  );
}
