import type { AnswerType } from './types'

export const DIFFICULTY: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

export const HINTS: Record<AnswerType, string> = {
  integer: 'A whole number, e.g. 42',
  decimal: 'An exact decimal, e.g. 3.75',
  fraction: 'A fraction or mixed number, e.g. 3/4 or 1 1/2',
  set: 'Every answer, separated by commas, e.g. 2, -3',
  expression: 'An expression, e.g. 3x^2 + 2x (+ c is optional)',
  expanded: 'Fully expanded, e.g. x^2 + 5x + 6',
  factored: 'Fully factorised, e.g. (x + 2)(x + 3)',
  simplified: 'Fully simplified, e.g. 5x + 2',
}

export const ALGEBRAIC: AnswerType[] = ['expression', 'expanded', 'factored', 'simplified']

// Turns a typed answer like "x^(n+1)/2 + sqrt(3)" into LaTeX for the preview
export function answerToLatex(text: string) {
  return text
    .replace(/sqrt\(([^()]*)\)/g, '\\sqrt{$1}')
    .replace(/\^\(([^()]*)\)/g, '^{$1}')
    .replace(/\^(-?\d+(?:\.\d+)?|[a-zA-Z])/g, '^{$1}')
    .replace(/\*/g, ' \\times ')
    .replace(/\bpi\b/g, '\\pi ')
    .replace(/\b(sin|cos|tan|ln|log)\b/g, '\\$1 ')
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function percent(value: number | null | undefined) {
  return value === null || value === undefined ? '–' : `${Math.round(value)}%`
}

export function scoreColour(value: number | null | undefined) {
  if (value === null || value === undefined) return 'bg-slate-100 text-slate-600'
  if (value >= 80) return 'bg-emerald-100 text-emerald-800'
  if (value >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}
