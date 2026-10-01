import { ArrowUpRight, Leaf, Smile } from 'lucide-react'
import type { Sentiment } from '../types'

export function SentimentCard({ sentiment, change }: { sentiment: Record<Sentiment, number>; change: string }) {
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const labels = ['positive', 'neutral', 'negative'] as const
  let offset = 0

  return (
    <section className="card sentiment-card" aria-labelledby="sentiment-title">
      <header className="card-header"><div><h2 id="sentiment-title">The overall feeling</h2><p>What’s behind the conversation.</p></div><Smile size={19} strokeWidth={1.6} /></header>
      <div className="donut-container">
        <svg viewBox="0 0 180 180" role="img" aria-label={`${sentiment.positive}% positive, ${sentiment.neutral}% neutral, ${sentiment.negative}% negative sentiment`}>
          {labels.map(label => {
            const currentOffset = offset
            offset += sentiment[label] / 100 * circumference
            return <circle key={label} className={`donut-segment ${label}`} cx="90" cy="90" r={radius} fill="none" strokeWidth="15"
              strokeDasharray={`${sentiment[label] / 100 * circumference - 5} ${circumference}`} strokeDashoffset={-currentOffset} transform="rotate(-90 90 90)" strokeLinecap="round" />
          })}
        </svg>
        <div className="donut-center"><strong>{sentiment.positive}<span>%</span></strong><span>positive</span><small><ArrowUpRight size={12} />{change}</small></div>
      </div>
      <div className="sentiment-legend">{labels.map(label => <div key={label}><span><span className={`legend-dot ${label}`} />{label}</span><strong>{sentiment[label]}%</strong></div>)}</div>
      <div className="sentiment-note"><Leaf size={16} strokeWidth={1.5} /><span>A little more good in the conversation.</span></div>
    </section>
  )
}
