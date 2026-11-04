export class NotImplementedError extends Error {
  constructor(unit: string) {
    super(`not implemented (S3a): ${unit}`)
    this.name = 'NotImplementedError'
  }
}
