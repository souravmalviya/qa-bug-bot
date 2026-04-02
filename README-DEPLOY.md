# Deploying to AWS Amplify Gen 2

This project has been configured for secure, production-ready deployment on AWS Amplify Gen 2.
The frontend React app talks to a secure AWS Lambda backend proxy which holds the Gemini API key.

## Initial Setup & Connecting to AWS

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket, or AWS CodeCommit).
2. Go to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/home).
3. Click **"Create new app"**.
4. Select your Git provider, authorize AWS, and select your repository and branch.
5. Amplify will auto-detect the `amplify.yml` build settings. Click **Next**.
6. **Save and Deploy**. (The first build will fail because we haven't set the API key yet — that's normal).

---

## Setting the Secure API Key

Amplify Gen 2 uses **Secrets** (not plain Environment Variables) for Lambda functions.

### Via Amplify CLI (Recommended):
```bash
npx ampx sandbox secret set GEMINI_API_KEY
# Paste your API key when prompted
```

### Via AWS Console:
1. Go to your App in the Amplify Console.
2. Navigate to **Hosting** → **Secrets**.
3. Add a new secret:
   - Name: `GEMINI_API_KEY`
   - Value: `AIzaSy...` (your actual Gemini API key)
4. Trigger a new build.

The Lambda proxy reads this key securely at runtime. The browser will never see it.

---

## Setting CORS Origins for Production

After your first successful deploy, you need to allow your production URL through CORS:

1. Go to your App in the Amplify Console.
2. Navigate to **Hosting** → **Environment Variables**.
3. Add these variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `AMPLIFY_URL` | `https://main.YOUR-APP-ID.amplifyapp.com` | Allows API Gateway CORS |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,https://main.YOUR-APP-ID.amplifyapp.com` | Allows Lambda CORS |

4. Trigger a new build for the changes to take effect.

> **Note:** Replace `YOUR-APP-ID` with your actual Amplify app ID (visible in the Amplify Console URL).

---

## Local Development

You have two ways to run this project locally.

### Option 1: Simplified Local Proxy (Recommended)
This uses a local Express server to mock the AWS environment. **This does not require AWS CLI credentials.**

1. Ensure your `.env.local` file contains your `GEMINI_API_KEY`.
2. Run:
   ```bash
   npm run dev
   ```
   *This starts both the React frontend and a local proxy concurrently.*

---

### Option 2: AWS Amplify Sandbox (Official)
Use this if you want to test exactly how it runs in the cloud. **Requires AWS CLI configuration.**

1. Set your secret locally for the sandbox:
   ```bash
   npx ampx sandbox secret set GEMINI_API_KEY
   ```
2. Start the sandbox:
   ```bash
   npx ampx sandbox
   ```
3. In a new terminal tab, start the frontend:
   ```bash
   npm run dev
   ```
   *(Note: The `npm run dev` script will automatically detect the sandbox outputs.)*
