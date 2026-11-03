import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const pluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const repoRoot = resolve(pluginDir, '../..')
export const publicDataDir = join(repoRoot, 'paper/data/public')

export function parseArgs(argv, defaults) {
  const out = { ...defaults }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

export function fromRoot(p) {
  return isAbsolute(p) ? p : resolve(repoRoot, p)
}

export async function loadEngine() {
  return import(pathToFileURL(join(pluginDir, 'lib/engine/index.js')).href)
}

export async function loadEval() {
  return import(pathToFileURL(join(pluginDir, 'lib/eval/index.js')).href)
}

export async function loadPack(engine, file) {
  const path = file ? fromRoot(file) : join(pluginDir, 'rules/capability-open-access.rules.yaml')
  return { pack: engine.parseRulePack(readFileSync(path, 'utf8')), path }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

export async function loadAdapter(spec) {
  if (!spec) return null
  const mod = await import(pathToFileURL(fromRoot(spec)).href)
  const candidate = mod.default ?? mod.adapter
  const adapter = typeof candidate === 'function' ? await candidate() : candidate
  if (!adapter || typeof adapter.complete !== 'function' || typeof adapter.model !== 'string') {
    throw new Error(`adapter module ${spec} must export { model: string, complete(messages, { temperature }) }`)
  }
  return adapter
}
