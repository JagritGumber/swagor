# Code Hygiene Review

Use when reviewing code changes, writing new code, or auditing existing code for anti-patterns that cause silent bugs.

## Forbidden Patterns

### 1. Silent Failures

**Never hide errors.** Every failure point must throw with a descriptive message.

```ts
// BAD: silent failure
const data = value ?? []
const item = items?.[0]
const result = fallback || defaultValue

// GOOD: explicit check
if (!value) throw new Error('value is required')
const data = value

if (!items.length) throw new Error('items array is empty')
const item = items[0]
```

### 2. Optional Chaining on DOM Queries

**Never use `?.` on DOM traversal.** Always validate with `instanceof` + throw.

```ts
// BAD: optional chaining hides missing element
const el = document.getElementById('chart')
el?.appendChild(canvas)
const text = document.getElementById('data')?.textContent

// GOOD: explicit validation
const el = document.getElementById('chart')
if (!(el instanceof HTMLElement)) throw new Error('Missing #chart container')
el.appendChild(canvas)

const dataEl = document.getElementById('data')
if (!dataEl) throw new Error('Missing #data script tag')
const text = dataEl.textContent
if (!text) throw new Error('#data is empty')
```

### 3. dangerouslySetInnerHTML on Script Tags

**Never use `dangerouslySetInnerHTML` on `<script>` tags.** Use `{jsonString}` as children instead.

```tsx
// BAD: dangerouslySetInnerHTML causes silent data loss in Remix
<script
  id="app-data"
  type="application/json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
/>

// GOOD: pass JSON string as children
<script id="app-data" type="application/json">
  {JSON.stringify(data)}
</script>
```

### 4. Em Dashes

**Never use em dashes (`—`).** Use hyphens (`-`) only.

```ts
// BAD
const message = "Server error — try again later"

// GOOD
const message = "Server error - try again later"
```

### 5. Data Shape Mismatch

**Always verify server JSON matches client interface.** Mismatches cause silent `undefined` reads.

```ts
// Server sends: { profile: { poc: 123 } }
// Client reads: { poc: 123 }  // WRONG - poc is undefined

// GOOD: match the actual structure
interface ServerData {
  profile: { poc: number; valueAreaLow: number }
}
const poc = data.profile.poc  // correct path
```

### 6. Fallback Defaults That Mask Bugs

**Never use `|| []`, `|| {}`, or `?? fallback` to hide missing data.** If data should exist, throw.

```ts
// BAD: hides missing data
const items = response.data || []
const config = user.settings ?? {}

// GOOD: throw if data is missing
if (!Array.isArray(response.data)) throw new Error('Expected data array')
const items = response.data
```

## Review Checklist

When reviewing code, check for:

- [ ] Any `?.` on `document.getElementById`, `querySelector`, or DOM traversal
- [ ] Any `?? fallback` or `|| defaultValue` that could mask a bug
- [ ] Any `dangerouslySetInnerHTML` on `<script>` tags
- [ ] Any em dashes (`—`) in strings
- [ ] Server JSON shape vs client interface shape
- [ ] Any silent catches that swallow errors
- [ ] Any `console.log` left in production code

## Auto-Fix Patterns

```ts
// Replace silent optional chaining
document.getElementById('x')?.textContent
// With explicit check
const el = document.getElementById('x')
if (!el) throw new Error('Missing element')
el.textContent
```

```tsx
// Replace dangerouslySetInnerHTML
<script dangerouslySetInnerHTML={{ __html: json }} />
// With children
<script>{json}</script>
```
