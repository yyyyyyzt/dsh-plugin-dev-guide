// Fetch hooks over the same-origin API: load on mount / version bump, reload after a write. No polling.
import { useCallback, useEffect, useState } from 'react'
import { requestJson } from './model.js'

export const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))
export const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
export const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) })

export interface Loaded<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
}

export function useLoad<T>(path: string | null, version: number): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const reload = useCallback(async () => {
    if (path === null) return
    setLoading(true)
    setError(null)
    try {
      setData(await requestJson<T>(path))
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }, [path])
  useEffect(() => {
    void reload()
  }, [reload, version])
  return { data, error, loading, reload }
}

export interface Writer {
  busy: string | null
  error: string | null
  run: (key: string, path: string, init: RequestInit) => Promise<boolean>
}

/** Runs one write, reports its error, then reloads whatever the write affected. */
export function useWrite(after: () => Promise<void>): Writer {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (key: string, path: string, init: RequestInit) => {
    setBusy(key)
    setError(null)
    try {
      await requestJson(path, init)
      await after()
      return true
    } catch (e) {
      setError(message(e))
      return false
    } finally {
      setBusy(null)
    }
  }, [after])
  return { busy, error, run }
}
