# ValidAI — YAML · JSON · Python Validator

An AI-powered syntax and indentation validator for YAML, JSON, and Python. Built with plain HTML/CSS/JS and powered by Claude AI.

## Features
- Dropdown language selector (YAML, JSON, Python)
- Line-number gutter with red highlights on error lines
- Per-issue cards showing exact line numbers
- Sample snippets to test with one click
- Dark theme, no dependencies, no build step

## Deploy to Vercel (free, 2 minutes)

### Option A — Vercel CLI
```bash
npm i -g vercel
cd validator-app
vercel
```
Follow the prompts. Done.

### Option B — GitHub + Vercel UI
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project
3. Import your repo → Deploy
4. That's it — live URL in ~30 seconds

## Local development
Just open `index.html` in your browser — no server needed.

## How it works
The app calls the Anthropic Claude API directly from the browser. Each validation request sends your code to Claude with a structured prompt, and Claude returns a JSON object with:
- `status`: VALID or INVALID
- `summary`: one-sentence description
- `issues`: array of `{ line, description }` objects

The UI then highlights those exact lines in red.

## Files
```
validator-app/
├── index.html   ← markup & structure
├── style.css    ← all styling (dark theme)
├── app.js       ← logic, API calls, line highlighting
├── vercel.json  ← Vercel deployment config
└── README.md    ← this file
```
