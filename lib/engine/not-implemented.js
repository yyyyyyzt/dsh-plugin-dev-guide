export class NotImplementedError extends Error {
    constructor(unit) {
        super(`not implemented (S3a): ${unit}`);
        this.name = 'NotImplementedError';
    }
}
//# sourceMappingURL=not-implemented.js.map