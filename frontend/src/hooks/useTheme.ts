import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('snowdrop-theme', theme) } catch { /* Session-only if storage is unavailable. */ }
  }, [theme])

  return { theme, toggleTheme: () => setTheme(current => current === 'light' ? 'dark' : 'light') }
}
