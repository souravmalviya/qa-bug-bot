# Onclusive QA Bugbot

An AI-powered QA assistant that generates structured bug reports and BDD Gherkin scenarios from plain-text descriptions, powered by Google Gemini.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS v4
- **Backend**: Vercel Serverless Functions
- **AI**: Google Gemini API (`@google/genai`)

## Project Structure

```
├── api/
│   └── generate.ts         # Vercel serverless function (Gemini proxy)
├── components/
│   ├── App.tsx              # Root application component
│   ├── BDDGenerator.tsx     # BDD Gherkin scenario generator
│   ├── BugForm.tsx          # Bug report generator
│   ├── ErrorBoundary.tsx    # React error boundary
│   └── Layout.tsx           # Navigation & layout shell
├── services/
│   └── geminiService.ts     # Frontend API client
├── public/
│   └── logo.png             # App logo
├── index.html               # HTML entry point
├── index.tsx                 # React entry point
├── index.css                 # Global styles + Tailwind
├── types.ts                  # Shared TypeScript types
├── vite.config.ts            # Vite configuration
├── vercel.json               # Vercel deployment config
├── tsconfig.json             # TypeScript configuration
└── package.json
```

## Local Development

### Prerequisites

- Node.js 18+
- npm
- [Vercel CLI](https://vercel.com/docs/cli) (installed as dev dependency)

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd onc-qa-genbot-main
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and add your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   This uses `vercel dev` which serves both the Vite frontend and the `/api` serverless functions locally.

   > **Alternative**: Run `npm run dev:vite` for frontend-only development (API routes won't work).

4. **Open** [http://localhost:3000](http://localhost:3000)

## Deploying to Vercel

### Option 1: Git Integration (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Vercel auto-detects the Vite framework. No build settings changes needed.
4. Add the environment variable:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key
5. Click **Deploy**.

### Option 2: Vercel CLI

```bash
npx vercel --prod
```

Set the environment variable first:
```bash
npx vercel env add GEMINI_API_KEY
```

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Vercel Dashboard / `.env.local` | Google Gemini API key (server-side only, never exposed to client) |

## Security

- The Gemini API key is **never** exposed to the browser.
- All AI requests go through `/api/generate` (a server-side Vercel function).
- Input validation and rate limiting are enforced server-side.
- CORS headers are set on the API endpoint.

---

Created with ❤️ by Sourav Malviya
