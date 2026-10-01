export function relativeTime(date: string, reference: string) {
  const minutes = Math.max(0, Math.floor((Date.parse(reference) - Date.parse(date)) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`
  return `${Math.floor(minutes / 1440)}d ago`
}
