import z from '@deepseek-ai/schemastery';
export interface ReviewConfig {
    /** Directory of `*.rules.yaml` packs; `null` loads the packs shipped inside the package. */
    rulesDir: string | null;
    /** Where formal opinions are written, relative to the session working directory. */
    outputDir: string;
    /** Number of confirmed `minor` issues that turns 通过 into 建议整改. */
    minorThreshold: number;
    /** Maximum issues per `ask_user_question` batch during review. */
    askBatchSize: number;
    /** `memory_recall.warn` fires when reject / shown reaches this ratio… */
    rejectWarnRatio: number;
    /** …and the rule has been shown at least this many times. */
    rejectWarnMinSamples: number;
    /** Newest exemplar wordings kept per rule. */
    exemplarsPerRule: number;
    /** Largest Markdown source accepted by `review_parse`, in bytes. */
    maxSourceBytes: number;
    /** Whether the skill asks the agent to `present` the opinion file after finalize. */
    presentOnFinalize: boolean;
    /** Reviewer name used when the session never set one (empty = ask). */
    defaultReviewer: string;
}
export declare const Config: z<ReviewConfig>;
/** Schemastery drops a `null` default from the output; restore it so callers can rely on the key. */
export declare function resolveConfig(input?: unknown): ReviewConfig;
export declare function defaultConfig(): ReviewConfig;
