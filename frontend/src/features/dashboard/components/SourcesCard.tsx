import { ArrowRight, ArrowUpRight, Globe2, Plus } from 'lucide-react'
import type { Source } from '../types'
import { SourceMark } from './SourceMark'

interface SourcesCardProps {
  sources: Source[]
  expanded?: boolean
  onViewAll: () => void
  onTools: () => void
}

export function SourcesCard({ sources, expanded = false, onViewAll, onTools }: SourcesCardProps) {
  const visible = expanded ? sources : sources.slice(0, 5)
  const max = Math.max(...sources.map(source => source.mentions))

  return (
    <section className={`card sources-card ${expanded ? 'expanded' : ''}`} aria-labelledby="sources-title">
      <header className="card-header"><div><h2 id="sources-title">{expanded ? 'Your source landscape' : 'Where the conversation lives'}</h2><p>{expanded ? 'A preview of your future connected sources.' : 'Your most active sources this week.'}</p></div><Globe2 size={18} strokeWidth={1.6} /></header>
      <div className="source-table-heading"><span>Source</span><span>Mentions</span></div>
      <div className="source-list">{visible.map(source => <div className="source-row" key={source.id}>
        <SourceMark source={source} /><div className="source-info"><a href={source.url} target="_blank" rel="noreferrer">{source.name}{expanded && <ArrowUpRight size={13} />}</a><span>{source.kind}</span></div>
        <div className="source-volume"><strong>{source.mentions}</strong><span className="source-bar"><span style={{ width: `${source.mentions / max * 100}%` }} /></span></div>
        {expanded && <span className="source-demo-badge">Demo source</span>}
      </div>)}</div>
      <footer className="source-footer"><button onClick={expanded ? onTools : onViewAll}>{expanded ? 'Manage source connections' : 'Explore all sources'}{expanded ? <Plus size={14} /> : <ArrowRight size={14} />}</button></footer>
    </section>
  )
}
