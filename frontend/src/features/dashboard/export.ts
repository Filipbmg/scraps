import type { Mention, Source } from './types'

export function exportMentions(mentions: Mention[], sources: Source[]) {
  const rows = [
    ['Title', 'Source', 'Published at', 'Sentiment', 'Keywords', 'Excerpt', 'Data mode'],
    ...mentions.map(mention => [mention.title, sources.find(source => source.id === mention.source_id)?.name ?? '',
      mention.published_at, mention.sentiment, mention.keywords.join('; '), mention.excerpt, 'Demo']),
  ]
  // Prefix formula-like values so future scraped text stays text in spreadsheets.
  const csv = rows.map(row => row.map(cell => `"${(/^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'snowdrop-mentions-demo.csv'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
