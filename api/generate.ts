import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// Simple in-memory rate limiter (per serverless instance)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;   // generous limit per IP per minute

// ─── Retry Configuration (tuned for Vercel's 30s function timeout) ───────────
// Total time budget: 25s (leaves 5s headroom for cold-start + response serialization)
// Max retries: 3  → delays of ~500ms, ~1s, ~2s (with jitter) = ~3.5s worst-case wait
// Per-call timeout: 8s via AbortController so one slow call can't eat the budget
const RETRY_CONFIG = {
  maxRetries: 3,
  /** Base delay in ms; actual delay = base * 2^attempt + random jitter */
  baseDelayMs: 500,
  /** Hard ceiling for the entire retry loop (ms). Must be < Vercel timeout. */
  timeBudgetMs: 25_000,
  /** Max time a single Gemini API call is allowed before we abort it (ms). */
  perCallTimeoutMs: 8_000,
};

/**
 * Wraps a Gemini API call with automatic retry + exponential backoff.
 *
 * Design decisions for serverless (Vercel):
 *  • Short delays with jitter so concurrent invocations don't all retry at
 *    the exact same instant (thundering-herd avoidance).
 *  • A hard time-budget ensures we ALWAYS respond before Vercel kills us.
 *  • Per-call AbortController timeout prevents a single hanging request from
 *    consuming the entire budget.
 *  • Only 503 / UNAVAILABLE errors trigger retries; everything else throws
 *    immediately so the caller's catch block can return the right HTTP status.
 *
 * @param generateFn  A zero-arg async function that calls `ai.models.generateContent()`
 * @param maxRetries  Override the default retry count (default: 3)
 */
async function generateContentWithRetry<T>(
  generateFn: () => Promise<T>,
  maxRetries = RETRY_CONFIG.maxRetries,
): Promise<T> {
  const deadline = Date.now() + RETRY_CONFIG.timeBudgetMs;
  let attempt = 0;

  while (true) {
    // ── Guard: bail out if we're about to exceed the time budget ──
    const remaining = deadline - Date.now();
    if (remaining < 2_000) {
      // Less than 2s left – not enough time for another attempt + response
      throw Object.assign(new Error('503 UNAVAILABLE – retry budget exhausted'), { status: 503 });
    }

    try {
      // Race the actual API call against a per-call timeout
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
      // ── Determine if this is a retryable 503 error ──
      const is503 =
        error.status === 503 ||
        error.message?.includes('503') ||
        error.message?.includes('UNAVAILABLE') ||
        error.message?.includes('high demand');

      if (!is503 || attempt >= maxRetries) {
        // Non-retryable error OR we've used all our retries → surface it
        throw error;
      }

      attempt++;

      // Exponential delay: 500ms → 1000ms → 2000ms  (+ up to 300ms random jitter)
      const backoff = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 300);
      const delay = Math.min(backoff + jitter, remaining - 2_000); // never exceed budget

      console.warn(
        `[Retry] 503 UNAVAILABLE – attempt ${attempt}/${maxRetries} in ${delay}ms ` +
        `(${Math.round((deadline - Date.now()) / 1000)}s remaining)`,
      );

      // Async sleep – does NOT block the event loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}


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

// Pick the best available model. The free-tier Gemini key works with these.
const GEMINI_MODEL = 'gemini-3-flash-preview';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const timestamp = new Date().toISOString();

  // Rate limiting (our own, not Gemini's)
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    console.warn(`[${timestamp}] Rate limited IP: ${clientIp}`);
    return res.status(429).json({ error: 'Too many requests from your IP. Please wait a minute and try again.' });
  }

  try {
    const { action, input } = req.body || {};

    console.log(`[${timestamp}] Action: ${action}, Input length: ${input?.length || 0}`);

    // Validate required fields
    if (!action || !input) {
      return res.status(400).json({ error: 'Missing required fields: action and input' });
    }

    // Validate input type and length
    if (typeof input !== 'string' || input.length > 5000) {
      return res.status(400).json({ error: 'Input must be a string of max 5000 characters' });
    }

    // Validate action
    if (!['bug-report', 'bdd-steps'].includes(action)) {
      return res.status(400).json({ error: `Unknown action: ${action}. Use 'bug-report' or 'bdd-steps'.` });
    }

    // Read API key from server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(`[${timestamp}] GEMINI_API_KEY is not configured`);
      return res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY environment variable is not set. Add it in Vercel Dashboard → Settings → Environment Variables.' });
    }

    // Log a masked version of the key for debugging
    console.log(`[${timestamp}] Using API key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'bug-report') {
      console.log(`[${timestamp}] Generating bug report with model: ${GEMINI_MODEL}`);
      const response = await generateContentWithRetry(() =>
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
        })
      );

      console.log(`[${timestamp}] Bug report generated successfully`);
      return res.status(200).send(response.text ?? '');
    }

    if (action === 'bdd-steps') {
      console.log(`[${timestamp}] Generating BDD scenario with model: ${GEMINI_MODEL}`);
      const response = await generateContentWithRetry(() =>
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
        })
      );

      console.log(`[${timestamp}] BDD scenario generated successfully`);
      return res.status(200).send(response.text ?? '');
    }
  } catch (err: any) {
    console.error(`[${timestamp}] Server Error:`, JSON.stringify({
      message: err.message,
      status: err.status,
      statusText: err.statusText,
      name: err.name,
      stack: err.stack?.substring(0, 500),
    }));

    // Detect Gemini API rate-limit / quota errors specifically
    const isQuotaError =
      err.status === 429 ||
      err.message?.includes('RESOURCE_EXHAUSTED') ||
      err.message?.includes('quota') ||
      err.message?.includes('429');

    if (isQuotaError) {
      return res.status(429).json({
        error: 'Gemini API quota exceeded. The free tier allows ~15 requests/minute. Please wait 60 seconds and try again, or use a paid API key.',
        details: err.message,
      });
    }

    // Detect 503 UNAVAILABLE / High Demand error (passed through if max retries exceeded)
    const is503Error = 
      err.status === 503 || 
      err.message?.includes('503') || 
      err.message?.includes('UNAVAILABLE') ||
      err.message?.includes('high demand');
      
    if (is503Error) {
      return res.status(503).json({
        error: 'The AI service is currently experiencing high demand. Please try again in a few seconds.',
        details: err.message,
      });
    }

    // Check for invalid API key
    if (err.status === 400 || err.status === 403 || err.message?.includes('API_KEY_INVALID') || err.message?.includes('PERMISSION_DENIED')) {
      return res.status(500).json({
        error: 'Invalid or unauthorized Gemini API key. Please check your key in Vercel environment variables.',
        details: err.message,
      });
    }

    // Check for model not found
    if (err.status === 404 || err.message?.includes('not found') || err.message?.includes('NOT_FOUND')) {
      return res.status(500).json({
        error: `Model "${GEMINI_MODEL}" not available for your API key. Check Google AI Studio for available models.`,
        details: err.message,
      });
    }

    // Generic error with actual details
    return res.status(500).json({
      error: 'Failed to generate content. See details for more info.',
      details: err.message || 'Unknown error',
    });
  }
}
