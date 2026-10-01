import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Bookmark, CalendarDays, ChevronDown, Leaf, Plus, Sparkles } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { relativeTime } from '../../lib/format'
import { exportMentions } from './export'
import type { DashboardData, Mention, PeriodKey, Sentiment, View } from './types'
import { StatsGrid } from './components/StatsGrid'
import { MentionsChart } from './components/MentionsChart'
import { SentimentCard } from './components/SentimentCard'
import { MentionFeed } from './components/MentionFeed'
import { SourcesCard } from './components/SourcesCard'
import { SourceMark } from './components/SourceMark'
import './dashboard.css'

interface DashboardProps {
  data: DashboardData
  view: View
  query: string
  onNavigate: (view: View) => void
  onTools: () => void
  onSavedCountChange: (count: number) => void
}

const headings: Record<View, { title: string; subtitle: string }> = {
  overview: { title: 'A clearer view of your world.', subtitle: 'Your media landscape, at a glance. Let’s see what’s growing.' },
  mentions: { title: 'Every conversation starts somewhere.', subtitle: 'Find the stories and signals that deserve a closer look.' },
  sources: { title: 'A world of perspectives.', subtitle: 'Bring the places you listen together in one calm space.' },
  collections: { title: 'Some things are worth keeping.', subtitle: 'Your personal collection of stories, signals, and inspiration.' },
}

function initialBookmarks(data: DashboardData) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('snowdrop-saved-mentions') ?? 'null')
    if (Array.isArray(stored) && stored.every(id => typeof id === 'string')) {
      return new Set<string>(stored.filter(id => data.mentions.some(mention => mention.id === id)))
    }
  } catch { /* Fall back to the sample collection when storage is unavailable. */ }
  return new Set(data.mentions.filter(mention => mention.saved).map(mention => mention.id))
}

export function Dashboard({ data, view, query, onNavigate, onTools, onSavedCountChange }: DashboardProps) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('7d')
  const [sentiment, setSentiment] = useState<Sentiment | 'all'>('all')
  const [saved, setSaved] = useState(() => initialBookmarks(data))
  const [onlySaved, setOnlySaved] = useState(false)
  const [selected, setSelected] = useState<Mention | null>(null)
  const period = data.periods[periodKey]
  const collections = view === 'collections'
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = data.mentions.filter(mention => {
    const source = data.sources.find(item => item.id === mention.source_id)!
    const searchable = [mention.title, mention.excerpt, source.name, ...mention.keywords].join(' ').toLocaleLowerCase()
    const inPeriod = Date.parse(mention.published_at) >= Date.parse(data.updated_at) - (periodKey === '7d' ? 7 : 30) * 86400000
    return inPeriod && searchable.includes(normalizedQuery) && (sentiment === 'all' || mention.sentiment === sentiment)
      && (!(collections || onlySaved) || saved.has(mention.id))
  })
  const selectedSource = selected ? data.sources.find(source => source.id === selected.source_id)! : null

  useEffect(() => {
    try { localStorage.setItem('snowdrop-saved-mentions', JSON.stringify([...saved])) } catch { /* Bookmarks still work for this session. */ }
    onSavedCountChange(saved.size)
  }, [saved, onSavedCountChange])

  function toggleSaved(id: string) {
    setSaved(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="dashboard">
      <section className="page-heading">
        <div><div className="page-eyebrow"><span className="greeting">YOUR LISTENING SPACE</span><span className="demo-badge"><span />Demo data</span></div>
          <h1>{headings[view].title}</h1><p>{headings[view].subtitle}</p></div>
        <button className="button primary" onClick={onTools}><Plus size={16} />New monitor</button>
      </section>
      <div className="dashboard-toolbar"><div className="snapshot-label"><span className="status-dot" /><span>Sample snapshot</span><span className="snapshot-divider">·</span><span>Oct 1, 2026</span></div>
        <div className="dashboard-controls"><label className="period-select"><CalendarDays size={15} /><select aria-label="Date range" value={periodKey} onChange={event => setPeriodKey(event.target.value as PeriodKey)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><ChevronDown size={13} /></label>
          <button className="button secondary export-button" disabled={filtered.length === 0 || view === 'sources'} onClick={() => exportMentions(filtered, data.sources)}><ArrowDownToLine size={15} /><span>Export</span></button></div>
      </div>
      {view === 'overview' && <>
        <StatsGrid metrics={period.metrics} />
        <div className="insights-grid"><MentionsChart period={period} /><SentimentCard sentiment={period.sentiment} change={period.metrics.find(metric => metric.icon === 'sentiment')!.change} /></div>
      </>}
      {view === 'sources' ? <SourcesCard sources={data.sources} expanded onViewAll={() => onNavigate('sources')} onTools={onTools} /> :
        <div className={view === 'overview' ? 'feed-grid' : 'full-feed'}>
          <MentionFeed mentions={filtered} sources={data.sources} reference={data.updated_at} saved={saved} sentiment={sentiment} onSentiment={setSentiment}
            onSave={toggleSaved} onOpen={setSelected} onViewAll={() => onNavigate('mentions')} expanded={view !== 'overview' || Boolean(query)} collections={collections} onlySaved={onlySaved} onOnlySaved={setOnlySaved} />
          {view === 'overview' && <div className="right-column"><SourcesCard sources={data.sources} onViewAll={() => onNavigate('sources')} onTools={onTools} />
            <div className="growing-card"><span className="growing-icon"><Sparkles size={20} strokeWidth={1.5} /></span><div><h3>Your next insight is taking root.</h3><p>Bring real sources into your collected feed.</p><button onClick={onTools}>Open your listening toolkit <ArrowUpRight size={14} /></button></div><Leaf className="growing-decoration" size={72} strokeWidth={0.8} /></div>
          </div>}
        </div>}
      <footer className="dashboard-footer"><span><Leaf size={13} /> A little clarity in a world of conversation.</span><span>Made for a more thoughtful view.</span></footer>
      {selected && selectedSource && <Modal title="A closer look." eyebrow="MENTION PREVIEW · SAMPLE CONTENT" onClose={() => setSelected(null)}>
        <div className="detail-meta"><SourceMark source={selectedSource} /><div><strong>{selectedSource.name}</strong><span>{selectedSource.kind} · {relativeTime(selected.published_at, data.updated_at)}</span></div><span className={`sentiment-tag ${selected.sentiment}`}><span />{selected.sentiment}</span></div>
        <h3 className="detail-title">{selected.title}</h3><p className="detail-excerpt">{selected.excerpt}</p>
        <div className="detail-keywords">{selected.keywords.map(keyword => <span className="keyword-tag" key={keyword}>{keyword}</span>)}</div>
        <div className="detail-actions"><button className="button secondary" onClick={() => toggleSaved(selected.id)}><Bookmark size={16} fill={saved.has(selected.id) ? 'currentColor' : 'none'} />{saved.has(selected.id) ? 'Saved to your collection' : 'Save mention'}</button>
          <a className="button primary" href={selectedSource.url} target="_blank" rel="noreferrer">Visit publisher <ArrowUpRight size={16} /></a></div>
        <div className="modal-note"><Leaf size={18} /> This is a fictional headline. The publisher link opens its homepage.</div>
      </Modal>}
    </div>
  )
}
