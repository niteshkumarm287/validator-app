# Validator Behaviour Reference

Detailed notes on how each validator works, what it checks, and known edge cases.

---

## JSON

**Parser:** Native `JSON.parse()`

**Checks:**
- Syntax correctness (brackets, commas, quotes, colons)
- Value type validity

**Stats reported on success:**
- File size in bytes
- Total key count
- Maximum nesting depth
- Object and array count

**Line number extraction:**
Chrome and Edge report `position N` (character offset) in the error message. The validator converts this to a line number by counting newlines before that offset. Firefox and Safari report `line N` directly.

**Edge cases:**
- `null`, `true`, `false`, and bare numbers are valid JSON — the validator accepts them
- An empty string is invalid and returns an error

---

## YAML

**Parser:** `js-yaml` v4 loaded from cdnjs

**Checks:**
- Full YAML 1.2 syntax
- Indentation consistency
- Duplicate keys (strict mode)

**JSON rejection:**
Because valid JSON is also valid YAML (YAML is a superset of JSON), pasting JSON while YAML is selected would silently pass. The validator detects this by checking if the trimmed input starts with `{` or `[` and successfully parses as JSON — if so, it returns an error with a message directing the user to switch to JSON mode.

**Line numbers:**
`js-yaml` provides a `mark` object with `line` (0-indexed) and `column` on parse errors. The validator adds 1 to convert to 1-indexed line numbers.

**Edge cases:**
- YAML allows unquoted strings — `key: value` is valid
- Inline JSON objects like `{key: value}` are valid YAML and will pass
- Multi-document YAML (`---` separator) is parsed as a single document

---

## TOML

**Parser:** Custom regex-based line parser

**Checks:**
- Section header syntax: `[section.name]`
- Key-value pairs: `key = value`
- Duplicate sections
- Duplicate keys (globally scoped per section)
- Value type validity: strings must be quoted, booleans must be `true`/`false`, numbers must be numeric
- Unclosed strings
- Unclosed arrays (single-line only)

**Supported value types:**
| Type | Example |
|------|---------|
| String | `"hello"` or `'hello'` |
| Integer | `42` |
| Float | `3.14` |
| Boolean | `true` / `false` |
| Date | `2024-01-15` |
| Array | `[1, 2, 3]` |
| Inline table | `{key = "val"}` |

**Known limitations:**
- Multi-line strings (`"""..."""`) are not validated beyond detecting the opening delimiter
- Multi-line arrays spanning multiple lines are not supported by the line parser
- TOML datetime with time component (`2024-01-15T10:00:00Z`) passes the date check

---

## XML

**Parser:** Native browser `DOMParser` with `application/xml` MIME type

**Checks:**
- Well-formedness (matching tags, proper nesting, valid attribute syntax)
- Encoding declaration
- Entity references

**Stats reported on success:**
- Total element count
- Total attribute count

**Line numbers:**
Browser error messages include `line N at column M`. The validator extracts line numbers via regex from the `parsererror` element text content.

**Edge cases:**
- XML declaration (`<?xml version="1.0"?>`) is optional — valid without it
- HTML entities like `&nbsp;` are not valid in XML without a DTD — will fail
- CDATA sections are valid and pass through correctly
- Namespace prefixes (`<ns:element>`) are supported

---

## INI

**Parser:** Custom line-by-line parser

**Checks:**
- Section header syntax: `[SectionName]`
- Key-value pairs with `=` or `:` separator
- Empty section names
- Duplicate keys within a section

**Comment syntax:**
Lines starting with `;` or `#` are treated as comments and ignored.

**Separator support:**
Both `key = value` and `key : value` are accepted.

**Duplicate key detection:**
Keys are tracked per section. The full key identifier is `[SectionName].key`. Global (sectionless) keys are tracked without a prefix.

**Edge cases:**
- Duplicate section headers are not flagged (some INI parsers merge them; behaviour is implementation-defined)
- Values are not type-checked — INI has no standard type system
- Inline comments (e.g. `key = value  ; comment`) are not stripped — the comment becomes part of the value

---

## .env

**Parser:** Custom line-by-line parser

**Checks:**
- Key format: `UPPER_SNAKE_CASE` only (`A-Z`, `0-9`, `_`; cannot start with a digit)
- Presence of `=` separator
- Empty keys
- Duplicate keys
- Unquoted values containing spaces (warns and suggests quoting)
- Unclosed string literals

**Comment syntax:**
Lines starting with `#` are treated as comments and ignored. Blank lines are skipped.

**Key naming rules:**
Keys must match `/^[A-Z_][A-Z0-9_]*$/`. Common violations:
- Lowercase letters: `db_host` → should be `DB_HOST`
- Spaces: `APP NAME` → should be `APP_NAME`
- Starting with digit: `2FA_SECRET` → not valid

**Value rules:**
- Values with spaces must be wrapped in `"double"` or `'single'` quotes
- URLs without spaces are valid unquoted: `DATABASE_URL=postgres://user:pass@host/db`
- Quotes must be balanced (opening quote must have matching closing quote)

**Edge cases:**
- `KEY=` (empty value) is valid
- `KEY="  "` (whitespace-only quoted value) is valid
- Export prefix (`export KEY=value`) is not supported — `export` would be flagged as an invalid key name
