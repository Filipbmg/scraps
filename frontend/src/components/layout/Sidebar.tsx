import { useEffect, useRef, type KeyboardEvent } from 'react'
import { AtSign, Bookmark, ChevronDown, Compass, Globe2, LayoutDashboard, Leaf, MessageSquareText, Moon, Rss, Send, Settings2, Sun, Video, X } from 'lucide-react'
import { SnowdropMark } from '../brand/SnowdropMark'
import type { View } from '../../app/types'

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
  open: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onTools: () => void
  onHelp: () => void
  savedCount: number
}

const navigation = [
  { view: 'overview', label: 'Overview', icon: LayoutDashboard },
  { view: 'collected', label: 'Collected feed', icon: Rss },
  { view: 'collectors', label: 'Collectors', icon: Settings2 },
  { view: 'mentions', label: 'Mentions', icon: MessageSquareText },
  { view: 'sources', label: 'Sources', icon: Globe2 },
  { view: 'collections', label: 'Saved mentions', icon: Bookmark },
] as const

export function Sidebar({ view, onNavigate, open, onClose, theme, onToggleTheme, onTools, onHelp, savedCount }: SidebarProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLButtonElement>('.mobile-close')?.focus()
    return () => previous?.focus()
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open) return
    if (event.key === 'Escape') onClose()
    if (event.key !== 'Tab') return
    const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
    const next = event.shiftKey ? buttons.at(-1) : buttons[0]
    const boundary = event.shiftKey ? buttons[0] : buttons.at(-1)
    if (document.activeElement === boundary) { event.preventDefault(); next?.focus() }
  }

  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Dismiss navigation" onClick={onClose} />}
      <aside ref={ref} className={`sidebar ${open ? 'is-open' : ''}`} onKeyDown={onKeyDown}
        role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Workspace navigation">
        <div className="brand-row">
          <button className="brand" onClick={() => onNavigate('overview')} aria-label="Snowdrop home">
            <SnowdropMark className="brand-mark" /><span>snowdrop<span className="brand-dot">.</span></span>
          </button>
          <button className="icon-button mobile-close" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <button className="workspace-picker" onClick={onHelp}>
          <span className="workspace-avatar">S</span>
          <span><strong>My workspace</strong><small>Personal workspace</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="main-navigation" aria-label="Main navigation">
          {navigation.map(item => (
            <button key={item.view} className={`nav-item ${view === item.view ? 'active' : ''}`}
              aria-current={view === item.view ? 'page' : undefined} onClick={() => onNavigate(item.view)}>
              <item.icon size={19} strokeWidth={1.8} /><span>{item.label}</span>
              {item.view === 'collections' && savedCount > 0 && <span className="nav-count">{savedCount}</span>}
              {item.view === 'overview' && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="nav-section-label tools-label">LISTENING TOOLS <span>LOCAL</span></div>
        <nav className="tool-navigation" aria-label="Collection tools">
          <button className="nav-item" onClick={onTools}><Rss size={19} strokeWidth={1.8} /><span>News feeds</span></button>
          <button className="nav-item" onClick={onTools}><Send size={19} strokeWidth={1.8} /><span>Telegram channels</span></button>
          <button className="nav-item" onClick={onTools}><Video size={19} strokeWidth={1.8} /><span>YouTube videos</span></button>
          <button className="nav-item" onClick={onTools}><AtSign size={19} strokeWidth={1.8} /><span>X profiles & keywords</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="guidance-card">
            <Leaf size={22} strokeWidth={1.5} /><strong>A little clarity, every day.</strong>
            <p>Make space for the conversations that matter.</p>
            <button onClick={onHelp}>Find your way around <Compass size={14} /></button>
          </div>
          <button className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            <span className={`toggle-track ${theme === 'dark' ? 'on' : ''}`}><span /></span>
          </button>
          <div className="sidebar-footer"><span className="status-dot" /> {view === 'collectors' || view === 'collected' ? 'Local collection workspace' : 'Demo dashboard'} <span>v0.2</span></div>
        </div>
      </aside>
    </>
  )
}
