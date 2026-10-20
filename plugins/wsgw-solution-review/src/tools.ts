// Preset sub-plugin `wsgw-solution-review/tools`: mounts the nine tools inside the 方案审查 agent preset,
// so only that agent sees them. The host entry (`wsgw-solution-review`) must be loaded for `ctx.solutionReview`.
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-working-directory'
import { createReviewTools, type ToolIo } from './host/tools.js'
import type {} from './host/service.js'

export const name = 'wsgw-solution-review/tools'
export const inject = ['tools', 'solutionReview', 'fs', 'workingDirectory']

async function cwdOf(ctx: Context, exec: ToolRunContext): Promise<string | undefined> {
  if (!exec.agent) return undefined
  return ctx.workingDirectory.ensure(exec.agent, exec.signal)
}

/** Reads and writes go through `ctx.fs` only (design.md §13): DSH's file-system policy applies to both. */
export function fsToolIo(ctx: Context, outputDir: () => string): ToolIo {
  return {
    async readText(path, exec) {
      const cwd = await cwdOf(ctx, exec)
      const target = await ctx.fs.resolve(path, { ...(cwd ? { cwd } : {}), signal: exec.signal })
      return ctx.fs.readText(target, exec.signal)
    },
    async writeOpinion(fileName, content, exec) {
      const cwd = await cwdOf(ctx, exec)
      const dir = outputDir().replace(/[\\/]+$/u, '')
      const target = await ctx.fs.resolve(dir ? `${dir}/${fileName}` : fileName, { ...(cwd ? { cwd } : {}), signal: exec.signal })
      await ctx.fs.writeText(target, content, undefined, exec.signal)
      return target.displayPath
    },
  }
}

export function apply(ctx: Context): void {
  const store = ctx.solutionReview
  const io = fsToolIo(ctx, () => store.config.outputDir)
  for (const tool of createReviewTools(store, io)) ctx.tools.register(tool)
}
