import { useApi } from './api'
import type { Course, Page } from './types'

export function useCourses() {
  const courses = useApi<Page<Course>>('/curriculum/courses?limit=50')
  const name = (code: string | null) => courses.data?.items.find((c) => c.code === code)?.name ?? (code ? `Course ${code}` : 'Any course')
  return { ...courses, name }
}
