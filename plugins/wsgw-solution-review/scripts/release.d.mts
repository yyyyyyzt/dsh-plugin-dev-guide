export declare function distManifest(manifest: Record<string, unknown>): Record<string, unknown>
export declare function uncoveredExports(manifest: { files?: string[]; exports?: unknown }): string[]
export declare function releaseTag(name: string, version: string): string
export declare function installSpecs(repositoryUrl: string, tag: string, commit: string): { tag: string; commit: string }
