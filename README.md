# Expo LiveKit

<img src="assets/icon.png" alt="Expo LiveKit app icon" width="128" height="128">

An Expo SDK 58 voice assistant with a LiveKit agent, a live transcript, and three [Agents UI](https://livekit.com/products/agents-ui) visualizers.

The [vendored LiveKit SDK](vendor/README.md) includes an upstream disconnect fix awaiting an npm release.

## Run on iOS

Install Xcode, Node.js 22.18+ or 24.3+, and the [LiveKit CLI](https://docs.livekit.io/intro/basics/cli/). From a fresh checkout:

```sh
npm ci
npm --prefix server ci
lk cloud auth
(cd server && lk app env --write)
```

Run each command in a separate terminal:

```sh
npm run server
npm run agent
npm run ios
```

Allow microphone access and tap the waveform to talk. Use the development build; Expo Go does not include native WebRTC.

Customize `app.json` and `server/src/assistant.ts` for your app.

[Backend and iPhone setup](server/README.md) · Checks: `npm run check`
