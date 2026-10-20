import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useApi } from '../api'
import { CourseGrid } from '../components/CourseGrid'
import { Tex } from '../components/Tex'
import { Badge, button, Card, Empty, ErrorBox, input, Loading, PageHeader, Pager } from '../components/ui'
import type { CourseDetail, Curriculum as CurriculumType, Page, Question, Topic, TopicDetail, TopicNode, UnitDetail } from '../types'

const SEARCH_PAGE = 20

export function Curriculum() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const offset = Number(params.get('offset') ?? 0)
  const [text, setText] = useState(q)
  const curriculum = useApi<CurriculumType[]>('/curriculum/curriculum')
  const results = useApi<Page<Topic>>(q ? `/curriculum/topics?q=${encodeURIComponent(q)}&limit=${SEARCH_PAGE}&offset=${offset}` : null)

  function search(e: FormEvent) {
    e.preventDefault()
    setParams(text.trim() ? { q: text.trim() } : {})
  }

  return (
    <>
      <PageHeader title="Curriculum" subtitle="The content descriptions and syllabus topics every question is linked to." />
      <form onSubmit={search} className="mb-8 flex gap-2" role="search">
        <label htmlFor="search" className="sr-only">
          Search topics
        </label>
        <input id="search" className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search topics, e.g. quadratic, fractions, probability" />
        <button type="submit" className={button}>
          Search
        </button>
      </form>

      {q ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            {results.data ? `${results.data.total} topics` : 'Topics'} matching “{q}”
          </h2>
          {results.loading && !results.data && <Loading />}
          {results.error && <ErrorBox message={results.error} onRetry={results.reload} />}
          {results.data?.total === 0 && <Empty title="No topics found">Try a different word.</Empty>}
          <ul className="space-y-2">
            {results.data?.items.map((t) => (
              <li key={t.id}>
                <TopicLink topic={t} meta={`${t.course} · ${t.unit}`} />
              </li>
            ))}
          </ul>
          {results.data && (
            <Pager offset={offset} limit={SEARCH_PAGE} total={results.data.total} onChange={(o) => setParams({ q, offset: String(o) })} />
          )}
        </section>
      ) : (
        <>
          {curriculum.error && <ErrorBox message={curriculum.error} onRetry={curriculum.reload} />}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {curriculum.data?.map((c) => (
              <Card key={c.id}>
                <Badge className="bg-blue-50 text-blue-900">{c.code}</Badge>
                <h2 className="mt-2 font-semibold">{c.name}</h2>
                <p className="text-sm text-slate-600">
                  {c.authority} · version {c.version} · {c.courses} courses
                </p>
              </Card>
            ))}
          </div>
          <CourseGrid link={(c) => `/curriculum/courses/${c.id}`} />
        </>
      )}
    </>
  )
}

function TopicLink({ topic, meta }: { topic: { id: number; code: string | null; name: string; hours?: number | null }; meta?: string }) {
  return (
    <Link
      to={`/curriculum/topics/${topic.id}`}
      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-900/40 hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        {meta && <p className="text-xs font-semibold text-slate-500">{meta}</p>}
        <p className="text-sm text-slate-800">
          <Tex text={topic.name} />
        </p>
      </div>
      {topic.code && <Badge className="bg-blue-50 text-blue-900">{topic.code}</Badge>}
      {topic.hours && <Badge>{topic.hours} h</Badge>}
    </Link>
  )
}

export function CurriculumCourse() {
  const { id } = useParams()
  const { data, error, loading, reload } = useApi<CourseDetail>(`/curriculum/courses/${id}`)
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox message={error ?? 'Course not found'} onRetry={reload} />

  return (
    <>
      <PageHeader
        title={data.name}
        subtitle={`${data.units.length} units`}
        back={{ to: '/curriculum', label: 'Curriculum' }}
        action={
          <Link to={`/practice/${data.code}`} className={button}>
            Practise {data.name}
          </Link>
        }
      />
      <div className="space-y-8">
        {data.units.map((u) => (
          <Unit key={u.id} id={u.id} name={u.name} />
        ))}
      </div>
    </>
  )
}

function Unit({ id, name }: { id: number; name: string }) {
  const { data, error } = useApi<UnitDetail>(`/curriculum/units/${id}`)
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{name}</h2>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading />}
      <ul className="space-y-2">
        {data?.topics.map((t) => (
          <TopicTree key={t.id} topic={t} />
        ))}
      </ul>
    </section>
  )
}

function TopicTree({ topic }: { topic: TopicNode }) {
  return (
    <li>
      <TopicLink topic={topic} />
      {topic.subtopics.length > 0 && (
        <ul className="mt-2 ml-4 space-y-2 border-l-2 border-slate-200 pl-4">
          {topic.subtopics.map((s) => (
            <TopicTree key={s.id} topic={s} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function CurriculumTopic() {
  const { id } = useParams()
  const { data, error, loading, reload } = useApi<TopicDetail>(`/curriculum/topics/${id}`)
  const questions = useApi<Page<Question>>(`/question/questions?topic_id=${id}&limit=1`)
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorBox message={error ?? 'Topic not found'} onRetry={reload} />

  return (
    <>
      <PageHeader
        title={data.code ?? <Tex text={data.name} />}
        subtitle={`${data.course} · ${data.unit}${data.hours ? ` · ${data.hours} hours` : ''}`}
        back={data.parent_id ? { to: `/curriculum/topics/${data.parent_id}`, label: 'Parent topic' } : { to: `/curriculum/courses/${data.course_id}`, label: data.course }}
        action={
          questions.data && questions.data.total > 0 ? (
            <Link to={`/practice/topic/${data.id}`} className={button}>
              Practise {questions.data.total} questions
            </Link>
          ) : undefined
        }
      />
      {data.code && (
        <Card className="mb-6">
          <p className="text-lg leading-relaxed">
            <Tex text={data.name} />
          </p>
        </Card>
      )}
      {data.subtopics.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Subtopics</h2>
          <ul className="space-y-2">
            {data.subtopics.map((s) => (
              <li key={s.id}>
                <TopicLink topic={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.outcomes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{data.curriculum === 'AC9' ? 'Elaborations' : 'Subject matter'}</h2>
          <Card>
            <ul className="list-disc space-y-2 pl-5 text-slate-800 marker:text-slate-400">
              {data.outcomes.map((o) => (
                <li key={o.id}>
                  <Tex text={o.description} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  )
}
