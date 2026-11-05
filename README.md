# Expo LiveKit

<img src="assets/icon.png" alt="Expo LiveKit app icon" width="128" height="128">

An Expo SDK 58 voice assistant with a LiveKit agent, a live transcript, and three [Agents UI](https://livekit.com/products/agents-ui) visualizers.

LiveKit uses an unmodified build of [upstream commit `a2ef1bed`](https://github.com/livekit/client-sdk-js/commit/a2ef1bed38c7f0589cf7d228762a3fcda970405b) for its disconnect fix, pending an npm release.

## Run on iOS

Install Xcode, Node.js 22.13+ or 24.3+, and the [LiveKit CLI](https://docs.livekit.io/intro/basics/cli/). From a fresh checkout:

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

[Backend and iPhone setup](server/README.md) · Checks: `npm run check`
