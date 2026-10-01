import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, Database, Leaf, LoaderCircle, Pause, Pencil, Play, Plus, RefreshCw, Settings2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { fetchWorkspace, queueSource, setSourceEnabled } from './api'
import { formatInterval, formatTime } from './format'
import { providerLabels, type CollectionSource, type CollectionWorkspace, type SourceStatus } from './types'
import { ProviderIcon } from './components/ProviderIcon'
import { SourceForm } from './components/SourceForm'
import './collection.css'

const statuses: Record<SourceStatus, string> = { never_run: 'Not collected', queued: 'Queued', running: 'Collecting', ok: 'Collected', error: 'Retry scheduled', needs_setup: 'Setup needed', paused: 'Paused' }

export function CollectorsPage({ query, onFeed }: { query: string; onFeed: () => void }) {
  const [workspace, setWorkspace] = useState<CollectionWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<CollectionSource | null | undefined>(undefined)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function refresh() {
      try {
        const data = await fetchWorkspace(controller.signal)
        setWorkspace(data)
        setError(null)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load collectors.')
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 10000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [attempt])

  async function act(source: CollectionSource, action: 'run' | 'toggle') {
    setPending(source.id)
    setError(null)
    try {
      if (action === 'run') await queueSource(source.id)
      else await setSourceEnabled(source.id, !source.enabled)
      setAttempt(value => value + 1)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update this source.') }
    finally { setPending(null) }
  }

  const sources = workspace?.sources.filter(source => `${source.name} ${source.target} ${providerLabels[source.provider]}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? []

  return (
    <div className="collection-page">
      <header className="collection-heading"><div><span className="eyebrow">YOUR LISTENING TOOLKIT</span><h1>Bring your listening to life.</h1><p>Choose where to listen, and how often to check in.</p></div>
        <button className="button primary" onClick={() => setEditing(null)}><Plus size={16} />Add source</button></header>
      {error && <div className="collection-error" role="alert">{error}<button onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
      {!workspace ? !error && <div className="collection-loading" role="status"><LoaderCircle size={23} className="loading-spinner" />Loading your sources…</div> : <>
        <section className={`worker-card ${workspace.worker_running ? 'worker-online' : ''}`} aria-label="Collector worker status">
          <span className="worker-symbol"><Settings2 size={22} /></span><div><h2><span className="status-dot" />{workspace.worker_running ? 'Worker online' : 'Worker offline'}</h2>
            <p>{workspace.worker_running ? 'Your source schedules are being checked by the local worker.' : 'Sources can be configured and runs queued. Start the worker to collect data.'}</p>
            {!workspace.worker_running && <code>uv run --all-extras python -m app.features.collection.worker</code>}
            <small>Last heartbeat: {formatTime(workspace.worker_last_seen)}</small></div>
          <button className="button secondary" onClick={() => setAttempt(value => value + 1)} aria-label="Refresh collectors"><RefreshCw size={15} />Refresh</button>
        </section>
        <div className="collection-summary"><span><Database size={16} /><strong>{workspace.item_count.toLocaleString()}</strong> collected records</span><span><Clock3 size={16} /><strong>{workspace.sources.filter(source => source.enabled).length}</strong> schedules enabled</span>
          <button onClick={onFeed}>Open collected feed <ArrowRight size={14} /></button></div>
        <section className="collector-grid" aria-label="Configured sources">
          {sources.map(source => <article className="collector-card" key={source.id}>
            <div className="collector-card-heading"><ProviderIcon provider={source.provider} /><div><h2>{source.name}</h2><span>{providerLabels[source.provider]}{source.provider === 'x' ? ` · ${source.x_mode}` : ''}</span></div><span className={`collector-status status-${source.status}`}>{statuses[source.status]}</span></div>
            <p className="collector-target">{source.target}</p>
            <div className="collector-facts"><span><Clock3 size={13} />Configured: {formatInterval(source.interval_seconds)}</span><span><Database size={13} />{source.item_count} records</span><span>Up to {source.item_limit} {source.provider === 'youtube' ? 'videos' : 'items'} / run</span></div>
            {source.keywords.length > 0 && <p className="collector-keywords">Matching: {source.keywords.join(', ')}</p>}
            <div className="collector-timing"><span>Last run<strong>{formatTime(source.last_run_at)}</strong></span><span>{source.enabled ? 'Next scheduled check' : 'Schedule'}<strong>{source.enabled ? formatTime(source.next_run_at) : 'Paused'}</strong></span></div>
            {(source.last_error || source.last_note) && <p className={`collector-run-note ${source.last_error ? 'has-error' : ''}`}>{source.last_error ?? source.last_note}</p>}
            <footer className="collector-actions"><button className="button secondary" disabled={pending === source.id || source.status === 'running'} onClick={() => void act(source, 'run')}><Play size={13} />{workspace.worker_running ? 'Collect now' : 'Queue run'}</button>
              <button className="icon-button" aria-label={`Edit ${source.name}`} disabled={source.status === 'running'} onClick={() => setEditing(source)}><Pencil size={15} /></button>
              <button className="icon-button" aria-label={`${source.enabled ? 'Pause' : 'Resume'} ${source.name}`} disabled={pending === source.id || source.status === 'running'} onClick={() => void act(source, 'toggle')}>{source.enabled ? <Pause size={16} /> : <Play size={16} />}</button>
            </footer>
          </article>)}
          {sources.length === 0 && <div className="collection-empty"><Leaf size={30} /><h2>{query ? 'No matching sources.' : 'A little room to grow.'}</h2><p>{query ? 'Try a different source name or platform.' : 'Add a source to start collecting.'}</p></div>}
        </section>
        <section className="connector-guide" aria-labelledby="connector-guide-title"><header><h2 id="connector-guide-title">Four ways to listen. One place to understand.</h2><p>Open-source collectors; no paid service is connected.</p></header>
          <div>{workspace.capabilities.map(capability => <article key={capability.provider}><ProviderIcon provider={capability.provider} /><h3>{providerLabels[capability.provider]}</h3>
            <span className="capability-label">{!capability.installed ? 'Install optional extra' : capability.provider === 'x' && !capability.credentials_configured ? 'Local sign-in needed' : 'Collector available'}</span><p>{capability.note}</p></article>)}</div>
        </section>
        <section className="run-history" aria-labelledby="history-title"><header><div><h2 id="history-title">Recent collection runs</h2><p>Real outcomes, including failures and retries.</p></div><span>{workspace.runs.length} recent</span></header>
          {workspace.runs.length === 0 ? <p className="history-empty">No runs yet. Start the worker or queue a source to get going.</p> : <div className="history-table-wrap"><table><thead><tr><th>Source</th><th>Started</th><th>Outcome</th><th>Records</th></tr></thead><tbody>{workspace.runs.map(run => <tr key={run.id}><td><strong>{run.source_name}</strong>{run.note && <small>{run.note}</small>}</td><td>{formatTime(run.started_at)}</td><td><span className={`collector-status status-${run.status}`}>{statuses[run.status as SourceStatus] ?? run.status}</span></td><td>{run.added} new / {run.fetched} fetched</td></tr>)}</tbody></table></div>}
        </section>
      </>}
      {editing !== undefined && <Modal title={editing ? 'Fine-tune your source.' : 'A new place to listen.'} eyebrow="SOURCE CONFIGURATION" onClose={() => setEditing(undefined)}>
        <SourceForm source={editing} onSaved={() => { setEditing(undefined); setAttempt(value => value + 1) }} />
      </Modal>}
    </div>
  )
}
