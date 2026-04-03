import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OpenRouter } from '@openrouter/sdk';

// ─── Constants ───────────────────────────────────────────────────────────────
const OPENROUTER_MODEL = 'openai/gpt-5.2';

// ─── Singleton OpenRouter client (reused across requests in the same instance) ─
let _client: OpenRouter | null = null;
function getClient(): OpenRouter {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    _client = new OpenRouter({ apiKey });
  }
  return _client;
}

// ─── Retry Configuration (tuned for Vercel Hobby 30 s timeout) ──────────────
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 1_000,
  timeBudgetMs: 25_000,
  perCallTimeoutMs: 15_000,
};

/**
 * Retry wrapper for OpenRouter API calls.
 *
 * Retries on transient 5xx / 429 errors only.
 * All other errors (400, 403, 404 etc.) are thrown immediately.
 */
async function callWithRetry<T>(
  callFn: () => Promise<T>,
  maxRetries = RETRY_CONFIG.maxRetries,
): Promise<T> {
  const deadline = Date.now() + RETRY_CONFIG.timeBudgetMs;
  let attempt = 0;

  while (true) {
    const remaining = deadline - Date.now();

    if (remaining < 2_000) {
      throw Object.assign(
        new Error('Service temporarily unavailable — retry budget exhausted'),
        { status: 503 },
      );
    }

    try {
      return await Promise.race([
        callFn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(Object.assign(new Error('API call timed out'), { status: 503 })),
            Math.min(RETRY_CONFIG.perCallTimeoutMs, remaining - 1_000),
          ),
        ),
      ]);
    } catch (error: any) {
      const isRetryable =
        error.status === 503 ||
        error.status === 502 ||
        error.status === 429 ||
        error.message?.includes('503') ||
        error.message?.includes('429') ||
        error.message?.includes('overloaded');

      if (!isRetryable || attempt >= maxRetries) {
        throw error;
      }

      attempt++;
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

// ─── JSON Schema definitions for structured output ──────────────────────────

const BUG_REPORT_SCHEMA = {
  name: 'bug_report',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string' },
      stepsToReproduce: { type: 'array', items: { type: 'string' } },
      expectedResult: { type: 'string' },
      actualResult: { type: 'string' },
      severity: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
      category: { type: 'string' },
    },
    required: ['summary', 'stepsToReproduce', 'expectedResult', 'actualResult', 'severity', 'category'],
    additionalProperties: false,
  },
};

const BDD_SCENARIO_SCHEMA = {
  name: 'bdd_scenario',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      feature: { type: 'string', description: 'The high-level feature name.' },
      scenario: { type: 'string', description: 'The specific scenario being tested.' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            keyword: { type: 'string', enum: ['Given', 'When', 'Then', 'And'] },
            text: { type: 'string' },
          },
          required: ['keyword', 'text'],
          additionalProperties: false,
        },
      },
    },
    required: ['feature', 'scenario', 'steps'],
    additionalProperties: false,
  },
};

// ─── Vercel Handler ──────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS — restrict to known origins ──
  const ALLOWED_ORIGINS = [
    'https://qa-bug-bot.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.removeHeader('X-Powered-By');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();

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

    const client = getClient();
    console.log(`[${requestId}] ${timestamp} | ${action} | ${input.length} chars`);

    // ── Bug report generation ──
    if (action === 'bug-report') {
      const response = await callWithRetry(() =>
        client.chat.send({
          chatRequest: {
            model: OPENROUTER_MODEL,
            messages: [
              {
                role: 'system',
                content: 'You are an expert QA Engineer at Onclusive. Generate a structured bug report. The summary must be 12 words or less. Be precise and professional.',
              },
              {
                role: 'user',
                content: `Transform this brief bug description into a structured report: "${input}"`,
              },
            ],
            stream: false,
            maxTokens: 2000,
            responseFormat: {
              type: 'json_schema',
              jsonSchema: BUG_REPORT_SCHEMA,
            },
          },
        }),
      );

      const content = (response as any).choices?.[0]?.message?.content ?? '';
      console.log(`[${timestamp}] Bug report generated OK`);
      return res.status(200).send(content);
    }

    // ── BDD scenario generation ──
    if (action === 'bdd-steps') {
      const response = await callWithRetry(() =>
        client.chat.send({
          chatRequest: {
            model: OPENROUTER_MODEL,
            messages: [
              {
                role: 'system',
                content: 'You are an expert Business Analyst and QA Specialist. Convert the input into a professional Gherkin BDD scenario. Ensure the feature and scenario names are descriptive. Use standard Given/When/Then/And keywords.',
              },
              {
                role: 'user',
                content: `Generate a Gherkin BDD scenario for this feature: "${input}"`,
              },
            ],
            stream: false,
            maxTokens: 2000,
            responseFormat: {
              type: 'json_schema',
              jsonSchema: BDD_SCENARIO_SCHEMA,
            },
          },
        }),
      );

      const content = (response as any).choices?.[0]?.message?.content ?? '';
      console.log(`[${timestamp}] BDD scenario generated OK`);
      return res.status(200).send(content);
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ERROR`, {
      message: err.message,
      status: err.status,
      name: err.name,
    });

    const status = err.status;
    const msg = err.message ?? '';

    // 429 / Rate limit
    if (status === 429 || msg.includes('429') || msg.includes('rate limit')) {
      return res.status(429).json({
        error: 'The AI service is busy right now. Please wait about 30 seconds and try again.',
      });
    }

    // 503 / Overload (after retries exhausted)
    if (status === 503 || status === 502 || msg.includes('503') || msg.includes('overloaded')) {
      return res.status(503).json({
        error: 'The AI service is currently experiencing high demand. Please try again in a few seconds.',
      });
    }

    // Invalid API key
    if (status === 401 || status === 403 || msg.includes('API key') || msg.includes('PERMISSION_DENIED')) {
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

    // Missing API key (thrown by getClient)
    if (msg.includes('OPENROUTER_API_KEY is not configured')) {
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
