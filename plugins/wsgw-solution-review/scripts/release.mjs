#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ALWAYS_PACKED = new Set(['package.json', 'README.md'])

export function distManifest(manifest) {
  const { scripts: _scripts, devDependencies: _devDependencies, ...rest } = structuredClone(manifest)
  return rest
}

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  if (value === null || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

function patternMatcher(pattern) {
  const clean = pattern.replace(/^\.\//, '').replace(/\/$/, '')
  if (!/[*?]/.test(clean)) return (path) => path === clean || path.startsWith(`${clean}/`)
  const source = clean
    .split(/(\*\*\/|\*|\?)/)
    .map((part) => (part === '**/' ? '(?:.*/)?' : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('')
  const regex = new RegExp(`^${source}$`)
  return (path) => regex.test(path)
}

export function uncoveredExports(manifest) {
  const matchers = (manifest.files ?? []).map(patternMatcher)
  return [...new Set(exportTargets(manifest.exports))].filter((target) => {
    const path = target.replace(/^\.\//, '')
    return !ALWAYS_PACKED.has(path) && !matchers.some((match) => match(path))
  })
}

export function releaseTag(name, version) {
  return `${name}-v${version}`
}

export function installSpecs(repositoryUrl, tag, commit) {
  const match = /^(?:git\+)?https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?\/?$/.exec(repositoryUrl)
  if (!match) throw new Error(`release: repository.url must be a GitHub https URL, got ${repositoryUrl}`)
  const base = `https://github.com/${match[1]}/${match[2]}`
  return { tag: `${base}#${tag}`, commit: `${base}#${commit}` }
}

function run(command, args, options = {}) {
  return (execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }) ?? '').trim()
}

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function main(argv) {
  const push = argv.includes('--push')
  const pluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const git = (args, options) => run('git', args, { cwd: pluginDir, ...options })
  const manifest = JSON.parse(readFileSync(join(pluginDir, 'package.json'), 'utf8'))
  const tag = releaseTag(manifest.name, manifest.version)
  const missing = uncoveredExports(manifest)
  if (missing.length > 0) fail(`exports not covered by files: ${missing.join(', ')}`)
  if (git(['status', '--porcelain', '--', '.']) !== '') fail('the plugin directory has uncommitted changes; commit them first')
  if (git(['tag', '--list', tag]) !== '') fail(`tag ${tag} already exists locally; bump package.json version`)
  if (git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]) !== '') fail(`tag ${tag} already exists on origin; bump package.json version`)
  const head = git(['rev-parse', 'HEAD'])
  const gitDir = git(['rev-parse', '--absolute-git-dir'])

  run('pnpm', ['run', 'build'], { cwd: pluginDir, stdio: 'inherit' })
  run('node', ['tests/client/check-bundle.mjs'], { cwd: pluginDir, stdio: 'inherit' })

  const work = mkdtempSync(join(tmpdir(), 'wsgw-release-'))
  try {
    run('pnpm', ['pack', '--pack-destination', work], { cwd: pluginDir, stdio: 'inherit' })
    const tarball = readdirSync(work).find((file) => file.endsWith('.tgz'))
    if (!tarball) fail('pnpm pack produced no tarball')
    run('tar', ['-xzf', join(work, tarball), '-C', work])
    const packageDir = join(work, 'package')
    writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(distManifest(manifest), null, 2)}\n`)

    const env = { ...process.env, GIT_INDEX_FILE: join(work, 'index') }
    const tree = (args) => run('git', [`--git-dir=${gitDir}`, `--work-tree=${packageDir}`, ...args], { cwd: packageDir, env })
    tree(['add', '--all', '--force', '.'])
    const treeId = tree(['write-tree'])
    const commit = tree(['commit-tree', treeId, '-m', `chore(review): release ${manifest.name} ${manifest.version}\n\nBuilt from ${head}.`])
    git(['tag', '-a', tag, commit, '-m', `${manifest.name} ${manifest.version}`])
    if (push) run('git', ['push', 'origin', `refs/tags/${tag}`], { cwd: pluginDir, stdio: 'inherit' })

    const specs = installSpecs(manifest.repository?.url ?? '', tag, commit)
    console.log(`\nrelease: tagged ${tag} -> ${commit}${push ? ' (pushed)' : ' (local only; re-run with --push or git push origin refs/tags/' + tag + ')'}`)
    console.log(`install (needs git):    ${specs.tag}`)
    console.log(`install (no git needed): ${specs.commit}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
