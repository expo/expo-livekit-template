# Development

Use npm. Native configuration belongs in `app.json`; Expo generates `ios/` and `android/`. Read the [Expo SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/) and the LiveKit skills in `.agents/skills/` before you change the integration. Use `lk docs` for current LiveKit APIs.

## Layout

- `src/hooks/use-voice-session.ts` holds all LiveKit session code. It uses `useSession`, `useAgent` and `useTranscriptions`. Do not write token or connection code by hand.
- The transcript uses the segment id (`lk.segment_id`) as the message key. Each update of a spoken message has a new stream id, and `useSessionMessages` sorts by stream id, so it can put a reply above its question.
- `src/app/token+api.ts` is the token endpoint. It runs on the server. Keep credentials in `.env.local`.
- `src/app/_layout.web.tsx` is necessary. Expo loads the root layout in Node when it exports the token route, and `@livekit/react-native` does not load there. Without the file, release builds fail with `requireNativeComponent is not a function`.
- `src/components/agents-ui/` holds the five LiveKit visualizers. They run in an Expo DOM component. Keep the license files and `upstream.json` when you change them.
- On iOS, do not call `AudioSession.startAudioSession()`. LiveKit configures the audio session itself, and the call stops the microphone.
- The hook asks for the microphone permission before `session.start()`. Without this, the agent greets the user behind the permission dialog. On Android, the dialog also stops the connection setup, and a slow answer causes a negotiation error.
- The visualizer uses a different WebView on each platform (`useExpoDOMWebView` in `src/components/visualizer.tsx`). On iOS, Expo's DOM WebView rejects the first prop update (`Unable to find the 'DomWebView' view`). On Android, `react-native-webview` loads the DOM props too late (`injectedObjectJson is not a function`). Test both platforms when you change the `dom` props.
- `web.favicon` in `app.json` is necessary. The Android WebView requests `/favicon.ico` from the dev server, and without the favicon the server tries to render the app for the web and logs an error.
- `agent/agent.ts` is the voice agent. Its `agentName` must match `AGENT_NAME` in the token endpoint.

## Checks

Run `npm run typecheck` and `npm run lint`. For app changes, test on a simulator: start a conversation, mute, end during a reply, then start again. The second conversation must work and the microphone must stop after each end. The simulator has no echo cancellation, so mute the microphone while the agent speaks. Do the same test on an Android emulator: start it with audio and run `adb emu avd hostmicon` to use the computer's microphone. Test the first start with the microphone dialog, and the "Don't allow" answer.

## Git

Use single-line lowercase commits without prefixes or co-author credits. Use area-prefixed PR titles.
