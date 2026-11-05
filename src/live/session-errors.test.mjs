import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeSessionFailure } from "./session-errors.ts";
import { SessionRequestError } from "./token-request.ts";

describe("session error messages", () => {
  it("recognizes the native WebRTC permission-denied shape", () => {
    assert.match(
      describeSessionFailure({
        name: "SecurityError",
        message: "Permission denied.",
      }),
      /Microphone access is off.*Settings/,
    );
  });
  it("recognizes browser permission errors without requiring an Error instance", () => {
    for (const name of [
      "NotAllowedError",
      "PermissionDeniedError",
      "PermissionDismissedError",
    ]) {
      assert.match(
        describeSessionFailure({ name }),
        /Microphone access is off/,
      );
    }
  });
  it("distinguishes missing and busy audio devices", () => {
    assert.match(
      describeSessionFailure({ name: "NotFoundError" }),
      /No microphone/,
    );
    assert.match(
      describeSessionFailure({ name: "NotReadableError" }),
      /Close other audio apps/,
    );
  });
  it("retains actionable backend errors and does not expose arbitrary transport details", () => {
    assert.equal(
      describeSessionFailure(new SessionRequestError("Start the backend.")),
      "Start the backend.",
    );
    assert.doesNotMatch(
      describeSessionFailure(new Error("token=sensitive")),
      /sensitive/,
    );
    assert.match(describeSessionFailure(null), /Could not start/);
  });
});
