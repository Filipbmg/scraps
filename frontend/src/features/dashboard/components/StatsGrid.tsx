import { ArrowUpRight, Globe2, MessageSquareText, Radio, Smile } from 'lucide-react'
import type { Metric } from '../types'

const icons = { mentions: MessageSquareText, sources: Globe2, sentiment: Smile, reach: Radio }

export function StatsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="stats-grid" aria-label="Monitoring summary">
      {metrics.map(metric => {
        const Icon = icons[metric.icon]
        const points = metric.sparkline.map((value, index) => `${index * 10},${45 - value / 2}`).join(' ')
        return <article className="stat-card" key={metric.icon}>
          <div className="stat-label"><span>{metric.label}</span><Icon size={18} strokeWidth={1.7} /></div>
          <div className="stat-main"><strong>{metric.value}</strong><svg viewBox="0 0 70 48" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div className="stat-change"><span><ArrowUpRight size={13} />{metric.change}</span><small>{metric.detail}</small></div>
        </article>
      })}
    </section>
  )
}
