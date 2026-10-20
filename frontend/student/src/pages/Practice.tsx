import { Link, useParams } from 'react-router'
import { useApi } from '../api'
import { CourseGrid } from '../components/CourseGrid'
import { Tex } from '../components/Tex'
import { Badge, Empty, ErrorBox, Loading, PageHeader } from '../components/ui'
import { useCourses } from '../courses'
import type { PracticeTopic } from '../types'

export function PracticeCourses() {
  return (
    <>
      <PageHeader title="Practice" subtitle="Choose a year level or senior course." />
      <CourseGrid link={(c) => `/practice/${c.code}`} />
    </>
  )
}

export function PracticeTopics() {
  const { course = '' } = useParams()
  const courses = useCourses()
  const { data, error, loading, reload } = useApi<PracticeTopic[]>(`/question/topics?course=${encodeURIComponent(course)}`)

  // Keep the API's curriculum order, grouped by unit
  const units: { name: string; topics: PracticeTopic[] }[] = []
  for (const t of data ?? []) {
    const unit = units.find((u) => u.name === t.unit)
    if (unit) unit.topics.push(t)
    else units.push({ name: t.unit, topics: [t] })
  }

  return (
    <>
      <PageHeader title={courses.name(course)} subtitle="Choose a topic to practise." back={{ to: '/practice', label: 'All courses' }} />
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty title="No questions for this course yet" />}
      <div className="space-y-8">
        {units.map((u) => (
          <section key={u.name}>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">{u.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {u.topics.map((t) => (
                <Link
                  key={t.id}
                  to={`/practice/topic/${t.id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-900/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    {t.code ? <Badge className="bg-blue-50 text-blue-900">{t.code}</Badge> : <span />}
                    <span className="text-xs text-slate-500">{t.questions} questions</span>
                  </div>
                  <Tex text={t.name} className="text-sm text-slate-800 group-hover:text-slate-950" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
