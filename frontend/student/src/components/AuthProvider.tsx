import { useEffect, useState, type ReactNode } from 'react'
import { api, savedSession, saveSession } from '../api'
import { AuthContext } from '../auth'
import type { Session, User } from '../types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => savedSession()?.user ?? null)

  useEffect(() => {
    const expired = () => {
      saveSession(null)
      setUser(null)
    }
    window.addEventListener('session-expired', expired)
    // A saved token may have been logged out elsewhere; a 401 here triggers session-expired
    if (savedSession()) api('/account/me').catch(() => {})
    return () => window.removeEventListener('session-expired', expired)
  }, [])

  async function login(username: string, password: string) {
    const session = await api<Session>('/account/login', { username, password })
    saveSession(session)
    setUser(session.user)
  }

  async function register(username: string, password: string) {
    await api('/account/register', { username, password })
    await login(username, password)
  }

  async function logout() {
    await api('/account/logout', undefined, 'POST').catch(() => {})
    saveSession(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
}
