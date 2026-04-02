import { defineBackend } from '@aws-amplify/backend';
import { geminiProxy } from './functions/gemini-proxy/resource';
import { Stack } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const backend = defineBackend({
  geminiProxy,
});

// Determine allowed origins for CORS.
// After your first deploy, set AMPLIFY_URL in Amplify Console → Environment Variables
// to your app's production URL (e.g. https://main.d1a2b3c4d5.amplifyapp.com).
// You can also set ALLOWED_ORIGIN for a custom domain.
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
if (process.env.AMPLIFY_URL) {
  allowedOrigins.push(process.env.AMPLIFY_URL);
}
if (process.env.ALLOWED_ORIGIN) {
  allowedOrigins.push(process.env.ALLOWED_ORIGIN);
}

// Create an API Gateway for the Lambda function
const apiStack = backend.createStack('api-stack');
const httpApi = new HttpApi(apiStack, 'HttpApi', {
  apiName: 'gemini-api',
  corsPreflight: {
    allowMethods: [
      CorsHttpMethod.GET,
      CorsHttpMethod.POST,
      CorsHttpMethod.OPTIONS,
    ],
    allowOrigins: allowedOrigins,
    allowHeaders: ['Content-Type'],
  },
});

// Create integration with our Lambda function
const lambdaIntegration = new HttpLambdaIntegration(
  'GeminiProxyIntegration',
  backend.geminiProxy.resources.lambda
);

// Map routes to the Lambda integration
httpApi.addRoutes({
  path: '/api/gemini',
  methods: [HttpMethod.POST, HttpMethod.OPTIONS],
  integration: lambdaIntegration,
});

// Output the API URL to be used by the frontend
backend.addOutput({
  custom: {
    apiUrl: httpApi.apiEndpoint,
  },
});
