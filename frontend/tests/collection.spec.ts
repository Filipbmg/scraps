import { expect, test } from '@playwright/test'
import type { CollectionSource, CollectionWorkspace, ItemSummary, SourceConfig } from '../src/features/collection/types'

function initialWorkspace(): CollectionWorkspace {
  return {
    sources: [{ id: 'news', provider: 'rss', name: 'BBC Europe', target: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', interval_seconds: 3600,
      enabled: true, keywords: ['Russia'], item_limit: 20, telegram_access: 'public', x_mode: 'profile', comment_limit: 40, transcript_languages: ['da', 'en', 'ru'],
      status: 'never_run', item_count: 0, last_run_at: null, next_run_at: '2026-10-01T10:00:00Z', last_error: null, last_note: null, failures: 0 }],
    runs: [], capabilities: [
      { provider: 'rss', installed: true, credentials_configured: true, note: 'RSS/Atom feeds need no API key.' },
      { provider: 'telegram', installed: true, credentials_configured: false, note: 'Public previews need no sign-in.' },
      { provider: 'youtube', installed: true, credentials_configured: true, note: 'Metadata, caption tracks, and bounded comments.' },
      { provider: 'x', installed: true, credentials_configured: false, note: 'Local X session required.' },
    ], worker_running: false, worker_last_seen: null, item_count: 0,
  }
}

test('collector configuration saves per-source frequency, pauses, and queues honestly', async ({ page }, testInfo) => {
  const workspace = initialWorkspace()
  const writes: { method: string; body: Record<string, unknown> }[] = []
  await page.route('**/api/collection**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST' && path.endsWith('/sources')) {
      const body = request.postDataJSON() as SourceConfig
      writes.push({ method: 'POST', body: { ...body } })
      const source: CollectionSource = { ...workspace.sources[0], ...body, id: 'video' }
      workspace.sources.push(source)
      await route.fulfill({ status: 201, json: source })
    } else if (request.method() === 'PATCH') {
      const id = path.split('/').at(-1)
      const source = workspace.sources.find(item => item.id === id)!
      const body = request.postDataJSON() as Partial<CollectionSource>
      writes.push({ method: 'PATCH', body })
      Object.assign(source, body)
      source.status = source.enabled ? 'never_run' : 'paused'
      await route.fulfill({ json: source })
    } else if (request.method() === 'POST' && path.endsWith('/run')) {
      const source = workspace.sources.find(item => item.id === path.split('/').at(-2))!
      source.status = 'queued'
      await route.fulfill({ status: 202, json: source })
    } else await route.fulfill({ json: workspace })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Collectors', exact: true }).click()
  await expect(page.getByLabel('Collector worker status')).toContainText('Worker offline')
  await page.getByRole('button', { name: 'Add source', exact: true }).click()
  await page.getByLabel('Platform').selectOption('youtube')
  await page.getByLabel('Source name').fill('Danish video watch')
  await page.getByLabel('Source target').fill('https://www.youtube.com/@news/videos')
  await page.getByLabel('Poll every (minutes)').fill('15')
  await page.getByLabel('Keywords', { exact: true }).fill('Russia, Danmark')
  await page.getByRole('button', { name: 'Save source' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Danish video watch', exact: true })).toBeVisible()
  expect(writes[0].body).toMatchObject({ provider: 'youtube', interval_seconds: 900, item_limit: 2, comment_limit: 40, keywords: ['Russia', 'Danmark'] })
  await page.getByRole('button', { name: 'Edit Danish video watch' }).click()
  await page.getByLabel('Poll every (minutes)').fill('30')
  await page.getByRole('button', { name: 'Save source' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(writes[1].body.interval_seconds).toBe(1800)
  expect(writes[1].body).not.toHaveProperty('provider')
  await page.getByRole('button', { name: 'Pause Danish video watch' }).click()
  const card = page.locator('.collector-card').filter({ has: page.getByRole('heading', { name: 'Danish video watch' }) })
  await expect(card).toContainText('Paused')
  await card.getByRole('button', { name: 'Queue run' }).click()
  await expect(card).toContainText('Queued')
  await expect(page.getByLabel('Collector worker status')).toContainText('Worker offline')
  await page.screenshot({ path: testInfo.outputPath('collectors-light.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('collectors-mobile.png'), fullPage: true })
})

test('collected feed searches, narrows Denmark links, and opens captions and comments', async ({ page }, testInfo) => {
  const workspace = initialWorkspace()
  workspace.sources[0].provider = 'youtube'
  workspace.sources[0].name = 'Video watch'
  workspace.item_count = 2
  const items: ItemSummary[] = [
    { id: 'video', source_id: 'news', provider: 'youtube', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', title: 'Russia and Denmark briefing', excerpt: 'A collected video description.',
      published_at: '2026-10-01T10:00:00Z', collected_at: '2026-10-01T11:00:00Z', author: 'Publisher', keywords: ['Russia'], denmark_related: true, transcript_status: 'available', comment_count: 1 },
    { id: 'story', source_id: 'news', provider: 'rss', url: 'https://example.com/story', title: 'Russia news from Europe', excerpt: 'A publisher feed summary.',
      published_at: '2026-10-01T09:00:00Z', collected_at: '2026-10-01T11:00:00Z', author: null, keywords: ['Russia'], denmark_related: false, transcript_status: null, comment_count: 0 },
  ]
  await page.route('**/api/collection**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/items/video')) await route.fulfill({ json: {
      ...items[0], external_id: 'jNQXAC9IVRw', text: 'A collected video description.',
      transcript: { status: 'available', language: 'en', generated: true, text: 'An actual caption response in this test fixture.', note: null, segments: [] },
      comments: [{ id: 'c1', text: 'A captured comment in this test fixture.', author: 'Viewer', likes: 2, published_at: null }], metadata: { comments_scope: 'Up to 40 newest comments' },
    } })
    else if (url.pathname.endsWith('/items')) {
      const filtered = items.filter(item => (!url.searchParams.get('provider') || item.provider === url.searchParams.get('provider'))
        && (url.searchParams.get('denmark_only') !== 'true' || item.denmark_related)
        && item.title.toLowerCase().includes((url.searchParams.get('query') ?? '').toLowerCase()))
      await route.fulfill({ json: { items: filtered, total: filtered.length, limit: 25, offset: 0 } })
    } else await route.fulfill({ json: workspace })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Collected feed', exact: true }).click()
  await expect(page.locator('.collected-record')).toHaveCount(2)
  await page.getByLabel('Denmark connection', { exact: true }).check()
  await expect(page.locator('.collected-record')).toHaveCount(1)
  await page.getByLabel('Filter collected platform').selectOption('youtube')
  await page.getByLabel('Search mentions').fill('Denmark')
  await expect(page.locator('.collected-record')).toHaveCount(1)
  await page.getByRole('button', { name: 'Russia and Denmark briefing', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: 'Open original' })).toHaveAttribute('href', items[0].url)
  await dialog.locator('summary').filter({ hasText: 'Transcript' }).click()
  await expect(dialog.getByLabel('Transcript text')).toContainText('An actual caption response')
  await dialog.locator('summary').filter({ hasText: 'Captured comments' }).click()
  await expect(dialog).toContainText('A captured comment')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({ path: testInfo.outputPath('collected-dark.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
