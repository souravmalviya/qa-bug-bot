import { GoogleGenAI, Type } from '@google/genai';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// IMPORTANT: On AWS Amplify, GEMINI_API_KEY is injected by resource.ts into
// process.env automatically. No special import is needed.
// Locally, it is loaded from .env.local by local-server.ts.

// Allowed origins for CORS (comma-separated in env, or defaults to localhost)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',');

const getCorsHeaders = (origin?: string) => {
    const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS, POST',
    };
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    const timestamp = new Date().toISOString();
    const origin = event.headers?.origin || event.headers?.Origin;
    const corsHeaders = getCorsHeaders(origin);

    console.log(`[${timestamp}] Incoming request from origin: ${origin}`);

    // Handle CORS preflight
    if (event.requestContext.http.method === 'OPTIONS') {
        console.log(`[${timestamp}] CORS preflight request handled`);
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action, input } = body;

        console.log(`[${timestamp}] Processing action: ${action}, input length: ${input?.length || 0}`);

        if (!input || !action) {
            console.warn(`[${timestamp}] Missing action or input`);
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing action or input' }) };
        }

        // Server-side input length guard (client limits to 2000, but enforce server-side too)
        if (typeof input !== 'string' || input.length > 5000) {
            console.warn(`[${timestamp}] Input validation failed - too long: ${input?.length || 0} chars`);
            return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Input too long (max 5000 characters)' }) };
        }

        // Read the API key from process.env.
        // - On AWS Amplify: injected by resource.ts from Amplify secrets.
        // - Locally: loaded from .env.local by local-server.ts.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error(`[${timestamp}] Missing GEMINI_API_KEY in Lambda environment`);
            return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Server misconfiguration' }) };
        }

        const ai = new GoogleGenAI({ apiKey });

        if (action === 'bug-report') {
            console.log(`[${timestamp}] Generating bug report`);
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Transform this brief bug description into a structured report: "${input}"`,
                config: {
                    systemInstruction: 'You are an expert QA Engineer at Onclusive. Generate a structured bug report. The summary must be 12 words or less. Be precise and professional.',
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            stepsToReproduce: { type: Type.ARRAY, items: { type: Type.STRING } },
                            expectedResult: { type: Type.STRING },
                            actualResult: { type: Type.STRING },
                            severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                            category: { type: Type.STRING }
                        },
                        required: ['summary', 'stepsToReproduce', 'expectedResult', 'actualResult', 'severity', 'category']
                    }
                },
            });
            console.log(`[${timestamp}] Bug report generated successfully`);
            return { statusCode: 200, headers: corsHeaders, body: response.text ?? '' };
        }

        if (action === 'bdd-steps') {
            console.log(`[${timestamp}] Generating BDD scenario`);
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Generate a Gherkin BDD scenario for this feature: "${input}"`,
                config: {
                    systemInstruction: 'You are an expert Business Analyst and QA Specialist. Convert the input into a professional Gherkin BDD scenario. Ensure the feature and scenario names are descriptive. Use standard Given/When/Then/And keywords.',
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
                                        text: { type: Type.STRING }
                                    },
                                    required: ['keyword', 'text']
                                }
                            }
                        },
                        required: ['feature', 'scenario', 'steps']
                    }
                },
            });
            console.log(`[${timestamp}] BDD scenario generated successfully`);
            return { statusCode: 200, headers: corsHeaders, body: response.text ?? '' };
        }

        console.warn(`[${timestamp}] Unknown action: ${action}`);
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Unknown action' }) };

    } catch (err: any) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] Lambda Error:`, err);

        // Detect Gemini API rate-limit / quota errors
        const isRateLimit =
            err.status === 429 ||
            err.message?.includes('RESOURCE_EXHAUSTED') ||
            err.message?.includes('quota');

        if (isRateLimit) {
            console.warn(`[${timestamp}] Rate limit detected`);
            return {
                statusCode: 429,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Gemini API rate limit exceeded. Please wait a minute and try again, or upgrade your Google AI plan for higher limits.',
                }),
            };
        }

        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message || 'Internal Server Error' }) };
    }
};
