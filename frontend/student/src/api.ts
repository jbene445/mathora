import { useEffect, useState } from 'react'
import type { Session } from './types'

const SESSION_KEY = 'mathora-session'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function savedSession(): Session | null {
  try {
    const session: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return session && new Date(session.expires_at) > new Date() ? session : null
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private windows can block storage; the session then lasts until the page reloads
  }
}

function message(detail: unknown, status: number) {
  if (typeof detail === 'string') return detail
  // FastAPI validation errors are a list
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
  return status >= 500 ? 'The server is unavailable, try again shortly' : `Request failed (${status})`
}

export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const token = savedSession()?.token
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(response.status, message(data?.detail, response.status))
  }
  return data as T
}

// Loads a GET path, reloading when it changes; null skips loading
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{ key?: string; path?: string; data?: T; error?: string }>({})
  const key = `${path}#${version}`

  useEffect(() => {
    if (path === null) return
    let current = true
    api<T>(path).then(
      (data) => current && setState({ key, path, data }),
      (e: Error) => current && setState({ key, path, error: e.message }),
    )
    return () => {
      current = false
    }
  }, [path, key])

  return {
    // A reload keeps showing the old data; a new path doesn't
    data: state.path === path ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: path !== null && state.key !== key,
    reload: () => setVersion((v) => v + 1),
  }
}
