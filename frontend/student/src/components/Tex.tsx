import katex from 'katex'
import { useMemo } from 'react'

// Splits text on $...$; \$ is a literal dollar sign
function split(text: string) {
  const parts: { math: boolean; text: string }[] = []
  let buffer = ''
  let math = false
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && text[i + 1] === '$') {
      buffer += math ? '\\$' : '$'
      i++
    } else if (text[i] === '$') {
      parts.push({ math, text: buffer })
      buffer = ''
      math = !math
    } else {
      buffer += text[i]
    }
  }
  parts.push({ math, text: buffer })
  return parts
}

export function Tex({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(
    () =>
      split(text).map((p) => (p.math ? { html: katex.renderToString(p.text, { throwOnError: false }) } : { text: p.text })),
    [text],
  )
  return (
    <span className={className}>
      {parts.map((p, i) => (p.html ? <span key={i} dangerouslySetInnerHTML={{ __html: p.html }} /> : p.text))}
    </span>
  )
}
