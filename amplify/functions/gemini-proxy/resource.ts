import { env } from '$amplify/env/gemini-proxy';
import { defineFunction } from '@aws-amplify/backend';

export const geminiProxy = defineFunction({
    name: 'gemini-proxy',
    entry: './handler.ts',
    timeoutSeconds: 30,
    environment: {
        // This connects the Lambda to the Amplify secret named GEMINI_API_KEY
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        // After first deploy, override ALLOWED_ORIGINS in Amplify Console → Environment Variables
        // to include your production domain (comma-separated).
        // e.g.: http://localhost:3000,https://main.d1a2b3c4d5.amplifyapp.com
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
    }
});
