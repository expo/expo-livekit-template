# Agent and token API

The [app quickstart](../README.md) runs the API and worker on your Mac and connects them to LiveKit Cloud. Cloud Inference supplies the realtime voice model. Customize the assistant in `src/assistant.ts`.

## Local LiveKit

Run `livekit-server --dev --bind 127.0.0.1`. To use the local server, put these settings in `server/.env.local` and start `npm run api` and `npm run dev` from `server/` in separate terminals.

```dotenv
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_MODEL_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
```

The direct OpenAI provider uses `gpt-realtime-2.1`. Set `OPENAI_REALTIME_MODEL` to change it.

For a transport test without model credentials, enable `LIVEKIT_ALLOW_FIXTURE=1`, start `npm run fixture` alongside the API and local media server, then run `npm run smoke`. The fixture publishes a tone and scripted replies. To keep Cloud credentials for live calls, set the local values under `FIXTURE_LIVEKIT_URL`, `FIXTURE_LIVEKIT_API_KEY` and `FIXTURE_LIVEKIT_API_SECRET` instead. Set `EXPO_PUBLIC_SESSION_MODE=fixture` in the app’s `.env.local` to connect the mobile app to the fixture.

## iPhone on Wi-Fi

Connect the Mac and iPhone to the same network. In `server/.env.local`, set `HOST=0.0.0.0` and `TOKEN_API_KEY` to a temporary development key, then restart the API. In the app’s `.env.local`, set `EXPO_PUBLIC_TOKEN_ENDPOINT=http://YOUR_MAC_LAN_IP:3001/token` and `EXPO_PUBLIC_TOKEN_API_KEY` to the same key, then restart Metro. Run `npm run ios -- --device` from the repository root to install the development build. Allow it to access the local network. A local media server also needs `--bind 0.0.0.0` and a reachable LAN address in its LiveKit URL. Use user authentication before distributing the app because Expo public values are visible in the bundle.

## API and checks

`POST /token` accepts a JSON object with `voice` and `mode`, defaulting to `marin` and `live`. It returns `server_url`, `participant_token`, `room_name` and `mode`. Tokens grant access to one generated room with microphone publishing, subscriptions and data messages. The API limits token requests to 20 per IP per minute. Calls end after ten minutes. `GET /health` reports configuration status.

Run these commands from `server/`.

| Command | Checks |
| --- | --- |
| `npm run check` and `npm test` | Types, token permissions and HTTP handling |
| `npm run smoke` | Local fixture connection, text and audio |
| `npm run smoke:live` | Live room, spoken greeting and typed arithmetic question |
| `npm run smoke:audio` | Synthesized microphone question and spoken answer on macOS |

Live checks use the configured providers and incur normal usage charges.
