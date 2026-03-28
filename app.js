/**
 * app.js
 * UI logic: rendering, editor helpers, toolbar actions.
 * Depends on validators.js being loaded first.
 */

const LINE_H = 22;

const SAMPLES = {
  yaml: [
    {
      label: 'valid',
      code: 'name: John\nage: 30\naddress:\n  city: Bengaluru\n  country: India\nhobbies:\n  - reading\n  - coding',
    },
    {
      label: 'bad indent',
      code: 'server:\n  host: localhost\n    port: 8080\n  debug: true\n      log: verbose',
    },
  ],
  json: [
    {
      label: 'valid',
      code: '{\n  "name": "Alice",\n  "age": 28,\n  "skills": ["Python", "JS"]\n}',
    },
    {
      label: 'trailing comma',
      code: '{\n  "name": "Bob",\n  "age": 22,\n  "city": "Delhi",\n}',
    },
  ],
  toml: [
    {
      label: 'valid',
      code: '[server]\nhost = "localhost"\nport = 8080\ndebug = false\n\n[database]\nname = "mydb"\nmax_connections = 10',
    },
    {
      label: 'unquoted string',
      code: '[app]\nname = MyApp\nversion = "1.0.0"\nport = 3000',
    },
  ],
  xml: [
    {
      label: 'valid',
      code: '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <server>\n    <host>localhost</host>\n    <port>8080</port>\n  </server>\n</config>',
    },
    {
      label: 'unclosed tag',
      code: '<?xml version="1.0"?>\n<config>\n  <server>\n    <host>localhost</host>\n    <port>8080\n  </server>\n</config>',
    },
  ],
  ini: [
    {
      label: 'valid',
      code: '[database]\nhost = localhost\nport = 5432\nname = mydb\n\n[app]\ndebug = false\nlog_level = info',
    },
    {
      label: 'missing equals',
      code: '[server]\nhost localhost\nport = 8080',
    },
  ],
  env: [
    {
      label: 'valid',
      code: 'APP_NAME=MyApp\nAPP_ENV=production\nDB_HOST=localhost\nDB_PORT=5432\nSECRET_KEY="super-secret-key"',
    },
    {
      label: 'invalid key',
      code: 'app name=MyApp\nDB_HOST=localhost\nDB_PORT=5432\nSECRET KEY=abc 123',
    },
  ],
};

let errLines = [];

// ─── Language switch ──────────────────────────────────────────────────────────

function onLangChange() {
  renderSamples();
  clearAll();
}

function renderSamples() {
  const lang = document.getElementById('lang').value;
  const el   = document.getElementById('samples');
  el.innerHTML = '';
  (SAMPLES[lang] || []).forEach(s => {
    const b = document.createElement('button');
    b.className   = 'chip';
    b.textContent = 'Try: ' + s.label;
    b.onclick = () => {
      document.getElementById('code').value = s.code;
      onInput();
    };
    el.appendChild(b);
  });
}

// ─── Editor helpers ───────────────────────────────────────────────────────────

function onInput() {
  errLines = [];
  updateGutter();
  renderHighlights();
  setBar('', 'Ready');
}

function updateGutter() {
  const code  = document.getElementById('code').value;
  const lines = code ? code.split('\n') : [''];
  document.getElementById('gutter').innerHTML =
    lines.map((_, i) =>
      `<span class="${errLines.includes(i + 1) ? 'err-line' : ''}">${i + 1}</span>`
    ).join('');
}

function syncScroll(ta) {
  document.getElementById('gutter').scrollTop = ta.scrollTop;
  document.querySelectorAll('.err-highlight').forEach(el => {
    el.style.top = (parseInt(el.dataset.line - 1) * LINE_H + 14 - ta.scrollTop) + 'px';
  });
}

function renderHighlights() {
  const wrap = document.getElementById('editorWrap');
  wrap.querySelectorAll('.err-highlight').forEach(e => e.remove());
  const ta = document.getElementById('code');
  errLines.forEach(l => {
    const d = document.createElement('div');
    d.className    = 'err-highlight';
    d.dataset.line = l;
    d.style.top    = ((l - 1) * LINE_H + 14 - ta.scrollTop) + 'px';
    wrap.appendChild(d);
  });
}

function setStatus(state, text) {
  document.getElementById('dot').className     = 'dot ' + state;
  document.getElementById('statusText').textContent = text;
}

function setBar(type, msg) {
  const bar       = document.getElementById('statusBar');
  bar.className   = 'status-bar' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
  bar.textContent = msg;
}

function clearAll() {
  document.getElementById('code').value = '';
  errLines = [];
  updateGutter();
  renderHighlights();
  setStatus('', 'Idle');
  document.getElementById('resultArea').innerHTML =
    '<div class="result-idle">Paste code and click Validate</div>';
  setBar('', 'Ready');
}

// ─── Validate ─────────────────────────────────────────────────────────────────

function validate() {
  const code = document.getElementById('code').value;
  const lang = document.getElementById('lang').value;
  const area = document.getElementById('resultArea');

  if (!code.trim()) {
    area.innerHTML = '<div class="result-idle">Paste some code first</div>';
    return;
  }

  const validators = {
    json:  validateJSON,
    yaml:  validateYAML,
    toml:  validateTOML,
    xml:   validateXML,
    ini:   validateINI,
    env:   validateENV,
  };

  const result = validators[lang](code);

  errLines = (result.issues || []).map(i => i.line).filter(Boolean);
  updateGutter();
  renderHighlights();

  if (result.valid) {
    setStatus('valid', 'Valid');
    setBar('ok', '✓  ' + result.summary);
    const metaHTML = result.meta
      ? '<div class="meta-row">' + result.meta.map(m => `<span class="meta-pill">${m}</span>`).join('') + '</div>'
      : '';
    area.innerHTML = `<div class="result-ok">No issues found — your ${lang.toUpperCase()} is valid!</div>${metaHTML}`;
  } else {
    const issues = result.issues || [];
    setStatus('invalid', 'Invalid');
    setBar('err', `✕  ${issues.length} issue${issues.length !== 1 ? 's' : ''} found`);
    area.innerHTML =
      `<div class="issue-count">${issues.length} issue${issues.length !== 1 ? 's' : ''} found</div>` +
      issues
        .map(i => `<div class="issue">
          <div class="issue-line">Line ${i.line ?? '—'}</div>
          <div class="issue-desc">${esc(i.description)}</div>
        </div>`)
        .join('');
  }
}

// ─── Extra toolbar actions ────────────────────────────────────────────────────

function formatCode() {
  const lang = document.getElementById('lang').value;
  const code = document.getElementById('code').value.trim();
  if (!code) return;
  try {
    if (lang === 'json') {
      document.getElementById('code').value = JSON.stringify(JSON.parse(code), null, 2);
      onInput(); validate();
    } else if (lang === 'yaml' && typeof jsyaml !== 'undefined') {
      document.getElementById('code').value = jsyaml.dump(jsyaml.load(code), { indent: 2, lineWidth: -1 });
      onInput(); validate();
    } else if (lang === 'xml') {
      document.getElementById('code').value = formatXML(code);
      onInput(); validate();
    } else {
      setBar('err', 'Format not available for ' + lang.toUpperCase());
    }
  } catch (e) {
    setBar('err', 'Cannot format — fix errors first');
  }
}

function formatXML(xml) {
  let indent = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map(line => {
      line = line.trim();
      if (!line) return '';
      if (line.match(/^<\//) || line.match(/^<[^?][^>]*\/>$/)) indent = Math.max(0, indent - 1);
      const out = '  '.repeat(indent) + line;
      if (line.match(/^<[^\/!?][^>]*[^\/]>$/) && !line.match(/<.*>.*<\//)) indent++;
      return out;
    })
    .filter(Boolean)
    .join('\n');
}

function minifyCode() {
  const lang = document.getElementById('lang').value;
  const code = document.getElementById('code').value.trim();
  if (!code) return;
  try {
    if (lang === 'json') {
      document.getElementById('code').value = JSON.stringify(JSON.parse(code));
      onInput();
      setBar('ok', 'Minified');
    } else if (lang === 'xml') {
      document.getElementById('code').value = code.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
      onInput();
      setBar('ok', 'Minified');
    } else {
      setBar('err', 'Minify available for JSON and XML only');
    }
  } catch (e) {
    setBar('err', 'Cannot minify — fix errors first');
  }
}

function copyCode() {
  const code = document.getElementById('code').value;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    setBar('ok', 'Copied to clipboard!');
    setTimeout(() => setBar('', 'Ready'), 2000);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────

renderSamples();
updateGutter();
