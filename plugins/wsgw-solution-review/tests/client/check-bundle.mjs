#!/usr/bin/env node
// T-DSH-08 / T-DES-13: static checks on the built client bundle (lib/client.js).
// Exit code 0 = all assertions hold; 1 = at least one failed (details on stderr).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bundlePath = join(root, 'lib', 'client.js')
const PLUGIN_ID = 'wsgw-solution-review'
const EXTERNAL_WHITELIST = [/^react$/, /^react-dom(\/.*)?$/, /^@deepseek-ai\/dsh-client-/]
const BANNER_PREFIX = `window.__ModuleLoader__.load({ id: "${PLUGIN_ID}"`

const failures = []
const assert = (ok, message) => {
  if (!ok) failures.push(message)
}

if (!existsSync(bundlePath)) {
  console.error(`check-bundle: ${bundlePath} does not exist (run pnpm build first)`)
  process.exit(1)
}

const code = readFileSync(bundlePath, 'utf8')
const trimmed = code.trimStart()

assert(trimmed.startsWith(BANNER_PREFIX), `banner must start with ${BANNER_PREFIX}`)
assert(/\}\)\s*;?\s*$/.test(code.trimEnd()), 'footer must close the ModuleLoader.load(...) call')

const required = new Set()
for (const m of code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) required.add(m[1])
for (const id of required) {
  assert(
    EXTERNAL_WHITELIST.some((re) => re.test(id)),
    `require("${id}") is not in the externals whitelist`,
  )
}
assert(required.has('react'), 'bundle must externalise react via require("react")')

assert(!/__SECRET_INTERNAL|createRoot\s*=\s*function|ReactCurrentDispatcher/.test(code), 'React appears to be inlined')
assert(!/\bprocess\.env\.NODE_ENV\b/.test(code), 'process.env.NODE_ENV must be replaced at build time')
assert(code.length < 1_000_000, `bundle is unexpectedly large (${code.length} bytes)`)

if (failures.length) {
  console.error('check-bundle: FAILED')
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log(`check-bundle: ok (${code.length} bytes, externals: ${[...required].join(', ')})`)
