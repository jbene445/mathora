import { Link, NavLink, Outlet } from 'react-router'

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/guide', label: 'Guide', end: false },
  { to: '/reference', label: 'API reference', end: false },
]

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-blue-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            Mathora <span className="font-medium text-slate-500">Developers</span>
          </Link>
          <nav className="-mx-1 flex gap-1 overflow-x-auto">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
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
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500">
          Curriculum content is from the Australian Curriculum: Mathematics v9.0 (ACARA) and the QCAA senior mathematics syllabuses.
        </div>
      </footer>
    </div>
  )
}
