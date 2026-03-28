/**
 * validators.js
 * Pure validation functions for each supported language.
 * Each function receives a string and returns:
 *   { valid: true,  summary: string, meta: string[] }
 *   { valid: false, issues: Array<{ line: number|null, description: string }> }
 */

// ─── JSON ────────────────────────────────────────────────────────────────────

function validateJSON(code) {
  try {
    const parsed = JSON.parse(code);
    const str    = JSON.stringify(parsed);
    const bytes  = new TextEncoder().encode(code).length;
    const keys   = (str.match(/"[^"]+"\s*:/g) || []).length;
    const depth  = jsonMaxDepth(parsed);
    const objs   = (str.match(/\{/g) || []).length;
    const arrays = (str.match(/\[/g) || []).length;
    return {
      valid: true,
      summary: 'Valid JSON',
      meta: [`${bytes} B`, `${keys} keys`, `depth ${depth}`, `${objs} objects`, `${arrays} arrays`],
    };
  } catch (e) {
    const msg = e.message;
    let line = null;
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      line = code.substring(0, parseInt(posMatch[1])).split('\n').length;
    }
    const lineMatch = msg.match(/line (\d+)/i);
    if (lineMatch) line = parseInt(lineMatch[1]);
    return { valid: false, issues: [{ line, description: msg }] };
  }
}

function jsonMaxDepth(obj, d = 0) {
  if (typeof obj !== 'object' || obj === null) return d;
  return Math.max(d, ...Object.values(obj).map(v => jsonMaxDepth(v, d + 1)));
}

// ─── YAML ────────────────────────────────────────────────────────────────────

function validateYAML(code) {
  const trimmed = code.trim();
  // Reject any input that parses as valid JSON — valid JSON is valid YAML but misleading
  try {
    JSON.parse(trimmed);
    return {
      valid: false,
      issues: [{ line: 1, description: 'Input looks like JSON, not YAML. Switch the language selector to JSON.' }],
    };
  } catch (_) { /* not JSON, continue */ }

  if (typeof jsyaml === 'undefined') {
    return { valid: false, issues: [{ line: null, description: 'YAML parser not loaded. Check your internet connection.' }] };
  }

  try {
    jsyaml.load(code, { strict: true });
    return { valid: true, summary: 'Valid YAML', meta: [`${code.split('\n').length} lines`] };
  } catch (e) {
    const line = e.mark ? e.mark.line + 1 : null;
    return { valid: false, issues: [{ line, description: e.reason || e.message }] };
  }
}

// ─── TOML ────────────────────────────────────────────────────────────────────

function validateTOML(code) {
  const lines  = code.split('\n');
  const issues = [];
  const keys   = new Set();
  let currentSection = '';

  const reSection    = /^\[([^\]]+)\]$/;
  const reKeyValue   = /^([A-Za-z0-9_.\-]+)\s*=\s*(.+)$/;
  const reComment    = /^\s*#/;
  const reBlank      = /^\s*$/;
  const reInlineArr  = /^\[.*\]$/;

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    const lineNum = i + 1;

    if (reBlank.test(line) || reComment.test(line)) return;

    // Section header
    if (line.startsWith('[')) {
      const m = line.match(reSection);
      if (!m) {
        issues.push({ line: lineNum, description: `Malformed section header: "${line}". Expected format: [section.name]` });
        return;
      }
      currentSection = m[1].trim();
      if (keys.has('[' + currentSection + ']')) {
        issues.push({ line: lineNum, description: `Duplicate section: [${currentSection}]` });
      }
      keys.add('[' + currentSection + ']');
      return;
    }

    // Key = value
    const m = line.match(reKeyValue);
    if (!m) {
      issues.push({ line: lineNum, description: `Invalid syntax: "${line}". Expected key = value format.` });
      return;
    }

    const key      = m[1].trim();
    const val      = m[2].trim();
    const fullKey  = currentSection ? `${currentSection}.${key}` : key;

    if (keys.has(fullKey)) {
      issues.push({ line: lineNum, description: `Duplicate key: "${fullKey}"` });
    }
    keys.add(fullKey);

    // Validate value types
    const isStr       = (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
    const isMultiStr  = val.startsWith('"""') || val.startsWith("'''");
    const isBool      = val === 'true' || val === 'false';
    const isNum       = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(val);
    const isDate      = /^\d{4}-\d{2}-\d{2}/.test(val);
    const isArr       = val.startsWith('[');
    const isInlineObj = val.startsWith('{');

    if (!isStr && !isMultiStr && !isBool && !isNum && !isDate && !isArr && !isInlineObj) {
      issues.push({ line: lineNum, description: `Invalid value for key "${key}": "${val}". String values must be quoted.` });
    }

    // Unclosed string
    if ((val.startsWith('"') && !val.endsWith('"')) || (val.startsWith("'") && !val.endsWith("'"))) {
      issues.push({ line: lineNum, description: `Unclosed string for key "${key}".` });
    }

    // Unclosed array
    if (isArr && !val.endsWith(']')) {
      issues.push({ line: lineNum, description: `Unclosed array for key "${key}". Add closing "]".` });
    }
  });

  if (issues.length === 0) {
    return { valid: true, summary: 'Valid TOML', meta: [`${lines.length} lines`, `${keys.size} keys`] };
  }
  return { valid: false, issues };
}

// ─── XML ─────────────────────────────────────────────────────────────────────

function validateXML(code) {
  if (typeof DOMParser === 'undefined') {
    return { valid: false, issues: [{ line: null, description: 'DOMParser not available in this environment.' }] };
  }

  const parser = new DOMParser();
  const doc    = parser.parseFromString(code, 'application/xml');
  const errors = doc.getElementsByTagName('parsererror');

  if (errors.length > 0) {
    const errText = errors[0].textContent || '';
    // Extract line/col from browser error message
    const lineMatch = errText.match(/line[: ]+(\d+)/i);
    const line = lineMatch ? parseInt(lineMatch[1]) : null;
    // Clean up the message
    const clean = errText
      .replace(/error on line \d+ at column \d+:/i, '')
      .replace(/Below is a rendering of the page.*$/s, '')
      .trim()
      .split('\n')[0]
      .trim();
    return { valid: false, issues: [{ line, description: clean || errText.trim() }] };
  }

  const elements = doc.getElementsByTagName('*').length;
  const attrs    = Array.from(doc.getElementsByTagName('*')).reduce((n, el) => n + el.attributes.length, 0);
  return {
    valid: true,
    summary: 'Valid XML',
    meta: [`${elements} elements`, `${attrs} attributes`],
  };
}

// ─── INI ─────────────────────────────────────────────────────────────────────

function validateINI(code) {
  const lines  = code.split('\n');
  const issues = [];
  const keys   = new Set();
  let   section = '';

  lines.forEach((rawLine, i) => {
    const line    = rawLine.trim();
    const lineNum = i + 1;

    if (!line || line.startsWith(';') || line.startsWith('#')) return;

    // Section
    if (line.startsWith('[')) {
      if (!line.endsWith(']')) {
        issues.push({ line: lineNum, description: `Malformed section header: "${line}". Must end with "]".` });
        return;
      }
      section = line.slice(1, -1).trim();
      if (!section) {
        issues.push({ line: lineNum, description: 'Empty section name "[]" is not allowed.' });
      }
      return;
    }

    // Key = value or Key : value
    const sep = line.includes('=') ? '=' : line.includes(':') ? ':' : null;
    if (!sep) {
      issues.push({ line: lineNum, description: `Invalid line: "${line}". Expected key = value or key : value.` });
      return;
    }

    const eqIdx = line.indexOf(sep);
    const key   = line.substring(0, eqIdx).trim();
    const val   = line.substring(eqIdx + 1).trim();

    if (!key) {
      issues.push({ line: lineNum, description: 'Key cannot be empty.' });
      return;
    }

    const fullKey = section ? `[${section}].${key}` : key;
    if (keys.has(fullKey)) {
      issues.push({ line: lineNum, description: `Duplicate key: "${fullKey}"` });
    }
    keys.add(fullKey);
  });

  if (issues.length === 0) {
    return { valid: true, summary: 'Valid INI', meta: [`${lines.length} lines`, `${keys.size} keys`] };
  }
  return { valid: false, issues };
}

// ─── .env ────────────────────────────────────────────────────────────────────

function validateENV(code) {
  const lines  = code.split('\n');
  const issues = [];
  const keys   = new Set();

  const reValidKey = /^[A-Z_][A-Z0-9_]*$/;

  lines.forEach((rawLine, i) => {
    const line    = rawLine.trimEnd();
    const lineNum = i + 1;

    if (!line.trim() || line.trim().startsWith('#')) return;

    // Must contain =
    if (!line.includes('=')) {
      issues.push({ line: lineNum, description: `Missing "=" in: "${line}". Expected KEY=value format.` });
      return;
    }

    const eqIdx = line.indexOf('=');
    const key   = line.substring(0, eqIdx).trim();
    const val   = line.substring(eqIdx + 1); // preserve spaces in value

    // Key rules
    if (!key) {
      issues.push({ line: lineNum, description: 'Key cannot be empty.' });
      return;
    }

    if (!reValidKey.test(key)) {
      issues.push({
        line: lineNum,
        description: `Invalid key name: "${key}". Keys must be uppercase letters, digits, and underscores only, and cannot start with a digit.`,
      });
    }

    if (keys.has(key)) {
      issues.push({ line: lineNum, description: `Duplicate key: "${key}"` });
    }
    keys.add(key);

    // Value warnings
    if (val.includes(' ') && !val.startsWith('"') && !val.startsWith("'")) {
      issues.push({
        line: lineNum,
        description: `Value for "${key}" contains spaces but is not quoted. Wrap it in double quotes: ${key}="${val.trim()}"`,
      });
    }

    // Unclosed quotes
    const trimVal = val.trim();
    if ((trimVal.startsWith('"') && !trimVal.endsWith('"')) ||
        (trimVal.startsWith("'") && !trimVal.endsWith("'"))) {
      issues.push({ line: lineNum, description: `Unclosed string value for "${key}".` });
    }
  });

  if (issues.length === 0) {
    return { valid: true, summary: 'Valid .env file', meta: [`${keys.size} variables`] };
  }
  return { valid: false, issues };
}
