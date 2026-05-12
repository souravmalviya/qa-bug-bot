/**
 * Local development API server
 *
 * Mimics Vercel's serverless function routing for local development.
 * Loads the OpenRouter API key from .env.local and serves /api/generate.
 *
 * Usage: npm run dev
 * (runs this server on port 3001 + Vite on port 3000 concurrently)
 */

import express from 'express';
import dotenv from 'dotenv';
import { OpenRouter } from '@openrouter/sdk';
import { verifyToken } from '@clerk/backend';
import {
  OPENROUTER_MODEL,
  MAX_INPUT_LENGTH,
  BUG_REPORT_SCHEMA,
  BDD_SCENARIO_SCHEMA,
} from './api/schemas';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json());

const PORT = 3001;

// ─── Singleton client ────────────────────────────────────────────────────────
let _client: OpenRouter | null = null;
function getClient(): OpenRouter {
  if (!_client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not set. Create a .env.local file with: OPENROUTER_API_KEY=your_key_here');
    }
    _client = new OpenRouter({ apiKey });
  }
  return _client;
}

// ─── API Route ──────────────────────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const timestamp = new Date().toISOString();

  // ── Auth — verify Clerk session token ──
  const authHeader = (req.headers.authorization as string) ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.warn(`[${timestamp}] ⚠️  CLERK_SECRET_KEY not set — skipping token verification in dev`);
  } else {
    try {
      await verifyToken(token, { secretKey: clerkSecretKey });
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
  }

  try {
    const { action, input } = req.body || {};

    console.log(`[${timestamp}] Action: ${action}, Input length: ${input?.length || 0}`);

    if (!action || !input) {
      return res.status(400).json({ error: 'Missing required fields: action and input' });
    }

    if (typeof input !== 'string' || input.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ error: `Input must be a string of at most ${MAX_INPUT_LENGTH} characters` });
    }

    if (!['bug-report', 'bdd-steps'].includes(action)) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const client = getClient();

    if (action === 'bug-report') {
      console.log(`[${timestamp}] 🐛 Generating bug report...`);
      const response = await client.chat.send({
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
      });
      const content = (response as any).choices?.[0]?.message?.content ?? '';
      console.log(`[${timestamp}] ✅ Bug report generated`);
      try {
        return res.json(JSON.parse(content));
      } catch {
        return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
      }
    }

    if (action === 'bdd-steps') {
      console.log(`[${timestamp}] 📋 Generating BDD scenario...`);
      const response = await client.chat.send({
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
      });
      const content = (response as any).choices?.[0]?.message?.content ?? '';
      console.log(`[${timestamp}] ✅ BDD scenario generated`);
      try {
        return res.json(JSON.parse(content));
      } catch {
        return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
      }
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ❌ Error:`, err.message);

    if (err.message?.includes('OPENROUTER_API_KEY not set')) {
      return res.status(500).json({ error: err.message });
    }

    if (err.status === 429 || err.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit reached. Please wait a moment and try again.',
      });
    }

    if (err.status === 401 || err.status === 403 || err.message?.includes('API key')) {
      return res.status(500).json({
        error: 'Invalid OpenRouter API key. Check your .env.local file.',
      });
    }

    return res.status(500).json({
      error: 'Failed to generate content',
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.OPENROUTER_API_KEY,
    model: OPENROUTER_MODEL,
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Local API server running at http://127.0.0.1:${PORT}`);
  console.log(`   Health check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`   API key loaded: ${process.env.OPENROUTER_API_KEY ? '✅ Yes' : '❌ No (check .env.local)'}\n`);
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
});
