import { useState, type SubmitEvent } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { saveSource } from '../api'
import { providerLabels, type CollectionSource, type Provider, type SourceConfig } from '../types'

interface SourceFormProps {
  source: CollectionSource | null
  onSaved: () => void
}

const defaults: SourceConfig = { provider: 'rss', name: '', target: '', interval_seconds: 3600, enabled: true,
  keywords: [], item_limit: 20, telegram_access: 'public', x_mode: 'profile', comment_limit: 40, transcript_languages: ['da', 'en', 'ru'] }

const hints: Record<Provider, string> = {
  rss: 'A public RSS or Atom feed URL. News presets already include DR, BBC, and The Guardian.',
  telegram: 'A public channel username or t.me link. Public preview mode needs no account; account mode needs a local Telethon session.',
  youtube: 'A YouTube video or channel URL. Captures metadata, available caption tracks, and bounded comments; keeps a watch link.',
  x: 'A profile handle, or a Latest search query such as (Russia OR Rusland) (Denmark OR Danmark). Needs your own local X session.',
}

export function SourceForm({ source, onSaved }: SourceFormProps) {
  const [config, setConfig] = useState<SourceConfig>(source ?? defaults)
  const [keywords, setKeywords] = useState(source?.keywords.join(', ') ?? '')
  const [languages, setLanguages] = useState(source?.transcript_languages.join(', ') ?? 'da, en, ru')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectProvider(provider: Provider) {
    setConfig(current => ({ ...current, provider, target: '', item_limit: provider === 'youtube' ? 2 : 20,
      interval_seconds: provider === 'telegram' ? 300 : provider === 'x' ? 900 : provider === 'youtube' ? 1800 : 3600 }))
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveSource({ ...config, keywords: keywords.split(',').map(value => value.trim()).filter(Boolean),
        transcript_languages: languages.split(',').map(value => value.trim()).filter(Boolean) }, source?.id)
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save this source.')
    } finally { setSaving(false) }
  }

  return (
    <form className="source-form" onSubmit={submit}>
      <div className="form-row"><label>Platform<select aria-label="Platform" value={config.provider} disabled={Boolean(source)} onChange={event => selectProvider(event.target.value as Provider)}>
        {Object.entries(providerLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select></label><label>Source name<input required maxLength={100} aria-label="Source name" placeholder="A name you’ll recognise" value={config.name} onChange={event => setConfig(current => ({ ...current, name: event.target.value }))} /></label></div>
      {config.provider === 'x' && <label>Collect<select aria-label="X collection type" disabled={Boolean(source)} value={config.x_mode} onChange={event => setConfig(current => ({ ...current, x_mode: event.target.value as 'profile' | 'search' }))}><option value="profile">A specific profile</option><option value="search">A keyword search</option></select></label>}
      <label>{config.provider === 'rss' ? 'Feed URL' : config.provider === 'telegram' ? 'Channel' : config.provider === 'youtube' ? 'Video or channel URL' : config.x_mode === 'profile' ? 'Profile handle' : 'Search query'}
        <input required aria-label="Source target" maxLength={2048} disabled={Boolean(source)} type={config.provider === 'rss' || config.provider === 'youtube' ? 'url' : 'text'} value={config.target} onChange={event => setConfig(current => ({ ...current, target: event.target.value }))} placeholder={config.provider === 'rss' ? 'https://example.com/feed.xml' : config.provider === 'telegram' ? '@channel' : config.provider === 'youtube' ? 'https://www.youtube.com/@channel/videos' : config.x_mode === 'profile' ? '@profile' : '(Russia OR Rusland) (Denmark OR Danmark)'} />
        <small>{hints[config.provider]}</small></label>
      <div className="form-row"><label>Poll every (minutes)<input required aria-label="Poll every (minutes)" type="number" min={1} max={10080} step={1} value={config.interval_seconds / 60} onChange={event => setConfig(current => ({ ...current, interval_seconds: Number(event.target.value) * 60 }))} /></label>
        <label>{config.provider === 'youtube' ? 'Videos per run' : 'Items per run'}<input required aria-label="Items per run" type="number" min={1} max={config.provider === 'youtube' ? 5 : 100} value={config.item_limit} onChange={event => setConfig(current => ({ ...current, item_limit: Number(event.target.value) }))} /></label></div>
      {config.provider === 'telegram' && <label>Telegram access<select aria-label="Telegram access" value={config.telegram_access} onChange={event => setConfig(current => ({ ...current, telegram_access: event.target.value as 'public' | 'account' }))}><option value="public">Public web preview · no sign-in</option><option value="account">Telegram account · incremental posts</option></select></label>}
      <label>Keep items matching these keywords <span className="optional-label">optional</span><input aria-label="Keywords" value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="Russia, Rusland, russisk, Denmark, Danmark" />
        <small>Comma-separated, case-insensitive text matches. Any keyword matches; leave empty to keep all collected items.</small></label>
      {config.provider === 'youtube' && <div className="form-row"><label>Newest comments per video<input aria-label="Comments per video" type="number" min={0} max={200} value={config.comment_limit} onChange={event => setConfig(current => ({ ...current, comment_limit: Number(event.target.value) }))} /></label>
        <label>Caption languages<input aria-label="Caption languages" required value={languages} onChange={event => setLanguages(event.target.value)} /><small>Preferred language order, e.g. da, en, ru.</small></label></div>}
      <label className="checkbox-label"><input type="checkbox" checked={config.enabled} onChange={event => setConfig(current => ({ ...current, enabled: event.target.checked }))} />Enable scheduled collection</label>
      {error && <p className="collection-error" role="alert">{error}</p>}
      <div className="source-form-footer"><span>Schedules require the separate worker to be running.</span><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle size={15} className="loading-spinner" /> : <Check size={15} />}Save source</button></div>
    </form>
  )
}
