# Development

Use npm. Native configuration belongs in `app.json`; Expo generates `ios/` and `android/`. Read the [Expo SDK 58 docs](https://docs.expo.dev/versions/v58.0.0/) and the project-local LiveKit skills in `.agents/skills/` before changing the relevant integration. Use `lk docs` for current LiveKit APIs.

Keep the Expo GPT Live controls, layout, settings and transcript sheet. Only the avatar uses LiveKit Agents UI. Pass state and audio levels to its DOM component; native LiveKit owns audio. Preserve third-party notices when adapting the visualizers.

Request credentials only on Start. End, Cancel and unmount must release media before reconnecting. Preserve connection and session timeouts; lock voice selection during calls. Keep credentials in `server/.env.local`. The public LAN token is for development only. Keep the transport fixture separate from live AI.

Run `npm run check`. For native changes, test on a simulator: start, mute, open settings and transcript, press X during a reply, then reconnect. Verify the partial transcript remains and the microphone stops.

Use single-line lowercase commits without prefixes or co-author credits. Use area-prefixed PR titles.
