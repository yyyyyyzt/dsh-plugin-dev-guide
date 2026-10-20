// Real storage stack over a temp dir: Context + Storage hub + JSON backend + DomainFacility.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility, type Domain } from '@deepseek-ai/dsh-storage-domain'
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import { reviewDomain } from '../../src/store/domain.js'
import { defaultConfig, type ReviewConfig } from '../../src/host/config.js'
import { ReviewStore, type StoreDeps } from '../../src/host/store.js'
import { shippedPack } from '../helpers.js'

export interface OpenedDomain {
  ctx: Context
  domain: Domain<typeof reviewDomain>
  close(): Promise<void>
}

export async function openDomain(root: string): Promise<OpenedDomain> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  const backend = new JsonStorageBackend(root)
  ctx.storage.backend.register('json', backend)
  const facility = new DomainFacility(ctx, { backend: 'json' })
  const domain = await facility.open(reviewDomain)
  return {
    ctx,
    domain,
    async close() {
      await domain.close()
      await backend.close()
      await ctx.fiber.dispose()
    },
  }
}

export interface OpenedStore extends OpenedDomain {
  store: ReviewStore
  root: string
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567'
let counter = 0
/** Deterministic base32 ids (k3m7aa, k3m7ab, …) so reviewIds are stable across a test. */
export const fixedDeps: StoreDeps = {
  now: () => new Date('2026-10-19T08:00:00.000Z'),
  randomId: () => {
    const n = counter++
    return `k3m7${BASE32[Math.floor(n / 32) % 32]}${BASE32[n % 32]}`
  },
}

export async function openStore(
  overrides: Partial<ReviewConfig> = {},
  root?: string,
  deps: StoreDeps = fixedDeps,
): Promise<OpenedStore> {
  const dir = root ?? (await mkdtemp(join(tmpdir(), 'wsgw-store-')))
  const opened = await openDomain(dir)
  const store = new ReviewStore(opened.domain, { ...defaultConfig(), ...overrides }, [shippedPack()], deps)
  return { ...opened, store, root: dir }
}

export async function removeRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true })
}
