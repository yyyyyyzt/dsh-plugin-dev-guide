// Plugin Config (design.md §3.2 / §11): schemastery; edited in the profile's plugin row.
import z from '@deepseek-ai/schemastery';
export const Config = z.object({
    rulesDir: z.union([z.string(), z.const(null)]).default(null).description('规则包目录（*.rules.yaml）；null = 使用包内 rules/'),
    outputDir: z.string().default('reviews').description('正式意见输出目录（相对会话工作目录）'),
    minorThreshold: z.natural().min(1).default(3).description('确认的 minor 问题达到该数量时，预审结论由「通过」变为「建议整改」'),
    askBatchSize: z.natural().min(1).max(20).default(5).description('复核阶段每次 ask_user_question 最多呈现的问题数'),
    rejectWarnRatio: z.number().min(0).max(1).default(0.6).description('memory_recall.warn 的驳回率阈值（reject / shown）'),
    rejectWarnMinSamples: z.natural().default(5).description('memory_recall.warn 生效所需的最少呈现次数'),
    exemplarsPerRule: z.natural().default(20).description('每条规则保留的范例措辞数量（最新优先）'),
    maxSourceBytes: z.natural().min(1024).default(204800).description('review_parse 接受的方案最大字节数'),
    presentOnFinalize: z.boolean().default(true).description('定稿后是否由 agent 调用 present 展示意见文件'),
    defaultReviewer: z.string().default('').description('默认审核人署名；为空时复核前询问一次'),
}).description('wsgw-solution-review：网上国网技术方案 AI 预审（只建议，不裁决）');
/** Schemastery drops a `null` default from the output; restore it so callers can rely on the key. */
export function resolveConfig(input = {}) {
    const parsed = Config(input);
    return { ...parsed, rulesDir: parsed.rulesDir ?? null };
}
export function defaultConfig() {
    return resolveConfig({});
}
//# sourceMappingURL=config.js.map