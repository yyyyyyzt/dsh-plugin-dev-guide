// Bundle manifest + cordis.patch.yml contract (design.md §3, T-DES-12 offline half, T-PRO-10).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { resolveConfig } from '../../src/host/config.js'
import { prefix as personaPrefix } from '../../src/persona.js'
import { rulesDir } from '../helpers.js'

const pkgDir = join(rulesDir, '..')
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
// Same custom tag DSH's plugin-manager uses so `!!js` expressions parse as plain strings.
const patch = parse(readFileSync(join(pkgDir, 'cordis.patch.yml'), 'utf8'), {
  customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }],
}) as { insert: Row[] }[]

interface Row {
  id: string
  name: string
  config?: Record<string, unknown>
}

const rows = (): Row[] => patch.flatMap((layer) => layer.insert ?? [])
const row = (id: string): Row => {
  const r = rows().find((x) => x.id === id)
  if (!r) throw new Error(`row ${id} missing`)
  return r
}

describe('package.json bundle manifest', () => {
  it('declares dsh.bundle.patch, the sub-entries the patch needs, and files that ship them', () => {
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(pkg.main).toBe('lib/index.js')
    for (const sub of ['.', './tools', './persona', './cordis.patch.yml', './package.json']) expect(pkg.exports[sub], sub).toBeDefined()
    for (const f of ['rules', 'skills', 'cordis.patch.yml']) expect(pkg.files).toContain(f)
    expect(pkg.files.some((f: string) => f.startsWith('lib'))).toBe(true)
    expect(pkg.engines.dsh).toMatch(/0\.2\.1/)
  })

  it('lists every shared dsh package in both peerDependencies and devDependencies at the same version', () => {
    const peers = Object.entries(pkg.peerDependencies as Record<string, string>)
    expect(peers.length).toBeGreaterThan(0)
    for (const [name, range] of peers) {
      expect(name.startsWith('@deepseek-ai/')).toBe(true)
      expect(pkg.devDependencies[name], name).toBe(range)
      expect(pkg.dependencies?.[name], `${name} must not be a runtime dependency`).toBeUndefined()
    }
    expect(pkg.scripts['dsh:install']).toContain('plugin --profile web add')
  })
})

describe('cordis.patch.yml', () => {
  it('inserts the host row named after the package with a config the schemastery Config accepts', () => {
    const host = row('wsgw-solution-review')
    expect(host.name).toBe(pkg.name)
    const parsed = resolveConfig(host.config)
    expect(parsed).toMatchObject({ rulesDir: null, outputDir: 'reviews', minorThreshold: 3, askBatchSize: 5, maxSourceBytes: 204800 })
  })

  it('inserts the 方案审查 preset with persona text identical to src/persona.ts and the tools sub-entry last', () => {
    const preset = row('preset-wsgw-solution-review')
    expect(preset.name).toBe('@deepseek-ai/dsh-agent-preset')
    const config = preset.config as { id: string; name: string; order: number; plugins: Row[] }
    expect(config.id).toBe('wsgw-solution-review')
    expect(config.name).toBe('方案审查')
    const persona = config.plugins.find((p) => p.name === '@deepseek-ai/dsh-persona')
    expect(persona?.config?.['prefix']).toBe(personaPrefix)
    expect(personaPrefix).not.toMatch(/\{\{/)
    const last = config.plugins.at(-1)
    expect(last?.name).toBe(`${pkg.name}/tools`)
    const names = config.plugins.map((p) => p.name)
    expect(names).toContain('@deepseek-ai/dsh-tool-ask-user')
    expect(names).toContain('@deepseek-ai/dsh-tool-present')
    expect(names).toContain('@deepseek-ai/dsh-tool-skill')
    expect(names).not.toContain('@deepseek-ai/dsh-agent-instructions')
    expect(names).not.toContain('@deepseek-ai/dsh-tool-web')
  })

  it('uses ids that do not collide with the web profile rows', () => {
    const ids = rows().map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('wsgw-solution-review') || id.startsWith('preset-wsgw')).toBe(true)
  })
})
