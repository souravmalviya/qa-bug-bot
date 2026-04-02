/**
 * Local development API server
 * 
 * This is a lightweight Express server that mimics Vercel's serverless
 * function routing for local development. It loads your Gemini API key
 * from .env.local and serves the /api/generate endpoint.
 * 
 * Usage: npm run dev:local
 * (runs this server on port 3001 + Vite on port 3000 concurrently)
 */

import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

// Load .env.local
dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json());

const GEMINI_MODEL = 'gemini-3-flash-preview';
const PORT = 3001;

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error(`[${timestamp}] ❌ GEMINI_API_KEY not found in .env.local`);
      return res.status(500).json({ 
        error: 'GEMINI_API_KEY not set. Create a .env.local file with: GEMINI_API_KEY=your_key_here' 
      });
    }

    console.log(`[${timestamp}] Using key: ${apiKey.substring(0, 8)}...`);
    const ai = new GoogleGenAI({ apiKey });

    if (action === 'bug-report') {
      console.log(`[${timestamp}] 🐛 Generating bug report...`);
      const response = await ai.models.generateContent({
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
      });
      console.log(`[${timestamp}] ✅ Bug report generated`);
      return res.send(response.text ?? '');
    }

    if (action === 'bdd-steps') {
      console.log(`[${timestamp}] 📋 Generating BDD scenario...`);
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate a Gherkin BDD scenario for this feature: "${input}"`,
        config: {
          systemInstruction:
            'You are an expert Business Analyst and QA Specialist. Convert the input into a professional Gherkin BDD scenario. Ensure the feature and scenario names are descriptive. Use standard Given/When/Then/And keywords.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feature: { type: Type.STRING },
              scenario: { type: Type.STRING },
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
      });
      console.log(`[${timestamp}] ✅ BDD scenario generated`);
      return res.send(response.text ?? '');
    }
  } catch (err: any) {
    console.error(`[${timestamp}] ❌ Error:`, err.message);

    if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Gemini API quota exceeded. Free tier: ~15 requests/min. Wait 60 seconds.',
        details: err.message,
      });
    }

    if (err.status === 400 || err.status === 403 || err.message?.includes('API_KEY_INVALID')) {
      return res.status(500).json({
        error: 'Invalid Gemini API key. Get a new one at https://aistudio.google.com/apikey',
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
    hasApiKey: !!process.env.GEMINI_API_KEY,
    model: GEMINI_MODEL,
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Local API server running at http://127.0.0.1:${PORT}`);
  console.log(`   Health check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`   API key loaded: ${process.env.GEMINI_API_KEY ? '✅ Yes' : '❌ No (check .env.local)'}\n`);
});

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
});
