# ⚡ Quick Start - Local Development

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## 🚀 Get Started in 3 Steps

### Step 1: Setup Environment
```bash
# Copy the example env file
copy .env.local.example .env.local

# Open .env.local and replace the placeholder
# GEMINI_API_KEY=your_actual_api_key_here
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm run dev
```

You'll see:
```
[Local API Proxy] Running on http://127.0.0.1:3005/api/gemini
[vite] v6.2.0 running at:
  > Local:    http://localhost:3000/
```

Open **http://localhost:3000** in your browser ✨

---

## 📝 Features Included

### 🐛 Bug Report Generator
- Describe any issue in natural language
- AI transforms it into a structured bug report
- Includes severity, steps to reproduce, expected vs actual results
- Copy to clipboard → paste in Jira/GitHub

**Try it:**
```
Input: "The login button is missing on mobile when in landscape mode"

Output:
{
  "summary": "Login button invisible in landscape mode on mobile",
  "stepsToReproduce": [
    "Open app on mobile device",
    "Rotate device to landscape",
    "Navigate to login page"
  ],
  "expectedResult": "Login button is visible and clickable",
  "actualResult": "Login button is not visible",
  "severity": "High",
  "category": "UI/UX"
}
```

### 🧪 BDD Scenario Generator
- Write a feature description
- AI generates Gherkin BDD scenarios
- Ready for Cucumber, Behave, or other frameworks
- Copy-paste into feature files

**Try it:**
```
Input: "User can filter products by price range on the shop page"

Output:
Feature: Product Filtering
  Scenario: Filter products by price range
    Given the shop page is loaded with 50 products
    When the user opens the price filter
    And selects "$0-$50" range
    Then only products within the range are displayed
    And the filter count shows the matched products
```

---

## 🛠️ Available Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server + local proxy |
| `npm run build` | Build for production (creates `dist/`) |
| `npm run preview` | Test production build locally |
| `npm run lint` | TypeScript type checking |

---

## 🧪 Testing

### Manual Testing
1. Open http://localhost:3000
2. Try bug report with: `"The app crashes when uploading a 10MB image"`
3. Try BDD with: `"Users can reset their password via email"`
4. Check console (F12) for API response times

### Automated Type Checking
```bash
npm run lint
# Should show: "error TS..." if there are issues
```

---

## 🔧 Troubleshooting

### Problem: Port 3000 already in use
```bash
# Change port in vite.config.ts
server: {
  port: 3001,  // Try different port
}
```

### Problem: Port 3005 already in use
```bash
# Find what's using it
netstat -ano | findstr :3005

# Kill the process
taskkill /PID <PID> /F
```

### Problem: `npm run dev` fails with "Cannot find module"
```bash
# Clean install
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Problem: API returns 500 error
1. Check `.env.local` has correct API key
2. Check CloudWatch logs: Open terminal → look for [Local API Proxy] errors
3. Verify API key is active at [Google AI Studio](https://aistudio.google.com/apikey)

### Problem: TypeScript errors in IDE
```bash
# Check TypeScript version
npx tsc --version  # Should be 5.9.3+

# Reinstall TypeScript
npm install --save-dev typescript@latest
```

---

## 📚 Project Structure

```
onc-qa-genbot/
├── App.tsx                    # Main component
├── index.tsx                  # React entry point
├── .env                       # Placeholder (no real key)
├── .env.local                 # Your actual key (gitignored)
├── .env.local.example         # Template
│
├── components/
│   ├── Layout.tsx            # Navigation & branding
│   ├── BugForm.tsx           # Bug report UI
│   ├── BDDGenerator.tsx      # BDD scenario UI
│   └── ErrorBoundary.tsx     # Error handling
│
├── services/
│   └── geminiService.ts      # API client
│
├── amplify/                  # Backend Lambda config
│   ├── backend.ts            # API Gateway setup
│   └── functions/gemini-proxy/
│       ├── handler.ts        # Lambda function
│       └── resource.ts       # Lambda definition
│
└── (config files)
    ├── vite.config.ts        # Frontend build config
    ├── tsconfig.json         # TypeScript config
    ├── amplify.yml           # Deployment config
    └── package.json          # Dependencies
```

---

## 🔐 Security Notes

⚠️ **Important:**
- Never commit `.env.local` 
- Never share your Gemini API key
- Use `.env` only for placeholder values
- Rotate API key every quarter

---

## 📖 Next Steps

### To Deploy to Production
1. Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Create AWS account and configure CLI
3. Set up API secret in AWS Secrets Manager
4. Deploy via Amplify Console or CLI

### To Understand the Code
- [FIXES_ANALYSIS.md](FIXES_ANALYSIS.md) — Architecture & design decisions
- Type definitions: [types.ts](types.ts)
- Service layer: [services/geminiService.ts](services/geminiService.ts)

### To Customize
- Change API model: Edit `handler.ts` (currently `gemini-3-flash-preview`)
- Change UI colors: Edit `components/*.tsx` (uses Tailwind CSS)
- Add new features: Create component in `components/` and route in `App.tsx`

---

## 💡 Tips

1. **Faster builds:** Vite caches dependencies after first install
2. **Better errors:** Check browser console (F12) for detailed errors
3. **API debugging:** Enable CloudWatch logging to see Lambda execution
4. **Live reload:** Dev server auto-refreshes on file save

---

## ❓ FAQ

**Q: Can I use this without AWS Amplify?**  
A: Yes for frontend. For backend, you'd need to host the Lambda function elsewhere (Google Cloud Functions, Vercel, etc.)

**Q: What Google API limits apply?**  
A: Free tier: ~60 requests/minute. Upgrade plan for production reliability.

**Q: How long do responses take?**  
A: Typically 3-5 seconds. Lambda timeout is set to 30 seconds to be safe.

**Q: Can I cache responses?**  
A: Yes, but be careful with Gemini's structured output—keep context fresh.

---

**Happy coding!** 🎉  
For issues, check CloudWatch logs or [FIXES_ANALYSIS.md](FIXES_ANALYSIS.md)
