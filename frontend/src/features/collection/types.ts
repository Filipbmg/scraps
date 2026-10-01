export type Provider = 'rss' | 'telegram' | 'youtube' | 'x'
export type SourceStatus = 'never_run' | 'queued' | 'running' | 'ok' | 'error' | 'needs_setup' | 'paused'

export const providerLabels: Record<Provider, string> = { rss: 'News / RSS', telegram: 'Telegram', youtube: 'YouTube', x: 'X' }

export interface SourceConfig {
  provider: Provider
  name: string
  target: string
  interval_seconds: number
  enabled: boolean
  keywords: string[]
  item_limit: number
  telegram_access: 'public' | 'account'
  x_mode: 'profile' | 'search'
  comment_limit: number
  transcript_languages: string[]
}

export interface CollectionSource extends SourceConfig {
  id: string
  status: SourceStatus
  item_count: number
  last_run_at: string | null
  next_run_at: string
  last_error: string | null
  last_note: string | null
  failures: number
}

export interface CollectionRun {
  id: number
  source_id: string
  source_name: string
  started_at: string
  finished_at: string | null
  status: string
  fetched: number
  added: number
  note: string | null
}

export interface Capability {
  provider: Provider
  installed: boolean
  credentials_configured: boolean
  note: string
}

export interface CollectionWorkspace {
  sources: CollectionSource[]
  runs: CollectionRun[]
  capabilities: Capability[]
  worker_running: boolean
  worker_last_seen: string | null
  item_count: number
}

export interface ItemSummary {
  id: string
  source_id: string
  provider: Provider
  url: string
  title: string
  excerpt: string
  published_at: string | null
  collected_at: string
  author: string | null
  keywords: string[]
  denmark_related: boolean
  transcript_status: 'available' | 'unavailable' | 'blocked' | 'error' | null
  comment_count: number
}

export interface CollectedItem extends Omit<ItemSummary, 'excerpt' | 'transcript_status' | 'comment_count'> {
  external_id: string
  text: string
  transcript: {
    status: 'available' | 'unavailable' | 'blocked' | 'error'
    language: string | null
    generated: boolean | null
    text: string
    note: string | null
  } | null
  comments: { id: string; text: string; author: string | null; likes: number | null; published_at: string | null }[]
  metadata: Record<string, unknown>
}

export interface CollectedFeed {
  items: ItemSummary[]
  total: number
  limit: number
  offset: number
}
