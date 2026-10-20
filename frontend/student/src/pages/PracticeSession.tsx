import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { api } from '../api'
import { useAuth } from '../auth'
import { AnswerInput } from '../components/AnswerInput'
import { Tex } from '../components/Tex'
import { Badge, button, Card, Empty, ErrorBox, Loading, PageHeader, secondaryButton } from '../components/ui'
import { useCourses } from '../courses'
import { answerToLatex, DIFFICULTY } from '../format'
import type { CheckResult, Question } from '../types'

export function PracticeSession() {
  const { topicId } = useParams()
  const { user } = useAuth()
  const courses = useCourses()
  const [params, setParams] = useSearchParams()
  const difficulty = params.get('difficulty') ?? ''
  const [question, setQuestion] = useState<Question | null>(null)
  const [topic, setTopic] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [none, setNone] = useState(false)
  const [tally, setTally] = useState({ answered: 0, correct: 0 })

  const next = useCallback(
    async (previous?: number) => {
      try {
        // Ask for two so the same question doesn't come up twice in a row
        const picked = await api<Question[]>(`/question/questions/random?topic_id=${topicId}&count=2${difficulty && `&difficulty=${difficulty}`}`)
        const q = picked.find((p) => p.id !== previous) ?? picked[0] ?? null
        setQuestion(q)
        setNone(!q)
        if (q) setTopic(q)
        setAnswer('')
        setResult(null)
        setError('')
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [topicId, difficulty],
  )

  useEffect(() => {
    next()
  }, [next])

  function skipTo(previous?: number) {
    setBusy(true)
    next(previous)
  }

  async function check() {
    if (!question || !answer.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await api<CheckResult>('/answer/check', { question_id: question.id, answer })
      setResult(r)
      setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (r.correct ? 1 : 0) }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={topic ? (topic.topic_code ?? 'Practice') : 'Practice'}
        subtitle={topic && <Tex text={topic.topic} />}
        back={topic ? { to: `/practice/${topic.course}`, label: `${courses.name(topic.course)} topics` } : { to: '/practice', label: 'All courses' }}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Difficulty">
          {['', '1', '2', '3'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setParams(d ? { difficulty: d } : {}, { replace: true })}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                difficulty === d ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d ? DIFFICULTY[Number(d)] : 'Any'}
            </button>
          ))}
        </div>
        {tally.answered > 0 && (
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {tally.correct} / {tally.answered}
            </span>{' '}
            correct this session
          </span>
        )}
      </div>

      {!user && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Link to={`/login?next=/practice/topic/${topicId}`} className="font-semibold underline">
            Log in
          </Link>{' '}
          to save your answers to your progress.
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBox message={error} onRetry={() => (result || !question ? skipTo(question?.id) : check())} />
        </div>
      )}
      {!question && busy && <Loading label="Finding a question…" />}
      {none && <Empty title="No questions at this difficulty">Try another difficulty.</Empty>}

      {question && (
        <Card className="!p-6">
          <div className="mb-4 flex items-center gap-2">
            <Badge>{DIFFICULTY[question.difficulty]}</Badge>
          </div>
          <p className="mb-5 text-lg leading-relaxed text-slate-900">
            <Tex text={question.prompt} />
          </p>
          <AnswerInput
            key={question.id}
            id="answer"
            value={answer}
            onChange={setAnswer}
            answerType={question.answer_type}
            // After checking, the box stays focused so Enter goes to the next question
            onEnter={() => (result ? skipTo(question.id) : check())}
            readOnly={!!result}
            autoFocus
          />

          {result && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 ${result.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}
              role="status"
            >
              <p className="font-semibold">{result.correct ? 'Correct!' : 'Not quite.'}</p>
              {!result.correct && (
                <p className="mt-1 text-sm">
                  The answer is <Tex text={`$${answerToLatex(result.expected)}$`} />
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {result ? (
              <button type="button" className={button} onClick={() => skipTo(question.id)} disabled={busy}>
                Next question →
              </button>
            ) : (
              <>
                <button type="button" className={button} onClick={check} disabled={busy || !answer.trim()}>
                  Check answer
                </button>
                <button type="button" className={secondaryButton} onClick={() => skipTo(question.id)} disabled={busy}>
                  Skip
                </button>
              </>
            )}
          </div>
        </Card>
      )}
    </>
  )
}
