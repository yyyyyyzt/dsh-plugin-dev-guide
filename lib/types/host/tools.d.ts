import { type ToolDefinition, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import { type ReviewStore } from './store.js';
export interface ToolIo {
    /** Read a Markdown source by the path the expert gave (resolved against the session working directory). */
    readText(path: string, exec: ToolRunContext): Promise<string>;
    /** Write the opinion under `config.outputDir` and return the path to report. */
    writeOpinion(fileName: string, content: string, exec: ToolRunContext): Promise<string>;
}
export declare function createReviewTools(store: ReviewStore, io: ToolIo): ToolDefinition[];
