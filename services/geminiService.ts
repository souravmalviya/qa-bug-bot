import { BugReport, BDDScenario } from "../types";

const API_ENDPOINT = '/api/generate';

// Helper: fetch with 60s timeout (Gemini can be slow on free tier)
const fetchWithTimeout = async (url: string, body: Record<string, unknown>) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
};

// Parse error response from the API
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.text();
    // Try to parse as JSON to get the detailed error
    try {
      const json = JSON.parse(body);
      // Show details if available, otherwise show error
      if (json.details) {
        return `${json.error} (${json.details})`;
      }
      return json.error || body;
    } catch {
      return body || `Server returned ${response.status}`;
    }
  } catch {
    return `Server returned ${response.status}`;
  }
}

export async function generateBugReport(input: string): Promise<BugReport> {
  let response;
  try {
    response = await fetchWithTimeout(API_ENDPOINT, { action: 'bug-report', input });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("Request timed out. The AI is taking too long. Please try again.");
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) throw new Error("No response from server");
  return JSON.parse(text) as BugReport;
}

export async function generateBDDSteps(input: string): Promise<BDDScenario> {
  let response;
  try {
    response = await fetchWithTimeout(API_ENDPOINT, { action: 'bdd-steps', input });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("Request timed out. The AI is taking too long. Please try again.");
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) throw new Error("No response from server");
  return JSON.parse(text) as BDDScenario;
}
