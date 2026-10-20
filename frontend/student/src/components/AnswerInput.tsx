import { ALGEBRAIC, answerToLatex, HINTS } from '../format'
import type { AnswerType } from '../types'
import { Tex } from './Tex'
import { input } from './ui'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  answerType: AnswerType
  onEnter?: () => void
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
}

export function AnswerInput({ id, value, onChange, answerType, onEnter, disabled, readOnly, autoFocus }: Props) {
  const showPreview = value.trim() !== '' && (ALGEBRAIC.includes(answerType) || /[\^*]|sqrt|pi/.test(value))
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Your answer
      </label>
      <input
        id={id}
        className={`${input} font-mono read-only:bg-slate-50`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder="Your answer"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={200}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
      />
      <div className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-slate-500">{HINTS[answerType]}</span>
        {showPreview && (
          <span className="text-slate-700">
            <span className="mr-1 text-slate-400">Preview</span>
            <Tex text={`$${answerToLatex(value)}$`} />
          </span>
        )}
      </div>
    </div>
  )
}
