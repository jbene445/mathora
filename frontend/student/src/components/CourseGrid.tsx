import { Link } from 'react-router'
import { useCourses } from '../courses'
import type { Course } from '../types'
import { ErrorBox, Loading } from './ui'

const GROUPS = [
  { curriculum: 'AC9', title: 'Foundation to Year 10', subtitle: 'Australian Curriculum: Mathematics' },
  { curriculum: 'QCAA', title: 'Senior', subtitle: 'Queensland senior mathematics syllabuses' },
]

export function CourseGrid({ link }: { link: (course: Course) => string }) {
  const { data, error, loading, reload } = useCourses()
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <section key={g.curriculum}>
          <h2 className="text-lg font-semibold text-slate-900">{g.title}</h2>
          <p className="mb-3 text-sm text-slate-500">{g.subtitle}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data?.items
              .filter((c) => c.curriculum === g.curriculum)
              .map((c) => (
                <Link
                  key={c.id}
                  to={link(c)}
                  className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-900/40 hover:shadow-md"
                >
                  <span className="block text-xs font-semibold tracking-wide text-slate-400 uppercase">{c.code}</span>
                  <span className="mt-1 block font-semibold text-slate-900 group-hover:text-blue-900">{c.name}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
