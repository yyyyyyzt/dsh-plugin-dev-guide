import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { distManifest, installSpecs, releaseTag, uncoveredExports } from '../../scripts/release.mjs'

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'package.json'), 'utf8')) as Record<string, unknown>

describe('T-DES-15 release manifest', () => {
  it('drops scripts and devDependencies and keeps what DSH and pnpm read', () => {
    const before = structuredClone(pkg)
    const out = distManifest(pkg)
    expect(pkg).toEqual(before)
    expect(out).not.toHaveProperty('scripts')
    expect(out).not.toHaveProperty('devDependencies')
    for (const key of ['name', 'version', 'type', 'main', 'exports', 'files', 'engines', 'dependencies', 'peerDependencies', 'dsh']) {
      expect(out[key]).toEqual(pkg[key])
    }
  })

  it('leaves no prepare hook so a git install never builds', () => {
    expect((pkg['scripts'] as Record<string, string>)['prepare']).toBeDefined()
    expect(JSON.stringify(distManifest(pkg))).not.toContain('"prepare"')
  })

  it('every exports target is shipped by files', () => {
    expect(uncoveredExports(pkg)).toEqual([])
    expect(uncoveredExports({ files: ['lib/**/*.js'], exports: { '.': './lib/index.js', './x': './extra/x.yml' } })).toEqual(['./extra/x.yml'])
  })
})

describe('T-DES-16 release tag and install specs', () => {
  it('names the tag after the package and version', () => {
    expect(releaseTag('wsgw-solution-review', '0.1.0-dev.0')).toBe('wsgw-solution-review-v0.1.0-dev.0')
  })

  it('derives GitHub install specs from repository.url', () => {
    const sha = 'a'.repeat(40)
    expect(installSpecs('git+https://github.com/yyyyyyzt/dsh-plugin-dev-guide.git', 'wsgw-solution-review-v1.0.0', sha)).toEqual({
      tag: 'https://github.com/yyyyyyzt/dsh-plugin-dev-guide#wsgw-solution-review-v1.0.0',
      commit: `https://github.com/yyyyyyzt/dsh-plugin-dev-guide#${sha}`,
    })
    expect(installSpecs('https://github.com/o/r', 't', sha).tag).toBe('https://github.com/o/r#t')
  })

  it('rejects a repository that is not on GitHub', () => {
    expect(() => installSpecs('git+https://gitlab.com/o/r.git', 't', 'b'.repeat(40))).toThrow(/GitHub/)
  })
})
