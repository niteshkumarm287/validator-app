// ── Config ─────────────────────────────────────────────────
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';
const LINE_H  = 21.5; // must match --line-h in CSS

// ── Sample snippets ─────────────────────────────────────────
const SAMPLES = {
  yaml: [
    { label: 'valid example', code: `name: John Doe\nage: 30\naddress:\n  city: Bengaluru\n  country: India\nhobbies:\n  - reading\n  - coding` },
    { label: 'bad indentation', code: `server:\n  host: localhost\n    port: 8080\n  debug: true\n      logging: verbose` },
    { label: 'duplicate keys', code: `user:\n  name: Alice\n  age: 25\nuser:\n  name: Bob\n  age: 30` },
  ],
  json: [
    { label: 'valid example', code: `{\n  "name": "Alice",\n  "age": 28,\n  "skills": ["Python", "JS"]\n}` },
    { label: 'trailing comma', code: `{\n  "name": "Bob",\n  "age": 22,\n  "city": "Delhi",\n}` },
    { label: 'missing quotes', code: `{\n  name: "Charlie",\n  age: 31\n}` },
  ],
  python: [
    { label: 'valid example', code: `def greet(name):\n    if name:\n        return f"Hello, {name}"\n    return "Hello, world"` },
    { label: 'indent error', code: `def calc(x):\n  if x > 0:\n      return x * 2\n    else:\n      return 0` },
    { label: 'missing colon', code: `def greet(name)\n    print(name)\n\ngreet("Alice")` },
  ],
};

// ── State ───────────────────────────────────────────────────
let errorLines = [];

// ── DOM refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderSamples();
  updateLineNums();
});

// ── Language switch ─────────────────────────────────────────
function onLangChange() {
  renderSamples();
  clearAll();
}

function renderSamples() {
  const lang = $('lang').value;
  const container = $('samples');
  container.innerHTML = '';
  (SAMPLES[lang] || []).forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'sample-chip';
    btn.textContent = s.label;
    btn.onclick = () => {
      $('code').value = s.code;
      errorLines = [];
      updateLineNums();
      renderHighlights();
    };
    container.appendChild(btn);
  });
}

// ── Editor helpers ──────────────────────────────────────────
function updateLineNums() {
  const ta = $('code');
  const gutter = $('lineNums');
  const lines = ta.value ? ta.value.split('\n') : [''];
  gutter.innerHTML = lines
    .map((_, i) => `<span class="${errorLines.includes(i + 1) ? 'err' : ''}">${i + 1}</span>`)
    .join('');
}

function syncScroll(ta) {
  $('lineNums').scrollTop = ta.scrollTop;
  $('hlOverlay').style.top = (12 - ta.scrollTop) + 'px';
}

function renderHighlights() {
  $('hlOverlay').innerHTML = errorLines
    .map(l => `<div class="err-stripe" style="top:${(l - 1) * LINE_H}px"></div>`)
    .join('');
}

// ── Clear ───────────────────────────────────────────────────
function clearAll() {
  $('code').value = '';
  errorLines = [];
  updateLineNums();
  renderHighlights();
  setIdleState();
}

function setIdleState() {
  $('resultIdle').classList.remove('hidden');
  $('resultContent').classList.add('hidden');
  $('resultContent').innerHTML = '';
  setPill('idle', 'Idle');
}

// ── Status pill ─────────────────────────────────────────────
function setPill(state, text) {
  const dot = $('pillDot');
  const label = $('pillText');
  dot.className = 'pill-dot ' + state;
  label.textContent = text;
}

// ── Validate ────────────────────────────────────────────────
async function validate() {
  const code = $('code').value.trim();
  const lang = $('lang').value;
  const btn  = $('validateBtn');
  const btnText = $('btnText');
  const spinner = $('btnSpinner');

  if (!code) {
    showError('Please paste some code first.');
    return;
  }

  // Loading state
  btn.disabled = true;
  btnText.textContent = 'Checking';
  spinner.classList.remove('hidden');
  $('resultIdle').classList.add('hidden');
  $('resultContent').classList.remove('hidden');
  $('resultContent').innerHTML = `<p style="font-family:var(--mono);font-size:12px;color:#5b9cf6;animation:pulse 1s infinite">Analyzing your ${lang.toUpperCase()}…</p>`;
  setPill('checking', 'Analyzing');
  errorLines = [];
  renderHighlights();
  updateLineNums();

  const prompt = `You are a strict ${lang.toUpperCase()} validator. Analyze the following code carefully for:
1. Syntax errors
2. Indentation issues
3. Type mismatches or structural problems
4. Any other language-specific issues

Code to validate:
\`\`\`${lang}
${code}
\`\`\`

Respond ONLY with a valid JSON object — no markdown fences, no preamble, no extra text. Use this exact shape:
{
  "status": "VALID" or "INVALID",
  "summary": "One-sentence summary of the result.",
  "issues": [
    { "line": <integer or null>, "description": "Clear explanation of the issue on this line." }
  ]
}
If the code is valid, "issues" must be an empty array.
Be precise about line numbers — count from line 1.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw  = (data.content || []).map(b => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const isValid = parsed.status === 'VALID';
    setPill(isValid ? 'valid' : 'invalid', isValid ? 'Valid' : 'Invalid');

    errorLines = (parsed.issues || []).map(i => i.line).filter(Boolean);
    updateLineNums();
    renderHighlights();

    renderResult(parsed, isValid, lang);

  } catch (e) {
    setPill('invalid', 'Error');
    showError('API error: ' + e.message);
  }

  btn.disabled = false;
  btnText.textContent = 'Validate';
  spinner.classList.add('hidden');
}

// ── Render result ───────────────────────────────────────────
function renderResult(parsed, isValid, lang) {
  const content = $('resultContent');
  content.classList.remove('hidden');
  $('resultIdle').classList.add('hidden');

  if (isValid) {
    content.innerHTML = `
      <p class="result-summary">${escHtml(parsed.summary)}</p>
      <div class="result-ok">No issues found. Your ${lang.toUpperCase()} is valid!</div>
    `;
    return;
  }

  const issues = parsed.issues || [];
  const issueHTML = issues.map(issue => `
    <div class="issue-card">
      <div class="issue-head">Line ${issue.line ?? '—'}</div>
      <div class="issue-body">${escHtml(issue.description)}</div>
    </div>
  `).join('');

  content.innerHTML = `
    <p class="result-summary">${escHtml(parsed.summary)}</p>
    <p class="result-summary" style="margin-bottom:12px">${issues.length} issue${issues.length !== 1 ? 's' : ''} found</p>
    ${issueHTML}
  `;
}

function showError(msg) {
  const content = $('resultContent');
  content.classList.remove('hidden');
  $('resultIdle').classList.add('hidden');
  content.innerHTML = `<p style="font-family:var(--mono);font-size:12px;color:#ff5c5c">${escHtml(msg)}</p>`;
}

// ── Utils ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
