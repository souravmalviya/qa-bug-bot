/**
 * Local development API server
 * 
 * This is a lightweight Express server that mimics Vercel's serverless
 * function routing for local development. It loads your OpenRouter API key
 * from .env.local and serves the /api/generate endpoint.
 * 
 * Usage: npm run dev
 * (runs this server on port 3001 + Vite on port 3000 concurrently)
 */

import express from 'express';
import dotenv from 'dotenv';
import { OpenRouter } from '@openrouter/sdk';

// Load .env.local
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json());

const OPENROUTER_MODEL = 'openai/gpt-5.2';
const PORT = 3001;

// ─── JSON Schema definitions ────────────────────────────────────────────────

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
      feature: { type: 'string' },
      scenario: { type: 'string' },
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

// ─── API Route ──────────────────────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  const timestamp = new Date().toISOString();

  try {
    const { action, input } = req.body || {};

    console.log(`[${timestamp}] Action: ${action}, Input length: ${input?.length || 0}`);

    if (!action || !input) {
      return res.status(400).json({ error: 'Missing required fields: action and input' });
    }

    if (typeof input !== 'string' || input.length > 5000) {
      return res.status(400).json({ error: 'Input must be a string of max 5000 characters' });
    }

    if (!['bug-report', 'bdd-steps'].includes(action)) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error(`[${timestamp}] ❌ OPENROUTER_API_KEY not found in .env.local`);
      return res.status(500).json({ 
        error: 'OPENROUTER_API_KEY not set. Create a .env.local file with: OPENROUTER_API_KEY=your_key_here' 
      });
    }

    console.log(`[${timestamp}] Using key: ${apiKey.substring(0, 10)}...`);
    const client = new OpenRouter({ apiKey });

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
      return res.send(content);
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
      return res.send(content);
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ❌ Error:`, err.message);

    if (err.status === 429 || err.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit reached. Please wait a moment and try again.',
        details: err.message,
      });
    }

    if (err.status === 401 || err.status === 403 || err.message?.includes('API key')) {
      return res.status(500).json({
        error: 'Invalid OpenRouter API key. Check your .env.local file.',
        details: err.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to generate content',
      details: err.message || 'Unknown error',
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

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
});
