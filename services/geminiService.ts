import { BugReport, BDDScenario } from "../types";

const API_ENDPOINT = '/api/generate';

// ─── User-Friendly Error Messages ────────────────────────────────────────────
// Map HTTP status codes to plain-English messages the user can act on.
const FRIENDLY_ERRORS: Record<number, string> = {
  429: "The AI service is busy right now. Please wait about 30 seconds and try again.",
  503: "The AI service is experiencing high demand. Please try again in a few seconds.",
  500: "Something went wrong on our end. Please try again later.",
  405: "Request error. Please refresh the page and try again.",
  400: "Invalid input. Please check your text and try again.",
};

const DEFAULT_ERROR = "Something went wrong. Please try again.";

// ─── Fetch helper with timeout and client-side retry ─────────────────────────
// The backend already retries against Gemini, but if the *entire function* times
// out on Vercel (e.g. cold-start + slow model) the client gets a generic error.
// We do ONE transparent client-side retry for 503/429 responses only.

async function fetchWithRetry(
  url: string,
  body: Record<string, unknown>,
  retries = 1,
): Promise<Response> {
  const controller = new AbortController();
  // 35 s client timeout — slightly above Vercel's 30 s function timeout
  const timeoutId = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // If the response is a transient error and we have retries left, wait and retry
    if ((response.status === 503 || response.status === 429) && retries > 0) {
      // Wait 3 seconds then try one more time
      await new Promise((r) => setTimeout(r, 3_000));
      return fetchWithRetry(url, body, retries - 1);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Parse the API response to get a user-friendly error message ────────────
async function getFriendlyError(response: Response): Promise<string> {
  // First, try to get the clean `error` field from our API response body
  try {
    const body = await response.json();
    if (body.error && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // JSON parse failed — fall through
  }

  // Fall back to a status-based message
  return FRIENDLY_ERRORS[response.status] || DEFAULT_ERROR;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateBugReport(input: string): Promise<BugReport> {
  let response: Response;
  try {
    response = await fetchWithRetry(API_ENDPOINT, { action: 'bug-report', input });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("The request took too long. Please try again.");
    }
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await getFriendlyError(response));
  }

  const text = await response.text();
  if (!text) throw new Error("No response received. Please try again.");
  return JSON.parse(text) as BugReport;
}

export async function generateBDDSteps(input: string): Promise<BDDScenario> {
  let response: Response;
  try {
    response = await fetchWithRetry(API_ENDPOINT, { action: 'bdd-steps', input });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("The request took too long. Please try again.");
    }
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await getFriendlyError(response));
  }

  const text = await response.text();
  if (!text) throw new Error("No response received. Please try again.");
  return JSON.parse(text) as BDDScenario;
}
