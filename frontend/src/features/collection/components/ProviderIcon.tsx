import { AtSign, Rss, Send, Video } from 'lucide-react'
import type { Provider } from '../types'

const icons = { rss: Rss, telegram: Send, youtube: Video, x: AtSign }

export function ProviderIcon({ provider }: { provider: Provider }) {
  const Icon = icons[provider]
  return <span className={`provider-icon provider-${provider}`}><Icon size={21} strokeWidth={1.7} /></span>
}
