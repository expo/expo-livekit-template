import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseConnectionDetails,
  requestConnectionDetails,
  validateTokenEndpoint,
} from "./token-request.ts";

const credentials = {
  server_url: "ws://localhost:7880",
  participant_token: "header.payload.signature",
};
const options = {
  endpoint: "http://localhost:3001/token",
  voice: "cedar",
  mode: "fixture",
};
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("LiveKit token boundary", () => {
  it("accepts local and Cloud transport URLs and maps only the public response fields", () => {
    assert.deepEqual(
      parseConnectionDetails({
        ...credentials,
        secret: "must-not-be-returned",
      }),
      {
        serverUrl: "ws://localhost:7880",
        participantToken: "header.payload.signature",
      },
    );
    assert.equal(
      parseConnectionDetails({
        ...credentials,
        server_url: "wss://example.livekit.cloud",
      }).serverUrl,
      "wss://example.livekit.cloud",
    );
  });

  it("rejects malformed credentials and unsafe URL schemes", () => {
    for (const value of [
      null,
      {},
      { ...credentials, participant_token: "" },
      { ...credentials, server_url: "https://example.com" },
      { ...credentials, server_url: "wss://name:secret@example.com" },
    ]) {
      assert.throws(() => parseConnectionDetails(value), /token server/);
    }
    for (const value of [
      "",
      "ws://localhost:7880",
      "javascript:alert(1)",
      "https://name:secret@example.com",
    ]) {
      assert.throws(() => validateTokenEndpoint(value), /valid HTTP/);
    }
  });

  it("posts the selected voice and test mode with an abort signal", async () => {
    const controller = new AbortController();
    let captured;
    await requestConnectionDetails(
      async (url, init) => {
        captured = { url, init };
        return response(credentials);
      },
      options,
      controller.signal,
    );
    assert.equal(captured.url, options.endpoint);
    assert.equal(captured.init.method, "POST");
    assert.deepEqual(JSON.parse(captured.init.body), {
      voice: "cedar",
      mode: "fixture",
    });
    assert.equal(captured.init.signal, controller.signal);
  });

  it("returns actionable network, configuration, authorization, and rate-limit errors", async () => {
    const signal = new AbortController().signal;
    await assert.rejects(
      requestConnectionDetails(
        async () => {
          throw new Error("network");
        },
        options,
        signal,
      ),
      /Cannot reach the token server/,
    );
    await assert.rejects(
      requestConnectionDetails(
        async () => response({ error: "Set LIVEKIT_URL on the server." }, 503),
        options,
        signal,
      ),
      /Set LIVEKIT_URL/,
    );
    await assert.rejects(
      requestConnectionDetails(async () => response({}, 403), options, signal),
      /rejected access/,
    );
    await assert.rejects(
      requestConnectionDetails(async () => response({}, 429), options, signal),
      /Too many sessions/,
    );
    await assert.rejects(
      requestConnectionDetails(async () => response(null), options, signal),
      /invalid response/,
    );
  });

  it("sends the optional development bearer key in headers, never in the request body", async () => {
    let captured;
    await requestConnectionDetails(
      async (_url, init) => {
        captured = init;
        return response(credentials);
      },
      { ...options, tokenApiKey: "development-gate" },
      new AbortController().signal,
    );
    assert.equal(captured.headers.Authorization, "Bearer development-gate");
    assert.deepEqual(JSON.parse(captured.body), {
      voice: "cedar",
      mode: "fixture",
    });
  });

  it("preserves cancellation instead of misreporting it as a network error", async () => {
    const controller = new AbortController();
    const cancelled = new Error("cancelled");
    controller.abort();
    await assert.rejects(
      requestConnectionDetails(
        async () => {
          throw cancelled;
        },
        options,
        controller.signal,
      ),
      (error) => error === cancelled,
    );
  });
});
