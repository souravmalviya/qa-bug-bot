import { BugReport, BDDScenario } from "../types";

const API_ENDPOINT = '/api/generate';

// Helper: fetch with 30s timeout
const fetchWithTimeout = async (url: string, body: Record<string, unknown>) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 30000);
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

export async function generateBugReport(input: string): Promise<BugReport> {
  let response;
  try {
    response = await fetchWithTimeout(API_ENDPOINT, { action: 'bug-report', input });
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error("Request timed out. Please try again.");
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a minute and try again.');
    }
    throw new Error(`Server returned ${response.status}: ${errorBody}`);
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
    if (err.name === 'AbortError') throw new Error("Request timed out. Please try again.");
    throw new Error("Network error. Please check your connection and try again.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a minute and try again.');
    }
    throw new Error(`Server returned ${response.status}: ${errorBody}`);
  }

  const text = await response.text();
  if (!text) throw new Error("No response from server");
  return JSON.parse(text) as BDDScenario;
}
