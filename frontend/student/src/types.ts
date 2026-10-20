export type User = { id: number; username: string }
export type Session = { token: string; expires_at: string; user: User }
export type Page<T> = { items: T[]; total: number; limit: number; offset: number }

export type Curriculum = { id: number; code: string; name: string; authority: string; version: string; courses: number }
export type Course = { id: number; code: string; name: string; curriculum: string }
export type CourseDetail = Course & { units: { id: number; name: string; topics: number }[] }
export type TopicNode = { id: number; code: string | null; name: string; hours: number | null; subtopics: TopicNode[] }
export type UnitDetail = { id: number; name: string; course_id: number; course: string; curriculum: string; topics: TopicNode[] }
export type Topic = {
  id: number
  code: string | null
  name: string
  hours: number | null
  parent_id: number | null
  unit_id: number
  unit: string
  course_id: number
  course: string
  curriculum: string
}
export type TopicDetail = Topic & {
  subtopics: { id: number; code: string | null; name: string; hours: number | null }[]
  outcomes: { id: number; description: string }[]
}

export type AnswerType = 'integer' | 'decimal' | 'fraction' | 'set' | 'expression' | 'expanded' | 'factored' | 'simplified'
export type Question = {
  id: number
  prompt: string
  answer_type: AnswerType
  difficulty: number
  topic_id: number
  topic_code: string | null
  topic: string
  unit: string
  course: string
}
export type PracticeTopic = { id: number; code: string | null; name: string; unit: string; course: string; questions: number }
export type CheckResult = { question_id: number; given: string; correct: boolean; expected: string; recorded: boolean }

export type QuizQuestion = Question & { position: number; answer?: string; correct?: boolean; expected?: string }
export type Quiz = {
  id: number
  course: string | null
  code: string | null
  topic_id: number | null
  difficulty: number | null
  total: number
  correct: number | null
  created_at: string
  submitted_at: string | null
  score: number | null
  questions: QuizQuestion[]
}
export type QuizListItem = Omit<Quiz, 'questions'> & { topic: string | null }

export type Summary = {
  username: string
  answered: number
  correct: number
  questions: number
  last_active: string | null
  accuracy: number | null
  quizzes: number
  average_quiz_score: number | null
}
export type CourseProgress = { course: string; name: string; answered: number; correct: number; accuracy: number }
export type TopicProgress = {
  topic_id: number
  code: string | null
  topic: string
  unit: string
  course: string
  answered: number
  correct: number
  accuracy: number
  last_attempt: string
}
export type Recommendation = { topic_id: number; code: string | null; topic: string; course: string; reason: string }
export type HistoryItem = {
  id: number
  question_id: number
  prompt: string
  answer: string
  correct: boolean
  quiz_id: number | null
  created_at: string
  code: string | null
  topic: string
  course: string
}
