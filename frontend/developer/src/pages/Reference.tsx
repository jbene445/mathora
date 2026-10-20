import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router'
import { SERVICES } from '../services'

type Spec = {
  info: { title: string; description?: string }
  servers?: { url: string }[]
  paths: Record<string, Record<string, { parameters?: { name: string; in: string }[] }>>
}

// The services' own docs, trimmed to what developers can use through this site
function publicSpec(spec: Spec, id: string, summary: string): Spec {
  const paths: Spec['paths'] = {}
  for (const [path, operations] of Object.entries(spec.paths)) {
    if (path === '/' || path === '/health') continue
    paths[path] = Object.fromEntries(
      Object.entries(operations).map(([method, op]) => [
        method,
        { ...op, parameters: op.parameters?.filter((p) => !(p.in === 'header' && p.name.toLowerCase() === 'authorization')) },
      ]),
    )
  }
  const name = SERVICES.find((s) => s.id === id)?.name ?? spec.info.title
  return { ...spec, info: { ...spec.info, title: name, description: summary }, servers: [{ url: `/v1/${id}` }], paths }
}

export function Reference() {
  const { service } = useParams()
  const current = SERVICES.find((s) => s.id === service)
  const node = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    let active = true
    Promise.all([
      import('swagger-ui-dist/swagger-ui-es-bundle.js'),
      import('swagger-ui-dist/swagger-ui.css'),
      fetch(`/v1/${current.id}/openapi.json`).then((r) => {
        if (!r.ok) throw new Error(`Could not load the ${current.name} docs (${r.status})`)
        return r.json()
      }),
    ])
      .then(([swagger, , spec]) => {
        if (!active || !node.current) return
        setError('')
        swagger.default({
          domNode: node.current,
          spec: publicSpec(spec, current.id, current.summary),
          deepLinking: false,
          defaultModelsExpandDepth: 0,
          docExpansion: 'list',
          tryItOutEnabled: true,
        })
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [current])

  if (!current) return <Navigate to="/reference/question" replace />

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">API reference</h1>
      <p className="mt-1 mb-6 text-slate-600">Every public endpoint. Open one and press Execute to send a real request.</p>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {SERVICES.map((s) => (
          <NavLink
            key={s.id}
            to={`/reference/${s.id}`}
            role="tab"
            className={({ isActive }) =>
              `rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`
            }
          >
            {s.name}
          </NavLink>
        ))}
      </div>
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div key={current.id} ref={node} className="min-h-96" />
      </div>
    </div>
  )
}
