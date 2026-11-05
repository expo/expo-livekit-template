import { SessionRequestError } from "./token-request.ts";

export function describeSessionFailure(error: unknown): string {
  if (error instanceof SessionRequestError) return error.message;
  const name =
    error && typeof error === "object" && "name" in error
      ? error.name
      : undefined;
  if (
    [
      "SecurityError",
      "NotAllowedError",
      "PermissionDeniedError",
      "PermissionDismissedError",
    ].includes(String(name))
  ) {
    return "Microphone access is off. Allow it in your device Settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone is available. Check your device audio input, then try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is unavailable. Close other audio apps, then try again.";
  }
  return "Could not start the conversation. Check that LiveKit and the agent are running, then try again.";
}
