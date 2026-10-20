import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Example } from '../components/Example'
import { Card, Code, CodeBlock } from '../components/ui'
import { BASE } from '../services'

const SECTIONS = [
  { id: 'basics', title: 'Basics' },
  { id: 'limits', title: 'Rate limits' },
  { id: 'errors', title: 'Errors' },
  { id: 'pages', title: 'Pagination' },
  { id: 'maths', title: 'Maths in text' },
  { id: 'courses', title: 'Courses' },
  { id: 'answers', title: 'Answer formats' },
  { id: 'solver', title: 'Writing expressions' },
  { id: 'quiz', title: 'Example: a quiz' },
]

const ANSWER_TYPES = [
  ['integer', 'A whole number', '42, -7, x = 4'],
  ['decimal', 'An exact decimal', '3.75, 1,250.5'],
  ['fraction', 'A fraction, mixed number or decimal of the same value', '3/4, 1 1/2, 0.75'],
  ['set', 'Every answer, in any order', '2, -3 or 2 and -3'],
  ['expression', 'Any equivalent expression; + c is optional for antiderivatives', '3x^2 + 2x + c'],
  ['expanded', 'Equivalent and fully expanded', 'x^2 + 5x + 6'],
  ['factored', 'Equivalent and fully factorised', '(x + 2)(x + 3)'],
  ['simplified', 'Equivalent, with no more terms than the answer', '5x + 2'],
]

const QUIZ = `const BASE = "${BASE}"

// 1. Five random Year 7 questions on one topic
const questions = await fetch(\`\${BASE}/question/questions/random?code=AC9M7A03&count=5\`)
  .then((r) => r.json())

// 2. Show each prompt (LaTeX between $ signs) and collect answers
const answers = questions.map((q) => ({ question_id: q.id, answer: prompt(q.prompt) ?? "" }))

// 3. Mark them all at once
const result = await fetch(\`\${BASE}/answer/check/batch\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ answers }),
}).then((r) => r.json())

console.log(\`\${result.correct} of \${result.total} correct (\${result.score}%)\`)`

const KATEX = `import katex from "katex"

// "\\$" is a dollar sign; anything else between $ signs is LaTeX
function render(text) {
  return text
    .replace(/\\\\\\$/g, "\\u0000")
    .split("$")
    .map((part, i) => (i % 2 ? katex.renderToString(part.replace(/\\u0000/g, "\\\\$")) : part.replace(/\\u0000/g, "$")))
    .join("")
}`

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-4 leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Courses() {
  const [courses, setCourses] = useState<{ id: number; code: string; name: string; curriculum: string }[]>([])
  useEffect(() => {
    fetch('/v1/curriculum/courses?limit=50')
      .then((r) => r.json())
      .then((d) => setCourses(d.items))
      .catch(() => {})
  }, [])
  return <Table head={['Code', 'Course', 'Curriculum']} rows={courses.map((c) => [<Code key="c">{c.code}</Code>, c.name, c.curriculum])} />
}

export function Guide() {
  return (
    <div className="grid gap-10 lg:grid-cols-[12rem_1fr]">
      <nav className="hidden lg:block" aria-label="Guide sections">
        <ul className="sticky top-24 space-y-1 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guide</h1>
          <p className="mt-1 text-slate-600">Everything you need to start using the Mathora API.</p>
        </div>

        <Section id="basics" title="Basics">
          <p>
            Every request goes to <Code>{BASE}</Code> followed by the API and endpoint, e.g. <Code>/question/questions</Code>. There is no API key and
            requests can come from any website (CORS is enabled). Request and response bodies are JSON. The{' '}
            <Link to="/reference" className="font-semibold text-blue-900 hover:underline">
              API reference
            </Link>{' '}
            lists every endpoint and lets you try them.
          </p>
          <Example method="GET" path="/curriculum/curriculum" />
        </Section>

        <Section id="limits" title="Rate limits">
          <p>
            Each IP address can make 10 requests a second, with short bursts of up to 20. Requests over the limit get status <Code>429</Code>; wait a
            second and try again.
          </p>
        </Section>

        <Section id="errors" title="Errors">
          <p>
            Errors have a status code and a JSON body with a <Code>detail</Code> message. Validation errors (<Code>422</Code>) have a list of problems
            instead.
          </p>
          <Table
            head={['Status', 'Meaning']}
            rows={[
              [<Code key="s">400</Code>, 'The request could not be used, e.g. the solver could not read an expression'],
              [<Code key="s">404</Code>, 'The question, topic or course does not exist'],
              [<Code key="s">422</Code>, 'A parameter is missing or the wrong type'],
              [<Code key="s">429</Code>, 'Too many requests; see rate limits'],
            ]}
          />
          <CodeBlock label="400 response" code={'{\n  "detail": "Unknown name: foo"\n}'} />
        </Section>

        <Section id="pages" title="Pagination">
          <p>
            List endpoints take <Code>limit</Code> (1 to 200, default 50) and <Code>offset</Code> (default 0), and return the page with the total:
          </p>
          <CodeBlock label="Response" code={'{\n  "items": [ ... ],\n  "total": 17054,\n  "limit": 50,\n  "offset": 0\n}'} />
        </Section>

        <Section id="maths" title="Maths in text">
          <p>
            Question prompts, topic names and outcomes write maths as LaTeX between dollar signs, e.g. <Code>{'Expand $(x + 7)(x - 3)$.'}</Code> An
            escaped <Code>\$</Code> is a real dollar sign, as in <Code>{'Pens cost \\$2.50'}</Code>. Every formula renders with{' '}
            <a href="https://katex.org" className="font-semibold text-blue-900 hover:underline">
              KaTeX
            </a>
            :
          </p>
          <CodeBlock label="JavaScript" code={KATEX} />
        </Section>

        <Section id="courses" title="Courses">
          <p>
            Filter questions with <Code>course</Code> using these codes. Topics in the Australian Curriculum also have codes like <Code>AC9M9A02</Code>,
            which work with <Code>code</Code>; senior topics are found by <Code>topic_id</Code>.
          </p>
          <Courses />
        </Section>

        <Section id="answers" title="Answer formats">
          <p>
            Each question has an <Code>answer_type</Code> that says what the answer service accepts. Answers are typed as plain text, like a student
            would write them.
          </p>
          <Table head={['Answer type', 'Accepts', 'Examples']} rows={ANSWER_TYPES.map(([t, a, e]) => [<Code key="t">{t}</Code>, a, <Code key="e">{e}</Code>])} />
        </Section>

        <Section id="solver" title="Writing expressions">
          <p>
            The solver and algebra answers use <Code>+ - * /</Code>, <Code>^</Code> for powers and brackets. Multiplication can be left out, as in{' '}
            <Code>2x(x + 1)</Code>. Variables are single lowercase letters except <Code>e</Code>, <Code>i</Code> and <Code>o</Code>. The constants are{' '}
            <Code>pi</Code> and <Code>e</Code>, and the functions are <Code>sqrt</Code>, <Code>sin</Code>, <Code>cos</Code>, <Code>tan</Code>,{' '}
            <Code>ln</Code> (also <Code>log</Code>), <Code>exp</Code> and <Code>abs</Code>. Expressions can be up to 200 characters, with exponents up
            to 100.
          </p>
          <Example method="POST" path="/solver/solve" body={{ equation: 'x^2 - 5x + 6 = 0' }} />
        </Section>

        <Section id="quiz" title="Example: a quiz">
          <p>Fetch questions, collect answers and mark them in one request:</p>
          <CodeBlock label="JavaScript" code={QUIZ} />
        </Section>

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-medium">Ready to explore every endpoint?</p>
          <Link to="/reference" className="inline-flex items-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Open the API reference
          </Link>
        </Card>
      </div>
    </div>
  )
}
