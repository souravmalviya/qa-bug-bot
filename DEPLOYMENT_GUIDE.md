# 🚀 AWS Amplify Deployment Guide

## Pre-Deployment Checklist

### Security Requirements
- [ ] Rotate API key at [Google AI Studio](https://aistudio.google.com/apikey)
- [ ] Update `.env` with placeholder API key
- [ ] Create `.env.local` with actual API key (gitignored)
- [ ] Verify `.env` and `.env.local` are in `.gitignore`
- [ ] Commit code (without real API key exposed)

### Local Testing
- [ ] Run `npm install`
- [ ] Run `npm run lint` (verify no TypeScript errors)
- [ ] Run `npm run dev` and test both features locally
- [ ] Run `npm run build` and verify `dist/` is generated
- [ ] Test with `npm run preview`

### AWS Account Setup
- [ ] AWS Account created
- [ ] AWS CLI installed and configured
- [ ] Amplify CLI installed: `npm install -g @aws-amplify/cli`

---

## Deployment Steps

### Step 1: Initialize Amplify Project
```bash
cd c:\Users\Soura\OneDrive\Desktop\onc-qa-genbot-main

# Initialize Amplify (if not already done)
npx ampx sandbox

# Or for production deployment setup
npm install -g @aws-amplify/cli
amplify configure
```

### Step 2: Create & Store API Secret

#### Option A: Via AWS Secrets Manager Console
1. Go to [AWS Secrets Manager](https://console.aws.amazon.com/secretsmanager/)
2. Click "Store a new secret"
3. Choose "Other type of secret"
4. Paste JSON:
```json
{
  "GEMINI_API_KEY": "your_actual_api_key_here"
}
```
5. Name it: `gemini-proxy-secrets`
6. Store it

#### Option B: Via AWS CLI
```bash
aws secretsmanager create-secret \
  --name gemini-proxy-secrets \
  --secret-string '{"GEMINI_API_KEY":"your_actual_api_key_here"}' \
  --region us-east-1
```

### Step 3: Configure Amplify Backend

Update `amplify/functions/gemini-proxy/resource.ts`:

```typescript
import { env } from '$amplify/env/gemini-proxy';
import { defineFunction } from '@aws-amplify/backend';
import { secret } from '@aws-amplify/backend';

// Reference the secret created in Secrets Manager
const geminiApiKeySecret = secret('gemini-proxy-secrets');

export const geminiProxy = defineFunction({
    name: 'gemini-proxy',
    entry: './handler.ts',
    timeoutSeconds: 30,
    environment: {
        // Load from Amplify Secrets
        GEMINI_API_KEY: geminiApiKeySecret.resolve('GEMINI_API_KEY'),
        ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000'
    }
});
```

### Step 4: Deploy to AWS Amplify

#### Option A: Deploy via Amplify Console (Recommended)
1. Push code to GitHub
2. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
3. Create new app → Connect repository
4. Select your GitHub repo
5. Choose branch to deploy (main/develop)
6. Amplify will auto-deploy using `amplify.yml` configuration

#### Option B: Deploy via CLI
```bash
# Login to AWS
npx amplify login

# Deploy backend only
npx ampx deploy

# Or deploy with preview environment
npx amplify publish
```

### Step 5: Set Production Environment Variables

After first deployment completes:

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click your app → Settings → Environment variables
3. Add these variables:

| Key | Value | Example |
|-----|-------|---------|
| `AMPLIFY_URL` | Your Amplify app URL | `https://main.d1a2b3c4d5.amplifyapp.com` |
| `ALLOWED_ORIGIN` | Custom domain (optional) | `https://yourdomain.com` |
| `ALLOWED_ORIGINS` | Comma-separated origins | `https://main.d1a2b3c4d5.amplifyapp.com,https://yourdomain.com` |

**Finding your Amplify URL:**
- Go to Amplify Console → Hosting
- Look for "Domain" section at the top
- It's usually `https://main.xxxxx.amplifyapp.com`

### Step 6: Test Production Deployment

1. Open your Amplify app URL in browser
2. Test bug report generation
3. Test BDD scenario generation
4. Check CloudWatch logs for errors:
   - Go to [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)
   - Logs → Log groups → `/aws/lambda/gemini-proxy`
   - Verify requests are being processed with timestamps

---

## Troubleshooting

### Issue: 500 Error After Deployment

**Symptom:** API calls return 500 error

**Fix:**
1. Check CloudWatch logs for actual error
2. Verify `GEMINI_API_KEY` environment variable is set
3. Verify secret exists in AWS Secrets Manager
4. Check Lambda timeout isn't being exceeded (30s)

### Issue: 403 CORS Error

**Symptom:** Browser shows CORS error

**Fix:**
1. Get your actual Amplify app URL (e.g., `https://main.xxxxx.amplifyapp.com`)
2. Go to Amplify Console → Environment Variables
3. Update `AMPLIFY_URL` and `ALLOWED_ORIGINS` with correct URL
4. Redeploy frontend: `amplify publish`

### Issue: API Key Not Found

**Symptom:** Lambda logs show "Missing GEMINI_API_KEY"

**Fix:**
1. Verify secret exists in AWS Secrets Manager
2. Verify Lambda execution role has permission to access secret
3. Verify environment variable name matches exactly (case-sensitive)
4. Redeploy Lambda function

### Issue: Gemini API Rate Limit

**Symptom:** Error "rate limit exceeded"

**Fix:**
1. Google Gemini free tier has limits (~60 requests/minute)
2. Upgrade plan at [Google AI Studio](https://aistudio.google.com/apikey)
3. Or implement request queuing/caching on backend

---

## Monitoring & Logging

### CloudWatch Logs
Access logs at: [CloudWatch Console](https://console.aws.amazon.com/cloudwatch/)

Each request logs:
```
[2026-04-02T12:30:45.123Z] Incoming request from origin: https://main.xxxxx.amplifyapp.com
[2026-04-02T12:30:45.234Z] Processing action: bug-report, input length: 145
[2026-04-02T12:30:47.456Z] Bug report generated successfully
```

### Lambda Metrics
Go to Amplify → Monitoring:
- Invocations (request count)
- Duration (average response time)
- Errors (failed requests)
- Throttles (rate limit hits)

---

## Cost Considerations

### Estimated Monthly Costs
| Service | Estimate | Notes |
|---------|----------|-------|
| Lambda | $0.20 | 1M free calls/month, then $0.20/M |
| Amplify Hosting | $0-15 | Starts at $15/month for continuous deployment |
| Data Transfer | $0.09/GB | Generally minimal for JSON APIs |
| Secrets Manager | $0.40 | $0.40/secret/month |
| **Total (Low Usage)** | **$15.60/month** | Assumes < 1M API calls |

### Cost Optimization
- Use **Google Gemini free tier** for development
- Scale up to paid Gemini API only for production
- Monitor Lambda execution time (aim for < 5s)
- Set CloudWatch log retention (14 days recommended)

---

## Post-Deployment

### 1. Configure Custom Domain (Optional)
1. Go to Amplify Console → Domain management
2. Add custom domain (requires DNS CNAME)
3. Update `ALLOWED_ORIGIN` environment variable
4. Redeploy frontend

### 2. Set Up CI/CD
Amplify auto-deploys on git push. To change:
1. Amplify Console → App Settings → Build settings
2. Edit to deploy only on specific branch
3. Set preview environments for PR testing

### 3. Enable Logging
Verify Lambda logs are visible in CloudWatch

### 4. Set Up Alerts (Optional)
Go to CloudWatch → Alarms:
- Create alarm for Lambda errors > 5 per minute
- Create alarm for API Gateway 5xx errors
- Send notifications to email via SNS

---

## Rollback / Troubloshooting

### Revert to Previous Deployment
```bash
# Via Amplify Console
# Settings → Build settings → Redeploy from commit history

# Or via CLI
npx amplify publish --branch <branch-name>
```

### Force Redeploy
```bash
# Clear cache and redeploy
npx ampx deploy --invalidate-cache
```

### Reset Environment
```bash
# Destroy current stack (⚠️ WARNING: Deletes all resources)
npx amplify delete

# Then redeploy
npx ampx deploy
```

---

## Security Best Practices

✅ **Done:**
- API key stored in AWS Secrets Manager (encrypted)
- CORS restricted to known origins
- Input validation (2000 char limit)
- Rate limiting via Google Gemini API tier

⚠️ **Recommended:**
- [ ] Enable CloudTrail logging for API access
- [ ] Set up WAF rules on API Gateway
- [ ] Implement request signing (X-API-Key header)
- [ ] Use API Gateway Lambda authorization
- [ ] Rotate API keys quarterly

---

## Deployment Status

| Stage | Status | Notes |
|-------|--------|-------|
| Local Dev | ✅ Ready | `npm run dev` works |
| Build | ✅ Ready | `npm run build` verified |
| AWS Amplify | ⏳ Pending | Follow steps above |
| Environment Vars | ⏳ Pending | Set after first deploy |
| Secrets Manager | ⏳ Pending | Create before deploy |

---

**Last Updated:** April 2, 2026  
**Owner:** Your Team  
**Support:** Check CloudWatch logs for debugging
