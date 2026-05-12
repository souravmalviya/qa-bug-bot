import { BugReport, BDDScenario } from "../types";

const API_ENDPOINT = '/api/generate';

// ─── User-Friendly Error Messages ────────────────────────────────────────────
const FRIENDLY_ERRORS: Record<number, string> = {
  429: "The AI service is busy right now. Please wait about 30 seconds and try again.",
  503: "The AI service is experiencing high demand. Please try again in a few seconds.",
  500: "Something went wrong on our end. Please try again later.",
  405: "Request error. Please refresh the page and try again.",
  400: "Invalid input. Please check your text and try again.",
  401: "Your session has expired. Please refresh the page and sign in again.",
};

const DEFAULT_ERROR = "Something went wrong. Please try again.";

// ─── Fetch helper with timeout and client-side retry ─────────────────────────
async function fetchWithRetry(
  url: string,
  body: Record<string, unknown>,
  token: string,
  retries = 1,
): Promise<Response> {
  const controller = new AbortController();
  // 35 s client timeout — slightly above Vercel's 30 s function timeout
  const timeoutId = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if ((response.status === 503 || response.status === 429) && retries > 0) {
      await new Promise((r) => setTimeout(r, 3_000));
      return fetchWithRetry(url, body, token, retries - 1);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Parse the API response to get a user-friendly error message ────────────
async function getFriendlyError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body.error && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // fall through
  }
  return FRIENDLY_ERRORS[response.status] || DEFAULT_ERROR;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateBugReport(
  input: string,
  getToken: () => Promise<string | null>,
): Promise<BugReport> {
  const token = await getToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  let response: Response;
  try {
    response = await fetchWithRetry(API_ENDPOINT, { action: 'bug-report', input }, token);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("The request took too long. Please try again.");
    }
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await getFriendlyError(response));
  }

  const text = await response.text();
  if (!text) throw new Error("No response received. Please try again.");
  try {
    return JSON.parse(text) as BugReport;
  } catch {
    throw new Error("Received an unexpected response. Please try again.");
  }
}

export async function generateBDDSteps(
  input: string,
  getToken: () => Promise<string | null>,
): Promise<BDDScenario> {
  const token = await getToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  let response: Response;
  try {
    response = await fetchWithRetry(API_ENDPOINT, { action: 'bdd-steps', input }, token);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error("The request took too long. Please try again.");
    }
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await getFriendlyError(response));
  }

  const text = await response.text();
  if (!text) throw new Error("No response received. Please try again.");
  try {
    return JSON.parse(text) as BDDScenario;
  } catch {
    throw new Error("Received an unexpected response. Please try again.");
  }
}
