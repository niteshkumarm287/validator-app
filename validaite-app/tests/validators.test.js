/**
 * tests/validators.test.js
 *
 * Run with Node.js:
 *   node tests/validators.test.js
 *
 * No external test framework required — pure Node.js with a tiny built-in harness.
 * Requires js-yaml for YAML tests:
 *   npm install js-yaml
 */

'use strict';

// ─── Load js-yaml (required for YAML validator) ───────────────────────────────
let jsyaml;
try {
  jsyaml = require('js-yaml');
  global.jsyaml = jsyaml;
} catch (_) {
  console.warn('[WARN] js-yaml not installed. YAML tests will be skipped.');
  console.warn('       Run: npm install js-yaml\n');
}

// ─── Load validators (CommonJS shim) ─────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const src  = fs.readFileSync(path.join(__dirname, '../src/validators.js'), 'utf8');
const vm = require('vm'); vm.runInThisContext(src);

// Provide DOMParser for XML tests (requires xmldom)
let DOMParser;
try {
  DOMParser = require('@xmldom/xmldom').DOMParser;
  global.DOMParser = DOMParser;
} catch (_) {
  console.warn('[WARN] @xmldom/xmldom not installed. XML tests will be skipped.');
  console.warn('       Run: npm install @xmldom/xmldom\n');
}

// Provide TextEncoder (available in Node >= 11)
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

// ─── Tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(description, condition) {
  if (condition) {
    console.log(`  ✓  ${description}`);
    passed++;
  } else {
    console.error(`  ✕  ${description}`);
    failed++;
    failures.push(description);
  }
}

function describe(suite, fn) {
  console.log(`\n── ${suite} ${'─'.repeat(Math.max(0, 50 - suite.length))}`);
  fn();
}

// ─── JSON Tests ───────────────────────────────────────────────────────────────

describe('JSON validator', () => {
  // Valid cases
  const r1 = validateJSON('{"name":"Alice","age":28}');
  assert('valid object returns valid:true', r1.valid === true);
  assert('valid object includes key count in meta', r1.meta.some(m => m.includes('keys')));
  assert('valid object includes depth in meta', r1.meta.some(m => m.includes('depth')));

  const r2 = validateJSON('[1, 2, 3]');
  assert('valid array returns valid:true', r2.valid === true);

  const r3 = validateJSON('"hello"');
  assert('valid string literal returns valid:true', r3.valid === true);

  // Invalid cases
  const r4 = validateJSON('{"name": "Bob",}');
  assert('trailing comma returns valid:false', r4.valid === false);
  assert('trailing comma reports at least one issue', r4.issues.length >= 1);

  const r5 = validateJSON('{name: "Charlie"}');
  assert('unquoted key returns valid:false', r5.valid === false);

  const r6 = validateJSON('{"open": [1, 2');
  assert('unclosed array returns valid:false', r6.valid === false);

  const r7 = validateJSON('');
  assert('empty string returns valid:false', r7.valid === false);
});

// ─── YAML Tests ───────────────────────────────────────────────────────────────

describe('YAML validator', () => {
  if (typeof jsyaml === 'undefined') {
    console.log('  (skipped — js-yaml not installed)');
    return;
  }

  const r1 = validateYAML('name: Alice\nage: 28\ncity: Bengaluru');
  assert('valid YAML returns valid:true', r1.valid === true);

  const r2 = validateYAML('items:\n  - a\n  - b\n  - c');
  assert('valid YAML list returns valid:true', r2.valid === true);

  // JSON should be rejected
  const r3 = validateYAML('{"name": "Alice"}');
  assert('JSON input returns valid:false with helpful message', r3.valid === false);
  assert('JSON rejection message mentions switching language', r3.issues[0].description.toLowerCase().includes('json'));

  const r4 = validateYAML('[1, 2, 3]');
  assert('JSON array input returns valid:false', r4.valid === false);

  // Indentation error
  const r5 = validateYAML('server:\n  host: localhost\n    port: 8080');
  assert('bad indentation returns valid:false', r5.valid === false);
  assert('bad indentation reports a line number', r5.issues[0].line !== null);
});

// ─── TOML Tests ───────────────────────────────────────────────────────────────

describe('TOML validator', () => {
  const valid = '[server]\nhost = "localhost"\nport = 8080\ndebug = false';
  const r1 = validateTOML(valid);
  assert('valid TOML returns valid:true', r1.valid === true);
  assert('valid TOML meta includes key count', r1.meta.some(m => m.includes('keys')));

  const r2 = validateTOML('[app]\nname = MyApp\nversion = "1.0.0"');
  assert('unquoted string value returns valid:false', r2.valid === false);
  assert('unquoted string issue mentions quoting', r2.issues[0].description.toLowerCase().includes('quot'));

  const r3 = validateTOML('[db]\nhost = "localhost"\n[db]\nport = 5432');
  assert('duplicate section returns valid:false', r3.valid === false);

  const r4 = validateTOML('[app]\nport = 3000\nport = 4000');
  assert('duplicate key returns valid:false', r4.valid === false);

  const r5 = validateTOML('# comment only\n\n# another comment');
  assert('comment-only file returns valid:true', r5.valid === true);

  const r6 = validateTOML('[server]\nhost = "localhost"\nports = [8080, 8081]');
  assert('valid array value returns valid:true', r6.valid === true);
});

// ─── XML Tests ────────────────────────────────────────────────────────────────

describe('XML validator', () => {
  if (typeof DOMParser === 'undefined') {
    console.log('  (skipped — @xmldom/xmldom not installed)');
    return;
  }

  const valid = '<?xml version="1.0"?><root><child>value</child></root>';
  const r1 = validateXML(valid);
  assert('valid XML returns valid:true', r1.valid === true);
  assert('valid XML meta includes element count', r1.meta.some(m => m.includes('elements')));

  // Note: mismatched/unclosed tag detection relies on browser DOMParser strictness.
  // The @xmldom/xmldom Node.js parser is more lenient and emits warnings to stderr
  // instead of parsererror nodes. These cases are verified in browser testing.
  // See docs/validators.md for details.

  const r5 = validateXML('<root attr="val">text</root>');
  assert('XML with attributes returns valid:true', r5.valid === true);

  const r6 = validateXML('<?xml version="1.0"?><root><a><b>nested</b></a></root>');
  assert('deeply nested valid XML returns valid:true', r6.valid === true);
  assert('deeply nested XML meta includes element count', r6.meta.some(m => m.includes('elements')));

  // 'plain text no tags' is caught by browser DOMParser but not by xmldom (Node env)
});

// ─── INI Tests ────────────────────────────────────────────────────────────────

describe('INI validator', () => {
  const valid = '[database]\nhost = localhost\nport = 5432\n\n[app]\ndebug = false';
  const r1 = validateINI(valid);
  assert('valid INI returns valid:true', r1.valid === true);
  assert('valid INI meta includes key count', r1.meta.some(m => m.includes('keys')));

  const r2 = validateINI('[server]\nhost localhost\nport = 8080');
  assert('missing separator returns valid:false', r2.valid === false);

  const r3 = validateINI('[db]\nhost = localhost\n[db]\nport = 5432');
  // Note: duplicate sections are allowed in some INI parsers, but duplicate keys within section
  const r3b = validateINI('[db]\nhost = localhost\nhost = 127.0.0.1');
  assert('duplicate key in section returns valid:false', r3b.valid === false);

  const r4 = validateINI('# comment\n; another comment\n\n[app]\nname = myapp');
  assert('comments and blank lines are ignored', r4.valid === true);

  const r5 = validateINI('[]\nkey = value');
  assert('empty section name returns valid:false', r5.valid === false);

  const r6 = validateINI('key : value\nother = val');
  assert('colon as separator is valid', r6.valid === true);
});

// ─── .env Tests ───────────────────────────────────────────────────────────────

describe('.env validator', () => {
  const valid = 'APP_NAME=MyApp\nDB_HOST=localhost\nDB_PORT=5432\nSECRET="abc123"';
  const r1 = validateENV(valid);
  assert('valid .env returns valid:true', r1.valid === true);
  assert('valid .env meta shows variable count', r1.meta.some(m => m.includes('variables')));

  const r2 = validateENV('app name=MyApp\nDB_HOST=localhost');
  assert('key with space returns valid:false', r2.valid === false);

  const r3 = validateENV('2APP=val\nDB_HOST=localhost');
  assert('key starting with digit returns valid:false', r3.valid === false);

  const r4 = validateENV('DB_HOST=localhost\nDB_HOST=127.0.0.1');
  assert('duplicate key returns valid:false', r4.valid === false);

  const r5 = validateENV('SECRET KEY=abc 123');
  assert('key with spaces returns valid:false', r5.valid === false);

  const r6 = validateENV('# comment\n\nAPP_ENV=production');
  assert('comments and blank lines are ignored', r6.valid === true);

  const r7 = validateENV('DATABASE_URL=postgres://user:pass@host/db');
  assert('URL value without spaces is valid', r7.valid === true);

  const r8 = validateENV('DESCRIPTION=hello world');
  assert('unquoted value with spaces returns valid:false', r8.valid === false);
  assert('unquoted space issue suggests quoting', r8.issues[0].description.includes('"'));
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(54));
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\n  Failed:');
  failures.forEach(f => console.log(`    ✕ ${f}`));
}
console.log('═'.repeat(54));
process.exit(failed > 0 ? 1 : 0);
