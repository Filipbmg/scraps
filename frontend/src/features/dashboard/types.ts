export type { DashboardView as View } from '../../app/types'
export type PeriodKey = '7d' | '30d'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type SourceKind = 'News' | 'Social' | 'Blogs' | 'Forums'

export interface Metric {
  label: string
  value: string
  change: string
  detail: string
  icon: 'mentions' | 'sources' | 'sentiment' | 'reach'
  sparkline: number[]
}

export interface TrendPoint {
  label: string
  news: number
  social: number
  other: number
}

export interface Period {
  metrics: Metric[]
  trend: TrendPoint[]
  sentiment: Record<Sentiment, number>
  mentions: number
  change: string
}

export interface Source {
  id: string
  name: string
  kind: SourceKind
  mark: string
  color: string
  mentions: number
  url: string
}

export interface Mention {
  id: string
  source_id: string
  title: string
  excerpt: string
  published_at: string
  sentiment: Sentiment
  keywords: string[]
  saved: boolean
}

export interface Activity {
  id: string
  title: string
  description: string
  time: string
}

export interface DashboardData {
  mode: 'demo'
  updated_at: string
  periods: Record<PeriodKey, Period>
  sources: Source[]
  mentions: Mention[]
  activity: Activity[]
}
