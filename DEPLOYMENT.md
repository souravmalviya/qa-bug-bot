# AWS Amplify Deployment Guide — Onclusive QA Bugbot

> Comprehensive, step-by-step guide for deploying to AWS Amplify Gen 2.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1 — Connect Your Repository](#step-1--connect-your-repository)
4. [Step 2 — Store the Gemini API Key as a Secret](#step-2--store-the-gemini-api-key-as-a-secret)
5. [Step 3 — Configure CORS & Environment Variables](#step-3--configure-cors--environment-variables)
6. [Step 4 — Trigger a Production Build](#step-4--trigger-a-production-build)
7. [Step 5 — Post-Deploy Verification](#step-5--post-deploy-verification)
8. [Local Development](#local-development)
9. [Troubleshooting](#troubleshooting)
10. [Security Checklist](#security-checklist)

---

## Architecture Overview

```
┌─────────────┐      ┌───────────────────┐      ┌──────────────┐
│  React SPA  │─────▶│  API Gateway v2   │─────▶│  Lambda Fn   │
│  (Vite)     │      │  /api/gemini      │      │  handler.ts  │
│  dist/      │      │  (HTTP POST)      │      │  (Node 18)   │
└─────────────┘      └───────────────────┘      └──────┬───────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │  Google       │
                                                │  Gemini API   │
                                                │  (gemini-3-   │
                                                │   flash)      │
                                                └──────────────┘
```

- **Frontend**: React + Vite SPA served from Amplify Hosting (CloudFront CDN).
- **Backend**: A single Lambda function (`gemini-proxy`) behind API Gateway v2.  
  The Lambda holds the Gemini API key as an Amplify Secret — the browser never sees it.
- **Build config**: `amplify.yml` at project root drives CI/CD.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **AWS Account** | With permissions to create Amplify apps, Lambda functions |
| **Git Repository** | GitHub, GitLab, Bitbucket, or CodeCommit |
| **Node.js** | v18+ (matches Lambda runtime) |
| **Gemini API Key** | From [Google AI Studio](https://aistudio.google.com/apikey) |
| **AWS CLI** (optional) | Only needed for `ampx sandbox` local testing |

---

## Step 1 — Connect Your Repository

1. Push the codebase to a Git provider (GitHub recommended).
2. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify/home).
3. Click **"Create new app"** → select your Git provider → authorize.
4. Select your **repository** and **branch** (e.g., `main`).
5. Amplify auto-detects `amplify.yml`. Review the build settings and click **Next**.
6. Click **Save and Deploy**.

> **Note**: The first build will fail because the Gemini API key hasn't been set yet. That's expected.

---

## Step 2 — Store the Gemini API Key as a Secret

Amplify Gen 2 uses **Secrets** (not plain environment variables) for Lambda functions.  
The key is injected at runtime via `resource.ts` → `process.env.GEMINI_API_KEY`.

### Option A: Amplify CLI (Recommended)

```bash
# For sandbox (local cloud testing)
npx ampx sandbox secret set GEMINI_API_KEY
# Paste your key when prompted

# For production branch
npx ampx secret set GEMINI_API_KEY --branch main
```

### Option B: AWS Console

1. Navigate to your app in the Amplify Console.
2. Go to **Hosting** → **Secrets**.
3. Add a secret:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: your Gemini API key
4. Trigger a new build.

> ⚠️ **Security**: Never commit API keys to source code. The `.env.local` file is gitignored, but if your key was ever exposed, **rotate it** before going live.

---

## Step 3 — Configure CORS & Environment Variables

After the first successful deploy, configure CORS to allow your production domain.

Navigate to **Hosting** → **Environment Variables** and add:

| Variable | Value | Purpose |
|----------|-------|---------|
| `AMPLIFY_URL` | `https://main.YOUR-APP-ID.amplifyapp.com` | API Gateway CORS origin |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,https://main.YOUR-APP-ID.amplifyapp.com` | Lambda CORS allowlist |

Replace `YOUR-APP-ID` with your actual Amplify app ID (visible in the Console URL).

If you have a **custom domain**, add it to `ALLOWED_ORIGINS` as well:
```
https://qa.yourdomain.com
```

Trigger a **Redeploy** for changes to take effect.

---

## Step 4 — Trigger a Production Build

After setting secrets and environment variables:

1. Go to your app in the Amplify Console.
2. Click **Redeploy this version** or push a new commit to trigger CI/CD.
3. Monitor the build logs:
   - **Backend phase**: Runs `npx ampx pipeline-deploy` (deploys Lambda + API Gateway).
   - **Frontend phase**: Runs `npm ci` → `npm run build` (Vite build with 4 GB heap).
   - **Deploy phase**: Uploads `dist/` to CloudFront.

### Build Configuration (`amplify.yml`)

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci --cache .npm --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - NODE_OPTIONS=--max-old-space-size=4096 npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .npm/**/*
```

> The `NODE_OPTIONS=--max-old-space-size=4096` flag prevents out-of-memory crashes during Vite builds on Amplify's constrained build containers.

---

## Step 5 — Post-Deploy Verification

After a successful build, verify the deployment:

### 1. Frontend Loads
- Visit `https://main.YOUR-APP-ID.amplifyapp.com`
- Confirm the React SPA loads with the navbar, BDD Generator, and Bug Creator pages.

### 2. API Connectivity
- Open browser DevTools → Network tab.
- Submit a BDD generation request.
- Verify the POST goes to `/api/gemini` and returns a `200` response.

### 3. Error Handling
- Submit an excessively long input (>5000 chars via API tool) → should return `400`.
- If Gemini quota is exceeded → should return `429` with a clear user-facing message.

### 4. CORS
- In the Network tab, verify the `Access-Control-Allow-Origin` response header matches your domain.

---

## Local Development

### Recommended: Local Proxy (No AWS CLI needed)

1. Ensure `.env.local` contains:
   ```
   GEMINI_API_KEY=your-key-here
   ```

2. Run:
   ```bash
   npm run dev
   ```
   This starts both the React frontend (port 3000) and the local Express proxy (port 3005) concurrently. Vite proxies `/api/gemini` → `http://127.0.0.1:3005/api/gemini`.

### Alternative: Amplify Sandbox (Full cloud simulation)

```bash
# Set the secret for sandbox
npx ampx sandbox secret set GEMINI_API_KEY

# Start the sandbox (deploys real Lambda + API GW in your AWS account)
npx ampx sandbox

# In another terminal
npm run dev
```

---

## Troubleshooting

### Build Fails with OOM (Out of Memory)
- **Cause**: Vite builds on Amplify's constrained containers can run out of heap memory.
- **Fix**: The `NODE_OPTIONS=--max-old-space-size=4096` flag in `amplify.yml` addresses this. If still failing, increase to `8192`.

### Build Fails: "Missing GEMINI_API_KEY"
- **Cause**: The secret wasn't set for the deployed branch.
- **Fix**: Set it via CLI (`npx ampx secret set GEMINI_API_KEY --branch main`) or via the Amplify Console Secrets panel.

### CORS Errors in Browser
- **Cause**: The production URL isn't in the `ALLOWED_ORIGINS` environment variable.
- **Fix**: Add your exact production URL (including `https://`) to `ALLOWED_ORIGINS` in Environment Variables and redeploy.

### 429 Rate Limit Errors
- **Cause**: Gemini API free-tier quota exceeded.
- **Fix**: Wait 60 seconds, or upgrade to a paid Google AI plan for higher rate limits.

### API Returns 500 "Server misconfiguration"
- **Cause**: `GEMINI_API_KEY` is not set or is empty in the Lambda environment.
- **Fix**: Verify the secret is set correctly in the Amplify Console and redeploy.

### `amplify_outputs.json` is empty `{}`
- **Cause**: Normal for local dev when not using `ampx sandbox`. The frontend falls back to the Vite proxy.
- **Fix**: No action needed for local dev. For production, `ampx pipeline-deploy` generates this file during the CI build.

---

## Security Checklist

- [ ] **API key is stored as an Amplify Secret**, not as a plain environment variable
- [ ] **`.env.local` is gitignored** (verified in `.gitignore`)
- [ ] **API key has been rotated** if it was ever committed or exposed
- [ ] **Server-side input validation** enforces max 5000 characters (`handler.ts`)
- [ ] **CORS allowlist** is correctly configured with only your domains
- [ ] **No secrets or keys** appear in the frontend bundle (check `dist/` after build)

---

## File Reference

| File | Role |
|------|------|
| `amplify.yml` | CI/CD build configuration |
| `amplify/backend.ts` | Amplify backend definition (API Gateway + Lambda) |
| `amplify/functions/gemini-proxy/resource.ts` | Lambda function definition + secret injection |
| `amplify/functions/gemini-proxy/handler.ts` | Lambda handler (Gemini API proxy) |
| `vite.config.ts` | Vite config with dev proxy for `/api/gemini` |
| `local-server.ts` | Express server for local development |
| `.env.local` | Local API key (gitignored) |
| `services/geminiService.ts` | Frontend API service layer |
