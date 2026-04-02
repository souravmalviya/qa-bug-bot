import express from 'express';
import { handler } from './amplify/functions/gemini-proxy/handler';
import dotenv from 'dotenv';
import cors from 'cors';

// Load .env.local first (for local development with real API key)
// Then load .env as fallback (for production placeholder)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const app = express();
app.use(cors());
app.use(express.json());

// Friendly root route
app.get('/', (req, res) => {
    res.send('<h1>Onclusive QA Bugbot - API Proxy is Running</h1><p>The frontend should connect via Vite proxy at localhost:3000/api/gemini</p>');
});

// Set up the proxy route to hit our Lambda handler
app.all('/api/gemini', async (req, res) => {
    try {
        // Mock the API Gateway event object for the Lambda
        const event = {
            body: JSON.stringify(req.body),
            headers: {
                origin: req.headers.origin || 'http://localhost:3000',
            },
            requestContext: {
                http: {
                    method: req.method
                }
            }
        };

        // Inject the physical environment key dynamically for the Lambda
        // since we're bypassing Ampx sandbox.
        process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

        // @ts-ignore
        const result: any = await handler(event as any, {} as any, () => { });

        res.status(result.statusCode).set(result.headers || {}).send(result.body);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Local Proxy Error' });
    }
});

const PORT = 3005;
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[Local API Proxy] Running on http://127.0.0.1:${PORT}/api/gemini`);
}).on('error', (err) => {
    console.error('[Local API Proxy] Failed to start:', err);
});

// Graceful shutdown to prevent orphaned processes blocking the port
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
        server.close(() => {
            console.log(`\n[Local API Proxy] Shutting down cleanly...`);
            process.exit(0);
        });
    });
});
// Prevent silent crashes from unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
