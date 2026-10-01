import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, Download, Leaf, LoaderCircle, Search } from 'lucide-react'
import { Sidebar } from '../components/layout/Sidebar'
import { Topbar } from '../components/layout/Topbar'
import { Modal } from '../components/ui/Modal'
import { Dashboard } from '../features/dashboard/Dashboard'
import { fetchDashboard } from '../features/dashboard/api'
import type { DashboardData } from '../features/dashboard/types'
import type { View } from './types'
import { CollectorsPage } from '../features/collection/CollectorsPage'
import { CollectedPage } from '../features/collection/CollectedPage'
import { useTheme } from '../hooks/useTheme'

type Dialog = 'help' | 'activity' | null

export function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<View>('overview')
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchDashboard(controller.signal).then(snapshot => {
      setData(snapshot)
      setSavedCount(snapshot.mentions.filter(mention => mention.saved).length)
      setError(false)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [attempt])

  function navigate(next: View) {
    setView(next)
    setQuery('')
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to dashboard</a>
      <Sidebar view={view} onNavigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)}
        theme={theme} onToggleTheme={toggleTheme} onTools={() => navigate('collectors')} onHelp={() => setDialog('help')} savedCount={savedCount} />
      <div className="workspace-main" inert={menuOpen ? true : undefined}>
        <Topbar view={view} query={query} onSearch={value => { setQuery(value); if (view === 'sources') setView('mentions') }}
          onOpenMenu={() => setMenuOpen(true)} onHelp={() => setDialog('help')} onActivity={() => setDialog('activity')} />
        <main id="main-content" tabIndex={-1}>
          {view === 'collectors' ? <CollectorsPage query={query} onFeed={() => navigate('collected')} /> :
            view === 'collected' ? <CollectedPage query={query} onCollectors={() => navigate('collectors')} /> :
            data ? <Dashboard data={data} view={view} query={query} onNavigate={navigate} onTools={() => navigate('collectors')} onSavedCountChange={setSavedCount} /> :
            <div className="connection-state" role={error ? 'alert' : 'status'}>
              {error ? <><Leaf size={36} /><h1>Let’s get your workspace connected.</h1><p>Start the Python API on port 8000, then try again.</p>
                <button className="button primary" onClick={() => { setError(false); setAttempt(value => value + 1) }}>Try again <ArrowUpRight size={16} /></button></> :
                <><LoaderCircle className="loading-spinner" size={28} /><p>Making a little space for clarity…</p></>}
            </div>}
        </main>
      </div>
      {dialog === 'help' && <Modal title="A little clarity starts here." eyebrow="WELCOME TO SNOWDROP" onClose={() => setDialog(null)}>
        <p className="modal-intro">A calm home for a noisy world. Overview shows sample analytics; Collectors and Collected feed work with real, locally stored source data.</p>
        <div className="help-steps">
          <div><Search size={22} /><section><h3>Find what matters</h3><p>Search with Ctrl/⌘ + K. The collected feed searches source text, transcripts, and captured comments. Use its Denmark connection filter for an English/Danish keyword hint.</p></section></div>
          <div><BookOpen size={22} /><section><h3>Keep the good stuff</h3><p>Open a collected record to see its source text, caption status, and comments. Demo mentions can be bookmarked locally in this browser.</p></section></div>
          <div><Download size={22} /><section><h3>Take a little insight with you</h3><p>Export your current filtered mentions as a CSV. Switch the date range to explore a different sample snapshot.</p></section></div>
        </div>
        <div className="modal-note"><Leaf size={18} /> Demo analytics stay labeled. Collector results show actual source data and run outcomes.</div>
      </Modal>}
      {dialog === 'activity' && <Modal title="A few things worth noticing." eyebrow="WORKSPACE ACTIVITY · DEMO" onClose={() => setDialog(null)}>
        <div className="activity-list">{data?.activity.map(activity => <article key={activity.id}>
          <span className="activity-icon"><Leaf size={19} /></span><div><h3>{activity.title}</h3><p>{activity.description}</p><small>{activity.time}</small></div>
        </article>) ?? <p>Connect the API to see sample activity.</p>}</div>
      </Modal>}
    </div>
  )
}
