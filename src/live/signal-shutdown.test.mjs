import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setImmediate } from "node:timers/promises";
import * as esm from "livekit-client";

const require = createRequire(import.meta.url);
const commonjs = require("livekit-client");

for (const [format, sdk] of [["ESM", esm], ["CommonJS", commonjs]]) {
  describe(`LiveKit ${format} signal shutdown`, () => {
    it("ignores late media section requests only after the engine releases its peer manager", async () => {
      const { engine } = new sdk.Room();
      const errors = [];
      engine.log = { debug() {}, info() {}, warn() {}, error: (error) => errors.push(error) };
      engine._isClosed = false;
      engine.setupSignalClientCallbacks();
      const packet = { numAudios: 1, numVideos: 0 };
      engine.client.onMediaSectionsRequirement(packet);
      await setImmediate();
      assert.equal(errors[0]?.message, "PC manager is closed");

      let startHandshake;
      let finishHandshake;
      const started = new Promise((resolve) => { startHandshake = resolve; });
      engine.client.ws = {
        close: startHandshake,
        closed: new Promise((resolve) => { finishHandshake = resolve; }),
      };
      const closing = engine.close();
      await started;
      assert.equal(engine.isClosed, true);
      assert.equal(engine.pcManager, undefined);
      engine.client.onMediaSectionsRequirement(packet);
      await setImmediate();
      finishHandshake({ closeCode: 1000 });
      await closing;
      assert.equal(errors.length, 1);
    });

    function connectedReader() {
      const client = new sdk.Room().engine.client;
      const errors = [];
      const warnings = [];
      const closes = [];
      client.log = {
        debug() {},
        info() {},
        warn: (...args) => warnings.push(args),
        error: (...args) => errors.push(args),
      };
      client.onClose = (reason) => closes.push(reason);
      client.sendLifecycleInput({ type: "connect" });
      client.sendLifecycleInput({ type: "connectComplete", attemptId: client.attemptId });
      let controller;
      const stream = new ReadableStream({ start(value) { controller = value; } });
      const reading = client.startReadingLoop(stream.getReader());
      const fail = () => controller.error(sdk.ConnectionError.websocket("Native socket closed"));
      return { client, errors, warnings, closes, reading, fail };
    }

    it("does not report a late read rejection after intentional close", async () => {
      const { client, errors, closes, reading, fail } = connectedReader();
      await client.close();
      fail();
      await reading;
      assert.equal(client.lifecycleState, "closed");
      assert.equal(errors.length, 0);
      assert.equal(closes.length, 0);
    });

    it("does not report a read rejection while the close handshake is pending", async () => {
      const { client, errors, closes, reading, fail } = connectedReader();
      let finishClose;
      client.ws = {
        close() {},
        closed: new Promise((resolve) => { finishClose = resolve; }),
      };
      const closing = client.close();
      assert.equal(client.lifecycleState, "disconnecting");
      fail();
      await reading;
      finishClose({ closeCode: 1000 });
      await closing;
      assert.equal(errors.length, 0);
      assert.equal(closes.length, 0);
    });

    it("does not let a stale reader report failure against a replacement connection", async () => {
      const { client, errors, closes, reading, fail } = connectedReader();
      client.sendLifecycleInput({ type: "reconnect" });
      client.sendLifecycleInput({ type: "reconnectComplete", attemptId: client.attemptId });
      fail();
      await reading;
      assert.equal(client.lifecycleState, "connected");
      await client.close();
      assert.equal(errors.length, 0);
      assert.equal(closes.length, 0);
    });

    it("still reports real active transport failures and notifies the engine", async () => {
      const { client, errors, closes, reading, fail } = connectedReader();
      fail();
      await reading;
      assert.equal(client.lifecycleState, "offline");
      assert.equal(errors.length, 1);
      assert.equal(errors[0][0], "error reading from signal stream");
      assert.equal(errors[0][1].error.reason, sdk.ConnectionErrorReason.WebSocket);
      assert.deepEqual(closes, ["error in reading loop"]);
      await client.close();
    });

    for (const state of ["disconnecting", "closed"]) {
      it(`does not rearm ping timers from late signals while ${state}`, async () => {
        const { client, warnings, closes, reading, fail } = connectedReader();
        client.pingTimeoutDuration = 0.01;
        let finishClose;
        let startedClose;
        const closeStarted = new Promise((resolve) => { startedClose = resolve; });
        if (state === "disconnecting") {
          client.ws = {
            close() { startedClose(); },
            closed: new Promise((resolve) => { finishClose = resolve; }),
          };
        }
        const closing = client.close();
        if (state === "closed") await closing;
        else await closeStarted;
        assert.equal(client.lifecycleState, state);
        client.handleSignalResponse({ message: { case: "leave", value: {} } });
        client.handleSignalResponse({
          message: { case: "pongResp", value: { lastPingTimestamp: Date.now() } },
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
        finishClose?.({ closeCode: 1000 });
        await closing;
        fail();
        await reading;
        assert.equal(warnings.length, 0);
        assert.equal(closes.length, 0);
      });
    }

    it("refreshes active ping deadlines and still detects a missing pong", async () => {
      const { client, warnings, closes, reading, fail } = connectedReader();
      client.pingTimeoutDuration = 0.01;
      client.handleSignalResponse({ message: { case: "pong", value: 0 } });
      const firstTimer = client.pingTimeout;
      client.handleSignalResponse({
        message: { case: "pongResp", value: { lastPingTimestamp: Date.now() } },
      });
      assert.notEqual(client.pingTimeout, firstTimer);
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(client.lifecycleState, "offline");
      assert.equal(warnings.length, 1);
      assert.match(warnings[0][0], /ping timeout triggered/);
      assert.deepEqual(closes, ["ping timeout"]);
      await client.close();
      fail();
      await reading;
    });
  });
}
