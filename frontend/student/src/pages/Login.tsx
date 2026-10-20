import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../auth'
import { button, Card, ErrorBox, input } from '../components/ui'

export function Login({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isLogin = mode === 'login'

  if (user) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await (isLogin ? login : register)(username, password)
      navigate(next, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const other = isLogin ? '/register' : '/login'
  return (
    <div className="mx-auto max-w-sm py-6">
      <h1 className="text-2xl font-bold tracking-tight">{isLogin ? 'Log in' : 'Create an account'}</h1>
      <p className="mt-1 mb-6 text-slate-600">{isLogin ? 'Welcome back.' : 'Save your practice, take quizzes and track your progress.'}</p>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorBox message={error} />}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="username"
              className={input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="off"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers and underscores"
              autoFocus
            />
            {!isLogin && <p className="mt-1 text-xs text-slate-500">3–30 letters, numbers or underscores</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={8}
              maxLength={128}
            />
            {!isLogin && <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>}
          </div>
          <button type="submit" className={`${button} w-full`} disabled={busy}>
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        {isLogin ? 'New to Mathora? ' : 'Already have an account? '}
        <Link to={next === '/' ? other : `${other}?next=${encodeURIComponent(next)}`} className="font-semibold text-blue-900 hover:underline">
          {isLogin ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </div>
  )
}
