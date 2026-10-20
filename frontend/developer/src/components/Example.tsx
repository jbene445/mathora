import { useState } from 'react'
import { BASE } from '../services'
import { button, CodeBlock, Tabs } from './ui'

type Props = { method: 'GET' | 'POST'; path: string; body?: object; title?: string }

function curl({ method, path, body }: Props) {
  if (method === 'GET') return `curl "${BASE}${path}"`
  return `curl -X POST "${BASE}${path}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`
}

function javascript({ method, path, body }: Props) {
  if (method === 'GET') return `const response = await fetch("${BASE}${path}")\nconst data = await response.json()`
  return `const response = await fetch("${BASE}${path}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, '\n  ')}),
})
const data = await response.json()`
}

// A request shown as curl and JavaScript, which can be sent from the page
export function Example(props: Props) {
  const [result, setResult] = useState<{ status: number; body: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const response = await fetch(`/v1${props.path}`, {
        method: props.method,
        headers: props.body ? { 'Content-Type': 'application/json' } : undefined,
        body: props.body ? JSON.stringify(props.body) : undefined,
      })
      const text = await response.text()
      let pretty = text
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        // Not JSON, e.g. a rate limit page; show it as it is
      }
      setResult({ status: response.status, body: pretty })
    } catch (e) {
      setResult({ status: 0, body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {props.title && <h3 className="font-semibold text-slate-900">{props.title}</h3>}
      <Tabs
        tabs={[
          { label: 'curl', content: <CodeBlock code={curl(props)} label={`${props.method} ${props.path}`} /> },
          { label: 'JavaScript', content: <CodeBlock code={javascript(props)} label={`${props.method} ${props.path}`} /> },
        ]}
      />
      <button type="button" className={button} onClick={run} disabled={busy}>
        {busy ? 'Sending…' : 'Send request'}
      </button>
      {result && <CodeBlock code={result.body} label={result.status ? `Response ${result.status}` : 'Request failed'} />}
    </div>
  )
}
