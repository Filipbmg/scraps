import { useEffect, useState } from 'react'
import { ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { fetchItem } from '../api'
import { formatTime } from '../format'
import { providerLabels, type CollectedItem, type ItemSummary } from '../types'

export function ItemDetail({ summary, sourceName, onClose }: { summary: ItemSummary; sourceName: string; onClose: () => void }) {
  const [item, setItem] = useState<CollectedItem | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchItem(summary.id, controller.signal).then(setItem).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load this record.')
    })
    return () => controller.abort()
  }, [summary.id])

  return <Modal title="A closer look." eyebrow={`COLLECTED RECORD · ${providerLabels[summary.provider].toUpperCase()}`} onClose={onClose}>
    <div className="record-provenance"><strong>{sourceName}</strong><span>{summary.author && `${summary.author} · `}{summary.published_at ? formatTime(summary.published_at) : 'Publication date unavailable'}</span></div>
    <h3 className="record-detail-title">{summary.title}</h3>
    {error ? <p className="collection-error" role="alert">{error}</p> : !item ? <div className="collection-loading" role="status"><LoaderCircle className="loading-spinner" size={21} />Loading source content…</div> : <>
      <p className="record-text">{item.text || 'This source did not provide additional text.'}</p>
      {item.transcript && <details className="record-section"><summary>Transcript <span className={`transcript-label transcript-${item.transcript.status}`}>{item.transcript.status}</span></summary>
        {item.transcript.status === 'available' ? <><p className="record-section-meta">{item.transcript.language} · {item.transcript.generated ? 'Auto-generated captions' : 'Publisher captions'}</p><div className="record-transcript" role="region" aria-label="Transcript text" tabIndex={0}>{item.transcript.text}</div></> : <p>{item.transcript.note}</p>}
      </details>}
      {item.provider === 'youtube' && <details className="record-section"><summary>Captured comments <span>{item.comments.length}</span></summary><p className="record-section-meta">{String(item.metadata.comments_scope ?? 'Bounded comment collection; not all comments.')}</p>
        {item.comments.length === 0 ? <p>No comments were returned. They may be empty, disabled, not requested, or unavailable to the collector.</p> : <div className="record-comments">{item.comments.map(comment => <article key={comment.id}><strong>{comment.author ?? 'Unknown author'}</strong><p>{comment.text}</p>{comment.likes !== null && <small>{comment.likes} likes</small>}</article>)}</div>}
      </details>}
      <div className="record-detail-footer"><span>First collected {formatTime(item.collected_at)}</span><a className="button primary" href={item.url} target="_blank" rel="noreferrer">Open original <ArrowUpRight size={15} /></a></div>
    </>}
  </Modal>
}
