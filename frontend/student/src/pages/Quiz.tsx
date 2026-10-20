import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, useApi } from '../api'
import { AnswerInput } from '../components/AnswerInput'
import { Tex } from '../components/Tex'
import { Badge, button, Card, ErrorBox, Loading, PageHeader, secondaryButton } from '../components/ui'
import { useCourses } from '../courses'
import { answerToLatex, DIFFICULTY, formatDate, scoreColour } from '../format'
import type { Quiz as QuizType } from '../types'

// Unsubmitted answers survive a page refresh
function loadDraft(id: string): Record<number, string> {
  try {
    return JSON.parse(sessionStorage.getItem(`mathora-quiz-${id}`) ?? '{}')
  } catch {
    return {}
  }
}

function saveDraft(id: string, answers: Record<number, string> | null) {
  try {
    if (answers) sessionStorage.setItem(`mathora-quiz-${id}`, JSON.stringify(answers))
    else sessionStorage.removeItem(`mathora-quiz-${id}`)
  } catch {
    // Storage can be blocked; the draft just isn't kept
  }
}

export function Quiz() {
  const { id = '' } = useParams()
  const loaded = useApi<QuizType>(`/quiz/quizzes/${id}`)
  const courses = useCourses()
  const [submitted, setSubmitted] = useState<QuizType | null>(null)
  const [answers, setAnswers] = useState<Record<number, string>>(() => loadDraft(id))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const quiz = submitted ?? loaded.data

  useEffect(() => {
    if (quiz && !quiz.submitted_at) saveDraft(id, answers)
  }, [id, quiz, answers])

  if (loaded.loading && !quiz) return <Loading />
  if (loaded.error || !quiz) return <ErrorBox message={loaded.error ?? 'Quiz not found'} onRetry={loaded.reload} />

  const done = quiz.submitted_at !== null
  const answered = quiz.questions.filter((q) => answers[q.id]?.trim()).length
  // A quiz on one topic, chosen by ID or code
  const topic = quiz.topic_id || quiz.code ? quiz.questions[0] : null

  async function submit() {
    const blank = quiz!.total - answered
    if (blank > 0 && !window.confirm(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered and will be marked wrong. Submit anyway?`)) return
    setBusy(true)
    setError('')
    try {
      const result = await api<QuizType>(`/quiz/quizzes/${id}/submit`, {
        answers: quiz!.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? '' })),
      })
      saveDraft(id, null)
      setSubmitted(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={`${topic?.topic_code ?? courses.name(quiz.course)} quiz`}
        subtitle={
          <>
            {topic && <Tex text={topic.topic} className="block" />}
            {[courses.name(quiz.course), quiz.difficulty && DIFFICULTY[quiz.difficulty], `${quiz.total} questions`, formatDate(quiz.created_at)]
              .filter(Boolean)
              .join(' · ')}
          </>
        }
        back={{ to: '/quizzes', label: 'Quizzes' }}
      />

      {done && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold ${scoreColour(quiz.score)}`}>{quiz.score}%</span>
            <div>
              <p className="text-lg font-semibold">
                {quiz.correct} of {quiz.total} correct
              </p>
              <p className="text-sm text-slate-500">Submitted {formatDate(quiz.submitted_at!)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {topic && (
              <Link to={`/practice/topic/${topic.topic_id}`} className={secondaryButton}>
                Practise this topic
              </Link>
            )}
            <Link to="/quizzes" className={button}>
              New quiz
            </Link>
          </div>
        </Card>
      )}

      <ol className="space-y-4">
        {quiz.questions.map((q) => (
          <li key={q.id}>
            <Card className={done ? (q.correct ? 'border-l-4 !border-l-emerald-500' : 'border-l-4 !border-l-rose-500') : ''}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-500">Question {q.position}</span>
                {done ? (
                  <Badge className={q.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}>{q.correct ? 'Correct' : 'Incorrect'}</Badge>
                ) : (
                  <Badge>{DIFFICULTY[q.difficulty]}</Badge>
                )}
              </div>
              <p className="mb-4 text-lg leading-relaxed">
                <Tex text={q.prompt} />
              </p>
              {done ? (
                <dl className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
                  <dt className="text-slate-500">Your answer</dt>
                  <dd>{q.answer?.trim() ? <Tex text={`$${answerToLatex(q.answer)}$`} /> : <span className="text-slate-400">No answer</span>}</dd>
                  {!q.correct && q.expected && (
                    <>
                      <dt className="text-slate-500">Answer</dt>
                      <dd className="font-medium">
                        <Tex text={`$${answerToLatex(q.expected)}$`} />
                      </dd>
                    </>
                  )}
                </dl>
              ) : (
                <AnswerInput
                  id={`answer-${q.id}`}
                  value={answers[q.id] ?? ''}
                  onChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
                  answerType={q.answer_type}
                />
              )}
            </Card>
          </li>
        ))}
      </ol>

      {!done && (
        <div className="sticky bottom-0 mt-6 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur">
          {error && (
            <div className="mb-3">
              <ErrorBox message={error} />
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600">
              {answered} of {quiz.total} answered
            </span>
            <button type="button" className={button} onClick={submit} disabled={busy}>
              {busy ? 'Marking…' : 'Submit quiz'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
