export function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet'
}

export function formatInterval(seconds: number) {
  if (seconds < 3600) return `Every ${seconds / 60} min`
  if (seconds < 86400) return `Every ${seconds / 3600} hr`
  return `Every ${seconds / 86400} day${seconds === 86400 ? '' : 's'}`
}
