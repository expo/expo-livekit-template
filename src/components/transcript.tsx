import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';

import type { Message } from '@/hooks/use-voice-session';
import { theme } from '@/theme';

const enter = FadeInDown.duration(250).easing(Easing.bezier(0.23, 1, 0.32, 1));

/** The live conversation. New text streams in at the bottom and older text dims. */
export function Transcript({ messages }: { messages: Message[] }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const spoken = messages.filter((message) => message.text.trim());

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => scroll.current?.scrollToEnd()}
      >
        {spoken.map(({ id, fromUser, text }, index) => {
          const latest = index === spoken.length - 1;
          return (
            <Animated.View key={id} entering={enter}>
              <Animated.View
                style={[styles.message, fromUser && styles.user, { opacity: latest ? 1 : 0.5 }]}
              >
                <Text selectable style={[styles.text, fromUser && styles.userText]}>
                  {text.trim()}
                </Text>
              </Animated.View>
            </Animated.View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={styles.fade} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 2 },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  message: { transitionProperty: 'opacity', transitionDuration: 300 },
  text: { color: theme.text, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: theme.surface,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userText: { fontSize: 17, lineHeight: 23, letterSpacing: 0 },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    experimental_backgroundImage: `linear-gradient(to bottom, ${theme.background}, transparent)`,
  },
});
