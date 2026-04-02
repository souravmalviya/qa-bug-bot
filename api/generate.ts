import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

// Simple in-memory rate limiter (per serverless instance)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;   // max requests per window per IP

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

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    console.warn(`[${timestamp}] Rate limited IP: ${clientIp}`);
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
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
      return res.status(500).json({ error: 'Server misconfiguration: API key not set' });
    }

    const ai = new GoogleGenAI({ apiKey });

    if (action === 'bug-report') {
      console.log(`[${timestamp}] Generating bug report`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
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

      console.log(`[${timestamp}] Bug report generated successfully`);
      return res.status(200).send(response.text ?? '');
    }

    if (action === 'bdd-steps') {
      console.log(`[${timestamp}] Generating BDD scenario`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
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
      });

      console.log(`[${timestamp}] BDD scenario generated successfully`);
      return res.status(200).send(response.text ?? '');
    }
  } catch (err: any) {
    console.error(`[${timestamp}] Server Error:`, err);

    // Detect Gemini API rate-limit / quota errors
    const isGeminiRateLimit =
      err.status === 429 ||
      err.message?.includes('RESOURCE_EXHAUSTED') ||
      err.message?.includes('quota');

    if (isGeminiRateLimit) {
      return res.status(429).json({
        error: 'Gemini API rate limit exceeded. Please wait a minute and try again.',
      });
    }

    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
