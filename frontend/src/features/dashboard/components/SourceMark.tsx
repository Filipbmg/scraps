import type { Source } from '../types'

export function SourceMark({ source }: { source: Source }) {
  return <span className={`source-mark source-${source.color}`} aria-hidden="true">{source.mark}</span>
}
