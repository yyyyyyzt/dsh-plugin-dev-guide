// Tool-facing errors (design.md §8): a HarnessError subclass so the DSH tool runtime routes on `code`.
import { HarnessError } from '@deepseek-ai/dsh-llm';
export class ReviewToolError extends HarnessError {
    code;
    constructor(code, message) {
        super(message, code);
        this.code = code;
        this.name = 'ReviewToolError';
    }
}
//# sourceMappingURL=errors.js.map