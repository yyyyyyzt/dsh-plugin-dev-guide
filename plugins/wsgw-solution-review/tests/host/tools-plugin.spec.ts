// Preset sub-entry `wsgw-solution-review/tools` (design.md §3.2, §13): mounts once `tools`, `solutionReview`,
// `fs` and `workingDirectory` are present, registers the nine tools, and routes file I/O through ctx.fs only.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import * as toolsPlugin from '../../src/tools.js'
import { fsToolIo } from '../../src/tools.js'
import { openStore, removeRoot, type OpenedStore } from '../store/harness.js'

const opened: OpenedStore[] = []
afterEach(async () => {
  for (const o of opened.splice(0)) {
    await o.close()
    await removeRoot(o.root)
  }
})

interface Stubs {
  registered: ToolDefinition[]
  resolve: ReturnType<typeof vi.fn>
  readText: ReturnType<typeof vi.fn>
  writeText: ReturnType<typeof vi.fn>
  ensure: ReturnType<typeof vi.fn>
}

function stubServices(ctx: Context): Stubs {
  const stubs: Stubs = {
    registered: [],
    resolve: vi.fn(async (path: string, opts?: { cwd?: string }) => ({ displayPath: opts?.cwd ? `${opts.cwd}/${path}` : path })),
    readText: vi.fn(async () => '# 标题\n正文'),
    writeText: vi.fn(async () => undefined),
    ensure: vi.fn(async () => '/ws'),
  }
  ctx.provide('tools', { register: (d: ToolDefinition) => { stubs.registered.push(d); return () => undefined } })
  ctx.provide('fs', { resolve: stubs.resolve, readText: stubs.readText, writeText: stubs.writeText })
  ctx.provide('workingDirectory', { ensure: stubs.ensure })
  return stubs
}

describe('wsgw-solution-review/tools preset entry', () => {
  it('declares the preset-side inject list and registers the nine tools once mounted', async () => {
    expect(toolsPlugin.name).toBe('wsgw-solution-review/tools')
    expect([...toolsPlugin.inject].sort()).toEqual(['fs', 'solutionReview', 'tools', 'workingDirectory'])

    const o = await openStore()
    opened.push(o)
    const stubs = stubServices(o.ctx)
    o.ctx.provide('solutionReview', o.store)
    await o.ctx.plugin(toolsPlugin)
    expect(stubs.registered.map((t) => t.name).sort()).toEqual([
      'memory_recall', 'review_check', 'review_decide', 'review_finalize', 'review_parse',
      'review_record_issue', 'review_status', 'rules_list', 'rules_propose',
    ])
  })

  it('fsToolIo resolves paths against the agent working directory and never touches node:fs', async () => {
    const o = await openStore()
    opened.push(o)
    const stubs = stubServices(o.ctx)
    const io = fsToolIo(o.ctx, () => 'reviews')
    const exec = { agent: { id: 'a1' }, signal: new AbortController().signal } as unknown as ToolRunContext

    await expect(io.readText('方案.md', exec)).resolves.toBe('# 标题\n正文')
    expect(stubs.ensure).toHaveBeenCalledWith(exec.agent, exec.signal)
    expect(stubs.resolve).toHaveBeenCalledWith('方案.md', expect.objectContaining({ cwd: '/ws' }))

    const path = await io.writeOpinion('rv_x.md', '# 意见', exec)
    expect(path).toBe('/ws/reviews/rv_x.md')
    expect(stubs.writeText).toHaveBeenCalledWith({ displayPath: '/ws/reviews/rv_x.md' }, '# 意见', undefined, exec.signal)
  })

  it('without an agent on the run context, paths resolve without a cwd override', async () => {
    const o = await openStore()
    opened.push(o)
    const stubs = stubServices(o.ctx)
    const io = fsToolIo(o.ctx, () => '')
    const exec = { signal: new AbortController().signal } as unknown as ToolRunContext
    await io.writeOpinion('rv_y.md', 'x', exec)
    expect(stubs.ensure).not.toHaveBeenCalled()
    expect(stubs.resolve).toHaveBeenCalledWith('rv_y.md', expect.not.objectContaining({ cwd: expect.anything() }))
  })
})
