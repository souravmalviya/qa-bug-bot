# Onclusive QA Bugbot

AI-powered QA assistant that generates structured bug reports and Gherkin BDD scenarios from plain-text descriptions.

**Live:** [qa-bug-bot.vercel.app](https://qa-bug-bot.vercel.app)

## Features

- **Bug Report Generator** — Paste a raw bug description, get a structured report with severity, steps to reproduce, expected/actual results
- **BDD Step Generator** — Describe a feature, get a professional Gherkin scenario with Given/When/Then steps
- **Powered by GPT-5.2** — Uses OpenRouter API for fast, reliable AI responses
- **Production-ready** — CORS-locked API, retry logic with exponential backoff, structured JSON output

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 19 + TypeScript + TailwindCSS |
| Backend   | Vercel Serverless Functions          |
| AI        | OpenRouter SDK → GPT-5.2            |
| Hosting   | Vercel                              |

## Project Structure

```
├── api/
│   └── generate.ts          # Vercel serverless function (OpenRouter API)
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Root component with routing
│   ├── index.css             # Global styles
│   ├── types.ts              # TypeScript interfaces
│   ├── components/
│   │   ├── Layout.tsx        # Nav + footer shell
│   │   ├── BugForm.tsx       # Bug report generator page
│   │   ├── BDDGenerator.tsx  # BDD scenario generator page
│   │   └── ErrorBoundary.tsx # Global error boundary
│   └── services/
│       └── aiService.ts      # Frontend API client
├── public/
│   └── logo.png              # Onclusive logo
├── server.ts                 # Local dev Express server
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
├── vercel.json               # Vercel deployment settings
└── package.json
```

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd onc-qa-genbot-main
npm install
```

### 2. Set up environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your OpenRouter API key:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Get a key from [openrouter.ai/keys](https://openrouter.ai/keys).

### 3. Run locally

```bash
npm run dev
```

Opens the app at [localhost:3000](http://localhost:3000) with the API server on port 3001.

## Deploy to Vercel

1. Push your code to GitHub
2. Import the repo in [Vercel Dashboard](https://vercel.com/new)
3. Add environment variable: `OPENROUTER_API_KEY` = your key
4. Deploy — Vercel auto-detects the Vite + serverless setup

## Environment Variables

| Variable            | Required | Description                        |
|---------------------|----------|------------------------------------|
| `OPENROUTER_API_KEY`| Yes      | Your OpenRouter API key (`sk-or-…`)|

## API Reference

### `POST /api/generate`

**Request body:**

```json
{
  "action": "bug-report" | "bdd-steps",
  "input": "Your description text (max 5000 chars)"
}
```

**Response:** JSON matching the `BugReport` or `BDDScenario` type.

## License

Internal tool — Onclusive © 2026
