export const BASE = `${window.location.origin}/v1`

export type Service = { id: string; name: string; summary: string; example: string }

export const SERVICES: Service[] = [
  {
    id: 'question',
    name: 'Question API',
    summary: 'Maths questions from Foundation to senior, each linked to a curriculum topic. Answers are never included.',
    example: 'GET /question/questions/random',
  },
  {
    id: 'answer',
    name: 'Answer API',
    summary: 'Marks answers to questions, accepting fractions, mixed numbers, decimals and any equivalent algebra.',
    example: 'POST /answer/check',
  },
  {
    id: 'solver',
    name: 'Solver API',
    summary: 'Evaluates, simplifies, expands, factorises, solves, differentiates and integrates expressions.',
    example: 'POST /solver/solve',
  },
  {
    id: 'curriculum',
    name: 'Curriculum API',
    summary: 'The Australian Curriculum: Mathematics v9.0 and the QCAA senior syllabuses, with topic search.',
    example: 'GET /curriculum/topics?q=quadratic',
  },
]
