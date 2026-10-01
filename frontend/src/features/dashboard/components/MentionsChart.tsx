import { useId, useState } from 'react'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import type { Period, TrendPoint } from '../types'

type Channel = 'all' | 'news' | 'social'

function value(point: TrendPoint, channel: Channel) {
  return channel === 'all' ? point.news + point.social + point.other : point[channel]
}

export function MentionsChart({ period }: { period: Period }) {
  const [channel, setChannel] = useState<Channel>('all')
  const [hovered, setHovered] = useState<number | null>(null)
  const gradientId = useId().replaceAll(':', '')
  const max = Math.ceil(Math.max(...period.trend.map(point => value(point, channel))) / 100) * 100
  const points = period.trend.map((point, index) => ({ x: 48 + index * 592 / (period.trend.length - 1), y: 190 - value(point, channel) / max * 160 }))
  const line = points.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const middle = (previous.x + point.x) / 2
    return `C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
  }).join(' ')
  const total = period.trend.reduce((sum, point) => sum + value(point, channel), 0)

  return (
    <section className="card trend-card" aria-labelledby="trend-title">
      <header className="card-header"><div><h2 id="trend-title">The conversation, over time</h2><p>A little perspective on your mentions.</p></div>
        <div className="chart-select"><select aria-label="Trend source" value={channel} onChange={event => { setChannel(event.target.value as Channel); setHovered(null) }}>
          <option value="all">All sources</option><option value="news">News</option><option value="social">Social</option>
        </select><ChevronDown size={13} /></div>
      </header>
      <div className="chart-summary"><strong>{total.toLocaleString()}</strong>{channel === 'all' && <span className="positive-change"><ArrowUpRight size={13} />{period.change}</span>}<span>mentions in this period</span></div>
      <div className="chart-area">
        <svg viewBox="0 0 668 230" role="img" aria-label={`${total.toLocaleString()} ${channel === 'all' ? '' : channel + ' '}mentions over ${period.trend.length} time intervals`}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" /></linearGradient></defs>
          {[0, 1, 2, 3].map(index => <g key={index}><line x1="48" y1={30 + index * 160 / 3} x2="640" y2={30 + index * 160 / 3} className="chart-gridline" /><text x="30" y={34 + index * 160 / 3} textAnchor="end" className="chart-label">{Math.round(max * (1 - index / 3))}</text></g>)}
          <path d={`${line} L 640 190 L 48 190 Z`} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
          {points.map((point, index) => <g key={index}>
            <text x={point.x} y="217" textAnchor="middle" className="chart-label">{period.trend[index].label}</text>
            <rect x={point.x - 23} y="15" width="46" height="180" fill="transparent" onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} />
          </g>)}
          {hovered !== null && points[hovered] && <g pointerEvents="none"><line x1={points[hovered].x} y1="24" x2={points[hovered].x} y2="190" className="chart-hover-line" />
            <circle cx={points[hovered].x} cy={points[hovered].y} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" />
            <rect x={Math.min(580, Math.max(50, points[hovered].x - 32))} y={Math.max(5, points[hovered].y - 38)} width="62" height="25" rx="6" fill="var(--accent)" />
            <text x={Math.min(611, Math.max(81, points[hovered].x - 1))} y={Math.max(22, points[hovered].y - 21)} fill="var(--on-accent)" textAnchor="middle" fontSize="11">{value(period.trend[hovered], channel)}</text>
          </g>}
        </svg>
      </div>
      <footer className="chart-footer"><span><span className="legend-dot" /> Mentions</span><span>Sample data, real possibilities.</span></footer>
    </section>
  )
}
