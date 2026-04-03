import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// ─── Constants ───────────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-3-flash-preview';

// ─── Singleton Gemini client (reused across requests in the same instance) ───
// Creating the client once avoids repeated SDK initialisation overhead.
let _aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!_aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    _aiClient = new GoogleGenAI({ apiKey });
  }
  return _aiClient;
}

// ─── Per-IP Rate Limiter ─────────────────────────────────────────────────────
// Gemini free tier: 15 RPM *per API key* (shared across ALL users).
// We cap each IP to 10 RPM so that a single user can never exhaust the full
// key quota, leaving room for other concurrent users.
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

// ─── Retry Configuration (tuned for Vercel Hobby 30 s timeout) ──────────────
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,          // 500ms → 1s → 2s
  timeBudgetMs: 25_000,      // hard ceiling (leaves 5 s for cold-start + serialisation)
  perCallTimeoutMs: 8_000,   // max time each Gemini call gets before we abort
};

/**
 * Retry wrapper for Gemini API calls.
 *
 * Retries on:
 *  - 503  UNAVAILABLE  (model overloaded / high demand)
 *  - 429  RESOURCE_EXHAUSTED  (rate limit hit — resets within seconds)
 *
 * Every other error is thrown immediately (400, 403, 404 etc.).
 *
 * Safety features for serverless:
 *  • 25 s hard time-budget so we always respond before Vercel kills us.
 *  • Per-call timeout via Promise.race prevents one slow call from eating the budget.
 *  • Random jitter avoids thundering-herd when many retries fire simultaneously.
 */
async function generateContentWithRetry<T>(
  generateFn: () => Promise<T>,
  maxRetries = RETRY_CONFIG.maxRetries,
): Promise<T> {
  const deadline = Date.now() + RETRY_CONFIG.timeBudgetMs;
  let attempt = 0;

  while (true) {
    const remaining = deadline - Date.now();

    // Not enough time for another attempt — fail fast
    if (remaining < 2_000) {
      throw Object.assign(
        new Error('Service temporarily unavailable — retry budget exhausted'),
        { status: 503 },
      );
    }

    try {
      // Race the API call against a per-call timeout
      return await Promise.race([
        generateFn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(Object.assign(new Error('Gemini call timed out'), { status: 503 })),
            Math.min(RETRY_CONFIG.perCallTimeoutMs, remaining - 1_000),
          ),
        ),
      ]);
    } catch (error: any) {
      // Determine if this is a retryable transient error
      const isRetryable =
        error.status === 503 ||
        error.status === 429 ||
        error.message?.includes('503') ||
        error.message?.includes('429') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.message?.includes('high demand') ||
        error.message?.includes('overloaded');

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      attempt++;

      // Exponential backoff: 500 ms → 1 s → 2 s  (+  up to 500 ms random jitter)
      const backoff = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.min(backoff + jitter, remaining - 2_000);

      console.warn(
        `[Retry] ${error.status ?? '???'} – attempt ${attempt}/${maxRetries} ` +
        `in ${delay}ms (${Math.round((deadline - Date.now()) / 1000)}s left)`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ─── Request Queue ───────────────────────────────────────────────────────────
// Serialise Gemini calls from the same serverless instance so we don't send
// multiple concurrent requests that would immediately trip the 15 RPM limit.
let _queue: Promise<any> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = _queue.then(fn, fn);   // run fn whether previous resolved or rejected
  _queue = p.catch(() => {});      // swallow so the chain doesn't break
  return p;
}

// ─── Vercel Handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const timestamp = new Date().toISOString();

  // ── Per-IP rate limiting ──
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    console.warn(`[${timestamp}] Rate-limited IP: ${clientIp}`);
    return res.status(429).json({
      error: 'You are sending too many requests. Please wait a minute and try again.',
    });
  }

  try {
    const { action, input } = req.body || {};

    // ── Validation ──
    if (!action || !input) {
      return res.status(400).json({ error: 'Missing required fields: action and input.' });
    }
    if (typeof input !== 'string' || input.length > 5000) {
      return res.status(400).json({ error: 'Input must be a string of at most 5 000 characters.' });
    }
    if (!['bug-report', 'bdd-steps'].includes(action)) {
      return res.status(400).json({ error: `Unknown action: "${action}". Use "bug-report" or "bdd-steps".` });
    }

    const ai = getAIClient();
    console.log(`[${timestamp}] ${action} | input length ${input.length}`);

    // ── Bug report generation ──
    if (action === 'bug-report') {
      const response = await enqueue(() =>
        generateContentWithRetry(() =>
          ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Transform this brief bug description into a structured report: "${input}"`,
            config: {
              systemInstruction:
                'You are an expert QA Engineer at Onclusive. Generate a structured bug report. The summary must be 12 words or less. Be precise and professional.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  stepsToReproduce: { type: Type.ARRAY, items: { type: Type.STRING } },
                  expectedResult: { type: Type.STRING },
                  actualResult: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                  category: { type: Type.STRING },
                },
                required: ['summary', 'stepsToReproduce', 'expectedResult', 'actualResult', 'severity', 'category'],
              },
            },
          }),
        ),
      );
      console.log(`[${timestamp}] Bug report generated OK`);
      return res.status(200).send(response.text ?? '');
    }

    // ── BDD scenario generation ──
    if (action === 'bdd-steps') {
      const response = await enqueue(() =>
        generateContentWithRetry(() =>
          ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `Generate a Gherkin BDD scenario for this feature: "${input}"`,
            config: {
              systemInstruction:
                'You are an expert Business Analyst and QA Specialist. Convert the input into a professional Gherkin BDD scenario. Ensure the feature and scenario names are descriptive. Use standard Given/When/Then/And keywords.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  feature: { type: Type.STRING, description: 'The high-level feature name.' },
                  scenario: { type: Type.STRING, description: 'The specific scenario being tested.' },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        keyword: { type: Type.STRING, enum: ['Given', 'When', 'Then', 'And'] },
                        text: { type: Type.STRING },
                      },
                      required: ['keyword', 'text'],
                    },
                  },
                },
                required: ['feature', 'scenario', 'steps'],
              },
            },
          }),
        ),
      );
      console.log(`[${timestamp}] BDD scenario generated OK`);
      return res.status(200).send(response.text ?? '');
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ERROR`, {
      message: err.message,
      status: err.status,
      name: err.name,
    });

    // ── Map errors to clean, user-friendly responses ──
    // Users should NEVER see raw "RESOURCE_EXHAUSTED" or stack traces.

    const status = err.status;
    const msg = err.message ?? '';

    // 429 / Quota errors
    if (
      status === 429 ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('quota') ||
      msg.includes('429')
    ) {
      return res.status(429).json({
        error: 'The AI service is busy right now. Please wait about 30 seconds and try again.',
      });
    }

    // 503 / Overload errors (after retries exhausted)
    if (
      status === 503 ||
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('overloaded')
    ) {
      return res.status(503).json({
        error: 'The AI service is currently experiencing high demand. Please try again in a few seconds.',
      });
    }

    // Invalid API key
    if (
      status === 400 || status === 403 ||
      msg.includes('API_KEY_INVALID') ||
      msg.includes('PERMISSION_DENIED')
    ) {
      return res.status(500).json({
        error: 'Server configuration error. Please contact the administrator.',
      });
    }

    // Model not found
    if (status === 404 || msg.includes('not found') || msg.includes('NOT_FOUND')) {
      return res.status(500).json({
        error: 'The AI model is currently unavailable. Please try again later.',
      });
    }

    // Missing API key (thrown by getAIClient)
    if (msg.includes('GEMINI_API_KEY is not configured')) {
      return res.status(500).json({
        error: 'Server configuration error. Please contact the administrator.',
      });
    }

    // Catch-all
    return res.status(500).json({
      error: 'Something went wrong. Please try again later.',
    });
  }
}
