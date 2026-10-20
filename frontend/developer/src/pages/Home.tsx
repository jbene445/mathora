import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Example } from '../components/Example'
import { Card, Code } from '../components/ui'
import { BASE, SERVICES } from '../services'

const FACTS = [
  { title: 'No API key', text: 'Send requests straight away; nothing to sign up for.' },
  { title: '10 requests a second', text: 'Per IP address, with short bursts of up to 20.' },
  { title: 'JSON', text: 'Every request and response body is JSON.' },
  { title: 'LaTeX maths', text: 'Maths in text is LaTeX between $ signs, ready for KaTeX or MathJax.' },
]

export function Home() {
  const [questions, setQuestions] = useState<number | null>(null)

  useEffect(() => {
    fetch('/v1/question/questions?limit=1')
      .then((r) => r.json())
      .then((d) => setQuestions(d.total))
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-blue-900 px-6 py-12 text-white shadow-sm sm:px-10">
        <p className="text-sm font-semibold tracking-wide text-blue-200 uppercase">Mathora API</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Curriculum-linked maths questions, marking and a solver for your app</h1>
        <p className="mt-3 max-w-2xl text-blue-100">
          {questions ? `${questions.toLocaleString()} questions` : 'Thousands of questions'} from Foundation to senior, an answer marker that
          understands algebra, and the full Australian and Queensland maths curriculum.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/guide" className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50">
            Get started
          </Link>
          <Link to="/reference" className="inline-flex items-center rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
            API reference
          </Link>
        </div>
        <p className="mt-6 text-sm text-blue-200">
          Base URL <code className="rounded bg-white/10 px-2 py-1 font-mono break-all text-white">{BASE}</code>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FACTS.map((f) => (
          <Card key={f.title} className="!p-4">
            <p className="font-semibold text-slate-900">{f.title}</p>
            <p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold tracking-tight">APIs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <Link key={s.id} to={`/reference/${s.id}`} className="group">
              <Card className="h-full transition group-hover:border-blue-900/40 group-hover:shadow-md">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-900">{s.name} →</h3>
                <p className="mt-1 text-sm text-slate-600">{s.summary}</p>
                <p className="mt-3">
                  <Code>{s.example}</Code>
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-1 text-xl font-bold tracking-tight">Quick start</h2>
          <p className="mb-4 text-slate-600">Get three random Year 9 questions…</p>
          <Example method="GET" path="/question/questions/random?course=9&count=3" />
        </div>
        <div className="min-w-0">
          <h2 className="mb-1 hidden text-xl font-bold tracking-tight lg:block">&nbsp;</h2>
          <p className="mb-4 text-slate-600">…then mark an answer to one of them by its ID.</p>
          <Example method="POST" path="/answer/check" body={{ question_id: 1, answer: '9' }} />
        </div>
      </section>
    </div>
  )
}
