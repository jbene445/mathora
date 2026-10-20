import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, useApi } from '../api'
import { Tex } from '../components/Tex'
import { Badge, button, Card, Empty, ErrorBox, Loading, PageHeader, Pager, select } from '../components/ui'
import { useCourses } from '../courses'
import { DIFFICULTY, formatDate, scoreColour } from '../format'
import type { Page, PracticeTopic, Quiz, QuizListItem } from '../types'

const PAGE = 10

export function Quizzes() {
  const [offset, setOffset] = useState(0)
  const quizzes = useApi<Page<QuizListItem>>(`/quiz/quizzes?limit=${PAGE}&offset=${offset}`)
  const courses = useCourses()

  return (
    <>
      <PageHeader title="Quizzes" subtitle="Answer a set of questions, then see your score and every answer." />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <NewQuiz />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Your quizzes</h2>
          {quizzes.loading && !quizzes.data && <Loading />}
          {quizzes.error && <ErrorBox message={quizzes.error} onRetry={quizzes.reload} />}
          {quizzes.data?.total === 0 && <Empty title="No quizzes yet">Start your first quiz to see it here.</Empty>}
          <ul className="space-y-2">
            {quizzes.data?.items.map((q) => (
              <li key={q.id}>
                <Link
                  to={`/quizzes/${q.id}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-900/40 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {q.topic ? <Tex text={q.topic} /> : `${courses.name(q.course)} · all topics`}
                    </p>
                    <p className="text-sm text-slate-500">
                      {[q.topic && courses.name(q.course), q.difficulty && DIFFICULTY[q.difficulty], `${q.total} questions`, formatDate(q.created_at)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {q.submitted_at ? (
                    <Badge className={scoreColour(q.score)}>{q.score}%</Badge>
                  ) : (
                    <Badge className="bg-blue-50 text-blue-900">In progress</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {quizzes.data && <Pager offset={offset} limit={PAGE} total={quizzes.data.total} onChange={setOffset} />}
        </section>
      </div>
    </>
  )
}

function NewQuiz() {
  const navigate = useNavigate()
  const courses = useCourses()
  const [course, setCourse] = useState('9')
  const [topicId, setTopicId] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [count, setCount] = useState('10')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const topics = useApi<PracticeTopic[]>(`/question/topics?course=${encodeURIComponent(course)}`)

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const quiz = await api<Quiz>('/quiz/quizzes', {
        course,
        topic_id: topicId ? Number(topicId) : null,
        difficulty: difficulty ? Number(difficulty) : null,
        count: Number(count),
      })
      navigate(`/quizzes/${quiz.id}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card className="h-fit">
      <h2 className="mb-4 text-lg font-semibold">New quiz</h2>
      <form onSubmit={start} className="space-y-4">
        {error && <ErrorBox message={error} />}
        <Field label="Course" id="course">
          <select
            id="course"
            className={select}
            value={course}
            onChange={(e) => {
              setCourse(e.target.value)
              setTopicId('')
            }}
          >
            {courses.data?.items.map((c) => (
              <option key={c.id} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Topic" id="topic">
          <select id="topic" className={select} value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={topics.loading}>
            <option value="">All topics</option>
            {topics.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {/* Options can't show maths, so strip the $ signs */}
                {[t.code, t.name.replace(/\\?\$/g, (m) => (m === '\\$' ? '$' : ''))].filter(Boolean).join(' – ')}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Difficulty" id="difficulty">
            <select id="difficulty" className={select} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">Any</option>
              {Object.entries(DIFFICULTY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Questions" id="count">
            <select id="count" className={select} value={count} onChange={(e) => setCount(e.target.value)}>
              {['5', '10', '20'].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>
        <button type="submit" className={`${button} w-full`} disabled={busy || !courses.data}>
          {busy ? 'Creating…' : 'Start quiz'}
        </button>
      </form>
    </Card>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  )
}
