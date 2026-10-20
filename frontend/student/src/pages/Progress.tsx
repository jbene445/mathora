import { useState } from 'react'
import { Link } from 'react-router'
import { useApi } from '../api'
import { Tex } from '../components/Tex'
import { Badge, button, Card, Empty, ErrorBox, Loading, PageHeader, Pager, secondaryButton } from '../components/ui'
import { useCourses } from '../courses'
import { formatDate, percent, scoreColour } from '../format'
import type { CourseProgress, HistoryItem, Page, Recommendation, Summary, TopicProgress } from '../types'
import { Stat } from './Home'

const HISTORY_PAGE = 10
const TOPICS_SHOWN = 8

export function Progress() {
  const summary = useApi<Summary>('/progress/me/summary')
  const s = summary.data

  return (
    <>
      <PageHeader title="Progress" subtitle={s?.last_active ? `Last active ${formatDate(s.last_active)}` : 'Your answers from practice and quizzes.'} />
      {summary.loading && !s && <Loading />}
      {summary.error && <ErrorBox message={summary.error} onRetry={summary.reload} />}
      {s && s.answered === 0 && (
        <Empty title="Nothing here yet">
          Answer some{' '}
          <Link to="/practice" className="font-semibold text-blue-900 underline">
            practice questions
          </Link>{' '}
          or take a{' '}
          <Link to="/quizzes" className="font-semibold text-blue-900 underline">
            quiz
          </Link>{' '}
          while logged in and your progress will show here.
        </Empty>
      )}
      {s && s.answered > 0 && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Questions answered" value={s.answered.toLocaleString()} />
            <Stat label="Accuracy" value={percent(s.accuracy)} />
            <Stat label="Quizzes completed" value={s.quizzes.toLocaleString()} />
            <Stat label="Average quiz score" value={percent(s.average_quiz_score)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Recommendations />
            <Courses />
          </div>
          <Topics />
          <History />
        </div>
      )}
    </>
  )
}

function Recommendations() {
  const { data, error } = useApi<Recommendation[]>('/progress/me/recommendations')
  const courses = useCourses()
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Practise next</h2>
      {error && <ErrorBox message={error} />}
      {data?.length === 0 && <Empty title="You're on track">No weak topics right now.</Empty>}
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.topic_id}>
            <Card className="flex items-center gap-4 !p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-500">
                  {[courses.name(r.course), r.code].filter(Boolean).join(' · ')} · <span className="text-blue-900">{r.reason}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-800">
                  <Tex text={r.topic} />
                </p>
              </div>
              <Link to={`/practice/topic/${r.topic_id}`} className={`${button} shrink-0 !px-3 !py-1.5`}>
                Practise
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Bar({ value }: { value: number }) {
  const colour = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  )
}

function Courses() {
  const { data, error } = useApi<CourseProgress[]>('/progress/me/courses')
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">By course</h2>
      {error && <ErrorBox message={error} />}
      <Card className="space-y-4">
        {data?.map((c) => (
          <div key={c.course}>
            <div className="mb-1 flex justify-between text-sm">
              <Link to={`/practice/${c.course}`} className="font-medium hover:text-blue-900">
                {c.name}
              </Link>
              <span className="text-slate-500">
                {c.correct}/{c.answered} · <span className="font-semibold text-slate-900">{percent(c.accuracy)}</span>
              </span>
            </div>
            <Bar value={c.accuracy} />
          </div>
        ))}
      </Card>
    </section>
  )
}

function Topics() {
  const { data, error } = useApi<TopicProgress[]>('/progress/me/topics')
  const [all, setAll] = useState(false)
  const courses = useCourses()
  const shown = all ? data : data?.slice(0, TOPICS_SHOWN)
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">By topic, weakest first</h2>
      {error && <ErrorBox message={error} />}
      <Card className="divide-y divide-slate-100 !p-0">
        {shown?.map((t) => (
          <Link key={t.topic_id} to={`/practice/topic/${t.topic_id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-500">{[courses.name(t.course), t.code ?? t.unit].join(' · ')}</p>
              <p className="truncate text-sm text-slate-800">
                <Tex text={t.topic} />
              </p>
            </div>
            <div className="hidden w-32 sm:block">
              <Bar value={t.accuracy} />
            </div>
            <Badge className={scoreColour(t.accuracy)}>
              {t.correct}/{t.answered}
            </Badge>
          </Link>
        ))}
      </Card>
      {data && data.length > TOPICS_SHOWN && (
        <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${data.length} topics`}
        </button>
      )}
    </section>
  )
}

function History() {
  const [offset, setOffset] = useState(0)
  const { data, error } = useApi<Page<HistoryItem>>(`/progress/me/history?limit=${HISTORY_PAGE}&offset=${offset}`)
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Recent answers</h2>
      {error && <ErrorBox message={error} />}
      <Card className="divide-y divide-slate-100 !p-0">
        {data?.items.map((h) => (
          <div key={h.id} className="flex items-start gap-3 px-5 py-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                h.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
              aria-label={h.correct ? 'Correct' : 'Incorrect'}
            >
              {h.correct ? '✓' : '✗'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900">
                <Tex text={h.prompt} />
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Answered <span className="font-mono text-slate-700">{h.answer}</span> · {formatDate(h.created_at)}
                {h.quiz_id && (
                  <>
                    {' · '}
                    <Link to={`/quizzes/${h.quiz_id}`} className="text-blue-900 hover:underline">
                      Quiz
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </Card>
      {data && <Pager offset={offset} limit={HISTORY_PAGE} total={data.total} onChange={setOffset} />}
    </section>
  )
}
