import type { DashboardData } from './types'

export async function fetchDashboard(signal: AbortSignal): Promise<DashboardData> {
  const response = await fetch('/api/dashboard', { signal })
  if (!response.ok) throw new Error('The dashboard could not reach the API.')
  return response.json() as Promise<DashboardData>
}
