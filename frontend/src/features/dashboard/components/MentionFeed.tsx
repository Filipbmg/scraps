import { ArrowRight, Bookmark, ChevronDown, Inbox, SlidersHorizontal } from 'lucide-react'
import { relativeTime } from '../../../lib/format'
import type { Mention, Sentiment, Source } from '../types'
import { SourceMark } from './SourceMark'

interface MentionFeedProps {
  mentions: Mention[]
  sources: Source[]
  reference: string
  saved: Set<string>
  sentiment: Sentiment | 'all'
  onSentiment: (sentiment: Sentiment | 'all') => void
  onSave: (id: string) => void
  onOpen: (mention: Mention) => void
  onViewAll: () => void
  expanded: boolean
  collections: boolean
  onlySaved: boolean
  onOnlySaved: (value: boolean) => void
}

export function MentionFeed({ mentions, sources, reference, saved, sentiment, onSentiment, onSave, onOpen, onViewAll, expanded, collections, onlySaved, onOnlySaved }: MentionFeedProps) {
  const visible = expanded ? mentions : mentions.slice(0, 4)

  return (
    <section className="card mentions-card" aria-labelledby="mentions-title">
      <header className="card-header"><div><h2 id="mentions-title">{collections ? 'Your saved mentions' : 'Fresh from the conversation'}</h2><p>{collections ? 'A little collection of things worth keeping.' : 'The latest stories, signals, and perspectives.'}</p></div>
        <span className="count-badge">{mentions.length} sample{mentions.length !== 1 ? 's' : ''}</span>
      </header>
      <div className="feed-toolbar">
        {!collections && <div className="feed-tabs" aria-label="Mention collection"><button className={!onlySaved ? 'selected' : ''} aria-pressed={!onlySaved} onClick={() => onOnlySaved(false)}>All mentions</button>
          <button className={onlySaved ? 'selected' : ''} aria-pressed={onlySaved} onClick={() => onOnlySaved(true)}>Saved <span>{saved.size}</span></button></div>}
        <label className="filter-select"><SlidersHorizontal size={13} /><select aria-label="Filter by sentiment" value={sentiment} onChange={event => onSentiment(event.target.value as Sentiment | 'all')}>
          <option value="all">All sentiments</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option>
        </select><ChevronDown size={12} /></label>
      </div>
      <div className="mention-list">
        {visible.map(mention => {
          const source = sources.find(item => item.id === mention.source_id)!
          const isSaved = saved.has(mention.id)
          return <article className="mention" key={mention.id}>
            <SourceMark source={source} />
            <div className="mention-content">
              <div className="mention-meta"><strong>{source.name}</strong><span className="meta-dot">·</span><span>{source.kind}</span><span className="meta-dot">·</span><time dateTime={mention.published_at}>{relativeTime(mention.published_at, reference)}</time></div>
              <button className="mention-title" onClick={() => onOpen(mention)}>{mention.title}</button>
              <p className="mention-excerpt">{mention.excerpt}</p>
              <div className="mention-tags"><span className={`sentiment-tag ${mention.sentiment}`}><span />{mention.sentiment}</span>{mention.keywords.map(keyword => <span className="keyword-tag" key={keyword}>{keyword}</span>)}</div>
            </div>
            <button className={`save-button ${isSaved ? 'is-saved' : ''}`} aria-label={`${isSaved ? 'Unsave' : 'Save'} mention: ${mention.title}`} aria-pressed={isSaved} onClick={() => onSave(mention.id)}>
              <Bookmark size={18} strokeWidth={1.6} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </article>
        })}
        {visible.length === 0 && <div className="empty-state"><Inbox size={30} strokeWidth={1.3} /><h3>A little quiet here.</h3><p>{collections || onlySaved ? 'Save a mention, or adjust your filters to find it here.' : 'Try a different search or sentiment filter.'}</p></div>}
      </div>
      <footer className="feed-footer"><span>Illustrative headlines · not live content</span>{!expanded && <button onClick={onViewAll}>View all mentions <ArrowRight size={14} /></button>}</footer>
    </section>
  )
}
