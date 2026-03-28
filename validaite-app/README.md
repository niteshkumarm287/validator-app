# ValidAI

> Instant, browser-based syntax validator for configuration and data files.

Supports **YAML · JSON · TOML · XML · INI · .env** with precise line-by-line error reporting. Runs entirely in the browser — no server, no API calls, no data sent anywhere.

---

## Features

- **Six formats** — YAML, JSON, TOML, XML, INI, .env
- **Line-level errors** — every issue includes an exact line number and description
- **Visual highlights** — error lines are marked in red directly in the editor gutter
- **Format / Prettify** — auto-indent JSON, YAML, and XML with one click
- **Minify** — compress JSON and XML for production use
- **Works offline** — no backend, no telemetry, no login required
- **Zero build step** — plain HTML, CSS, and JS; open `src/index.html` directly

---

## Project Structure

```
validai/
├── src/
│   ├── index.html        # Application shell and styles
│   ├── validators.js     # Pure validation functions (one per language)
│   └── app.js            # UI logic: rendering, toolbar actions, editor helpers
├── tests/
│   └── validators.test.js  # Node.js test suite (no external framework)
├── docs/
│   └── validators.md     # Validator behaviour and edge-case notes
├── package.json          # Dev dependencies and test script
├── vercel.json           # Vercel deployment config
└── README.md
```

---

## Getting Started

### Open locally

```bash
# No install needed — just open the file
open src/index.html
```

### Run tests

```bash
npm install          # installs js-yaml and @xmldom/xmldom for Node test env
npm test
```

Expected output:

```
── JSON validator ──────────────────────────────────────
  ✓  valid object returns valid:true
  ✓  valid object includes key count in meta
  ...

── .env validator ──────────────────────────────────────
  ✓  valid .env returns valid:true
  ...

══════════════════════════════════════════════════════
  Results: 42 passed, 0 failed
══════════════════════════════════════════════════════
```

---

## Deploy to Vercel (free)

**Option A — CLI**

```bash
npm install -g vercel
vercel
```

**Option B — GitHub import**

1. Push this repository to GitHub
2. Visit [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Click **Deploy** — live URL in ~30 seconds

---

## Validator Behaviour

| Format | Parser | Notes |
|--------|--------|-------|
| JSON   | Native `JSON.parse` | Extracts line from error position offset |
| YAML   | `js-yaml` (CDN) | Rejects bare JSON objects to prevent false positives |
| TOML   | Custom regex parser | Checks key types, duplicate keys/sections, unclosed strings |
| XML    | Native `DOMParser` | Full browser XML parser; reports element and attribute counts |
| INI    | Custom line parser | Supports `=` and `:` separators; detects duplicate keys |
| .env   | Custom line parser | Enforces `UPPER_SNAKE_CASE` keys, flags unquoted values with spaces |

See [`docs/validators.md`](docs/validators.md) for detailed edge-case behaviour.

---

## Architecture

The codebase is intentionally split into three files:

| File | Responsibility |
|------|---------------|
| `validators.js` | Pure functions — no DOM access, fully testable in Node.js |
| `app.js` | UI wiring — reads DOM, calls validators, renders results |
| `index.html` | Markup and styles only — no inline scripts or styles |

This separation means validators can be tested independently from the UI, and the UI can be restyled without touching validation logic.

---

## Contributing

1. Add your validator function to `src/validators.js`
2. Add sample snippets to the `SAMPLES` map in `src/app.js`
3. Add test cases to `tests/validators.test.js`
4. Run `npm test` — all tests must pass

---

## License

MIT
