import type { LiveVoice } from "./voices";

export type SessionMode = "live" | "fixture";
export type ConnectionDetails = { serverUrl: string; participantToken: string };

export class SessionRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionRequestError";
  }
}

export function validateTokenEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error("Invalid endpoint");
    }
    return url.toString();
  } catch {
    throw new SessionRequestError(
      "Set EXPO_PUBLIC_TOKEN_ENDPOINT to a valid HTTP or HTTPS token endpoint.",
    );
  }
}

export function parseConnectionDetails(value: unknown): ConnectionDetails {
  if (!value || typeof value !== "object") {
    throw new SessionRequestError(
      "The token server returned an invalid response.",
    );
  }
  const { server_url: serverUrl, participant_token: participantToken } =
    value as Record<string, unknown>;
  let validServer = false;
  try {
    const url = new URL(typeof serverUrl === "string" ? serverUrl : "");
    validServer =
      ["ws:", "wss:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    validServer = false;
  }
  if (
    !validServer ||
    typeof participantToken !== "string" ||
    !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(participantToken)
  ) {
    throw new SessionRequestError(
      "The token server must return server_url and a valid participant_token.",
    );
  }
  return { serverUrl: serverUrl as string, participantToken };
}

type Fetcher = (
  url: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export async function requestConnectionDetails(
  fetcher: Fetcher,
  options: {
    endpoint: string;
    voice: LiveVoice;
    mode: SessionMode;
    tokenApiKey?: string;
  },
  signal: AbortSignal,
): Promise<ConnectionDetails> {
  const endpoint = validateTokenEndpoint(options.endpoint);
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.tokenApiKey
          ? { Authorization: `Bearer ${options.tokenApiKey}` }
          : {}),
      },
      body: JSON.stringify({ voice: options.voice, mode: options.mode }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new SessionRequestError(
      "Cannot reach the token server. Check the endpoint and start the backend. On a phone, use your computer's LAN address.",
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error.slice(0, 240)
        : undefined;
    if (response.status === 429)
      throw new SessionRequestError(
        "Too many sessions. Wait a moment, then try again.",
      );
    if (response.status === 401 || response.status === 403)
      throw new SessionRequestError(
        "The token server rejected access. Check the backend authentication settings.",
      );
    throw new SessionRequestError(
      detail ||
        `The token server returned HTTP ${response.status}. Check the backend configuration.`,
    );
  }
  return parseConnectionDetails(body);
}
