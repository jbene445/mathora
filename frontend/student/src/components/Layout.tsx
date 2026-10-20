import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth'

const LINKS = [
  { to: '/practice', label: 'Practice' },
  { to: '/quizzes', label: 'Quizzes' },
  { to: '/progress', label: 'Progress' },
  { to: '/curriculum', label: 'Curriculum' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            Mathora
          </Link>
          <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                    isActive ? 'bg-blue-50 text-blue-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden text-slate-600 sm:inline">
                  Signed in as <span className="font-semibold text-slate-900">{user.username}</span>
                </span>
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => logout().then(() => navigate('/'))}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  Log in
                </Link>
                <Link to="/register" className="rounded-md bg-blue-900 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500">
          Questions are linked to the Australian Curriculum: Mathematics v9.0 and the QCAA senior mathematics syllabuses.
        </div>
      </footer>
    </div>
  )
}
