import { useEffect, useRef } from 'react'
import { Bell, ChevronRight, CircleHelp, Menu, Search, X } from 'lucide-react'
import type { View } from '../../app/types'

const labels: Record<View, string> = { overview: 'Overview', mentions: 'Mentions', sources: 'Sources', collections: 'Saved mentions', collectors: 'Collectors', collected: 'Collected feed' }

interface TopbarProps {
  view: View
  query: string
  onSearch: (query: string) => void
  onOpenMenu: () => void
  onHelp: () => void
  onActivity: () => void
}

export function Topbar({ view, query, onSearch, onOpenMenu, onHelp, onActivity }: TopbarProps) {
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onOpenMenu} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{labels[view]}</strong></div>
      <div className="topbar-actions">
        <div className="search-field"><Search size={17} /><input ref={search} maxLength={200} aria-label={view === 'collectors' ? 'Search collectors' : 'Search mentions'} placeholder={view === 'collectors' ? 'Search your sources…' : 'Search your mentions…'}
          value={query} onChange={event => onSearch(event.target.value)} />
          {query ? <button className="search-clear" aria-label="Clear search" onClick={() => onSearch('')}><X size={14} /></button> : <kbd>⌘ K</kbd>}
        </div>
        <button className="icon-button help-button" aria-label="Dashboard help" onClick={onHelp}><CircleHelp size={19} /></button>
        <button className="icon-button notification-button" aria-label="View activity" onClick={onActivity}><Bell size={19} /><span /></button>
        <button className="user-avatar" onClick={onHelp} aria-label="Demo workspace profile">JD</button>
      </div>
    </header>
  )
}
