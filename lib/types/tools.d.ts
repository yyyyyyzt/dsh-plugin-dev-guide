import type { Context } from '@deepseek-ai/cordis';
import { type ToolIo } from './host/tools.js';
export declare const name = "wsgw-solution-review/tools";
export declare const inject: string[];
/** Reads and writes go through `ctx.fs` only (design.md §13): DSH's file-system policy applies to both. */
export declare function fsToolIo(ctx: Context, outputDir: () => string): ToolIo;
export declare function apply(ctx: Context): void;
