export declare const message: (e: unknown) => string;
export declare const post: (body: unknown) => RequestInit;
export declare const patch: (body: unknown) => RequestInit;
export interface Loaded<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
    reload: () => Promise<void>;
}
export declare function useLoad<T>(path: string | null, version: number): Loaded<T>;
export interface Writer {
    busy: string | null;
    error: string | null;
    run: (key: string, path: string, init: RequestInit) => Promise<boolean>;
}
/** Runs one write, reports its error, then reloads whatever the write affected. */
export declare function useWrite(after: () => Promise<void>): Writer;
