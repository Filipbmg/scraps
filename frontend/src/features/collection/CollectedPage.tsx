import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Inbox, LoaderCircle, MapPin, RefreshCw, Settings2 } from 'lucide-react'
import { fetchFeed, fetchWorkspace } from './api'
import { formatTime } from './format'
import { providerLabels, type CollectedFeed, type CollectionWorkspace, type ItemSummary, type Provider } from './types'
import { ProviderIcon } from './components/ProviderIcon'
import { ItemDetail } from './components/ItemDetail'
import './collection.css'

export function CollectedPage({ query, onCollectors }: { query: string; onCollectors: () => void }) {
  const [provider, setProvider] = useState<Provider | ''>('')
  const [source, setSource] = useState('')
  const [denmarkOnly, setDenmarkOnly] = useState(false)
  const [pagination, setPagination] = useState({ key: '', offset: 0 })
  const [result, setResult] = useState<{ key: string; feed: CollectedFeed } | null>(null)
  const [workspace, setWorkspace] = useState<CollectionWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<ItemSummary | null>(null)
  const filterKey = JSON.stringify([query, provider, source, denmarkOnly])
  const offset = pagination.key === filterKey ? pagination.offset : 0
  const parameters = new URLSearchParams({ query, denmark_only: String(denmarkOnly), limit: '25', offset: String(offset) })
  if (provider) parameters.set('provider', provider)
  if (source) parameters.set('source_id', source)
  const requestKey = parameters.toString()
  const feed = result?.key === requestKey ? result.feed : null

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const [nextFeed, nextWorkspace] = await Promise.all([fetchFeed(new URLSearchParams(requestKey), controller.signal), fetchWorkspace(controller.signal)])
        setResult({ key: requestKey, feed: nextFeed })
        setWorkspace(nextWorkspace)
        setError(null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load collected records.')
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 10000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [requestKey, attempt])

  const sourceName = (sourceId: string) => workspace?.sources.find(item => item.id === sourceId)?.name ?? 'Source'

  return <div className="collection-page">
    <header className="collection-heading"><div><span className="eyebrow">ACTUAL SOURCE DATA</span><h1>The world, a little closer.</h1><p>Your collected stories, posts, videos, transcripts, and conversations.</p></div><button className="button primary" onClick={onCollectors}><Settings2 size={16} />Manage collectors</button></header>
    <section className="collected-toolbar" aria-label="Collected feed filters">
      <label>Platform<select aria-label="Filter collected platform" value={provider} onChange={event => setProvider(event.target.value as Provider | '')}><option value="">All platforms</option>{Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Source<select aria-label="Filter collected source" value={source} onChange={event => setSource(event.target.value)}><option value="">All sources</option>{workspace?.sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="checkbox-label denmark-filter"><input type="checkbox" checked={denmarkOnly} onChange={event => setDenmarkOnly(event.target.checked)} /><MapPin size={15} />Denmark connection</label>
      <button className="icon-button" aria-label="Refresh collected feed" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17} /></button>
    </section>
    <p className="collected-context">Denmark connection is an English/Danish keyword hint, including Greenland and the Faroe Islands. No sentiment or reach is inferred.</p>
    {error && <p className="collection-error" role="alert">{error}<button onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}
    {!feed ? !error && <div className="collection-loading" role="status"><LoaderCircle size={23} className="loading-spinner" />Gathering your collected records…</div> :
      <section className="collected-panel" aria-label="Collected records"><header className="collected-panel-heading"><h2>{feed.total.toLocaleString()} record{feed.total !== 1 ? 's' : ''}</h2><span>{workspace?.worker_running ? 'Worker online · refreshes every 10s' : 'Stored collection · worker offline'}</span></header>
        {feed.items.length === 0 ? <div className="collection-empty"><Inbox size={34} strokeWidth={1.3} /><h2>A little quiet here.</h2><p>{query || provider || source || denmarkOnly ? 'Try a different search or filter.' : 'Start the collector worker, then your first records will appear here.'}</p><button className="button secondary" onClick={onCollectors}>Open collectors <ArrowRight size={14} /></button></div> :
          <div className="collected-list">{feed.items.map(item => <article className="collected-record" key={item.id}>
            <ProviderIcon provider={item.provider} /><div className="collected-record-content"><div className="collected-record-meta"><strong>{sourceName(item.source_id)}</strong><span>·</span><span>{item.published_at ? formatTime(item.published_at) : 'Date unavailable'}</span></div>
              <button className="collected-record-title" onClick={() => setSelected(item)}>{item.title}</button><p>{item.excerpt}</p>
              <div className="collected-record-tags"><span>{providerLabels[item.provider]}</span>{item.denmark_related && <span className="denmark-tag"><MapPin size={10} />Denmark link</span>}
                {item.transcript_status && <span className={`transcript-label transcript-${item.transcript_status}`}>Transcript: {item.transcript_status}</span>}{item.provider === 'youtube' && <span>{item.comment_count} captured comments</span>}
                {item.keywords.slice(0, 3).map(keyword => <span key={keyword}>{keyword}</span>)}</div>
            </div><a className="icon-button" href={item.url} target="_blank" rel="noreferrer" aria-label={`Open original: ${item.title}`}><ArrowUpRight size={17} /></a>
          </article>)}</div>}
        {feed.total > 0 && <footer className="collected-pagination"><span>{offset + 1}–{Math.min(offset + feed.items.length, feed.total)} of {feed.total.toLocaleString()}</span><div><button className="button secondary" disabled={offset === 0} onClick={() => setPagination({ key: filterKey, offset: Math.max(0, offset - 25) })}><ArrowLeft size={14} />Newer</button><button className="button secondary" disabled={offset + feed.items.length >= feed.total} onClick={() => setPagination({ key: filterKey, offset: offset + 25 })}>Older<ArrowRight size={14} /></button></div></footer>}
      </section>}
    {selected && <ItemDetail summary={selected} sourceName={sourceName(selected.source_id)} onClose={() => setSelected(null)} />}
  </div>
}
