import type { CollectedFeed, CollectedItem, CollectionSource, CollectionWorkspace, SourceConfig } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/collection${path}`, options)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = typeof body?.detail === 'string' ? body.detail : Array.isArray(body?.detail)
      ? body.detail.map((error: { msg?: string }) => error.msg ?? 'Invalid source configuration.').join(' ')
      : 'Could not reach the collection API. Check that the Python server is running.'
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const fetchWorkspace = (signal?: AbortSignal) => request<CollectionWorkspace>('', { signal })
export const fetchItem = (id: string, signal: AbortSignal) => request<CollectedItem>(`/items/${encodeURIComponent(id)}`, { signal })
export const fetchFeed = (parameters: URLSearchParams, signal: AbortSignal) => request<CollectedFeed>(`/items?${parameters}`, { signal })

export function saveSource(config: SourceConfig, id?: string) {
  const body = id ? { name: config.name, interval_seconds: config.interval_seconds, enabled: config.enabled,
    keywords: config.keywords, item_limit: config.item_limit, telegram_access: config.telegram_access,
    comment_limit: config.comment_limit, transcript_languages: config.transcript_languages } : config
  return request<CollectionSource>(id ? `/sources/${encodeURIComponent(id)}` : '/sources', {
    method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

export const setSourceEnabled = (id: string, enabled: boolean) => request<CollectionSource>(`/sources/${encodeURIComponent(id)}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
})
export const queueSource = (id: string) => request<CollectionSource>(`/sources/${encodeURIComponent(id)}/run`, { method: 'POST' })
