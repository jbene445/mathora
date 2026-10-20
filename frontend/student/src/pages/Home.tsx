import { Link } from 'react-router'
import { useApi } from '../api'
import { useAuth } from '../auth'
import { Card } from '../components/ui'
import { percent } from '../format'
import type { Page, Question, Summary } from '../types'

const FEATURES = [
  { to: '/practice', title: 'Practice', text: 'Pick a year level and topic, then answer questions one at a time with instant marking.' },
  { to: '/quizzes', title: 'Quizzes', text: 'Take a quiz on a course or topic and review every answer when you finish.' },
  { to: '/progress', title: 'Progress', text: 'See your accuracy by course and topic, and which topics to practise next.' },
  { to: '/curriculum', title: 'Curriculum', text: 'Browse and search the curriculum content and elaborations behind every question.' },
]

export function Home() {
  const { user } = useAuth()
  const questions = useApi<Page<Question>>('/question/questions?limit=1')
  const summary = useApi<Summary>(user ? '/progress/me/summary' : null)

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-blue-900 px-6 py-12 text-white shadow-sm sm:px-10">
        <p className="text-sm font-semibold tracking-wide text-blue-200 uppercase">Foundation to Year 12</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Maths practice that follows the curriculum</h1>
        <p className="mt-3 max-w-2xl text-blue-100">
          {questions.data ? `${questions.data.total.toLocaleString()} questions` : 'Thousands of questions'} linked to the Australian
          Curriculum and the Queensland senior syllabuses, marked instantly, including algebra.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/practice" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition bg-white text-blue-900 hover:bg-blue-50">
            Start practising
          </Link>
          {user ? (
            <Link to="/quizzes" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition border border-white/40 text-white hover:bg-white/10">
              Take a quiz
            </Link>
          ) : (
            <Link to="/register" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition border border-white/40 text-white hover:bg-white/10">
              Create an account
            </Link>
          )}
        </div>
      </section>

      {user && summary.data && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Welcome back, {user.username}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Questions answered" value={summary.data.answered.toLocaleString()} />
            <Stat label="Accuracy" value={percent(summary.data.accuracy)} />
            <Stat label="Quizzes completed" value={summary.data.quizzes.toLocaleString()} />
            <Stat label="Average quiz score" value={percent(summary.data.average_quiz_score)} />
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Link key={f.to} to={f.to} className="group">
            <Card className="h-full transition group-hover:border-blue-900/40 group-hover:shadow-md">
              <h3 className="font-semibold text-slate-900 group-hover:text-blue-900">{f.title} →</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </Card>
  )
}
