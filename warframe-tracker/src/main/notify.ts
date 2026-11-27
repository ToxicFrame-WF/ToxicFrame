import { Notification } from 'electron'
import { getPrefs, setPrefs } from './appPrefs'

export type NotifyKind =
  'arbitration' | 'marketDeal' | 'undercut' | 'trade' | 'reward' | 'chat' | 'cycle' | 'sniper'

export interface NotifyRoute {
  windows: boolean
  discord: boolean
}
export interface NotifyConfig {
  webhook: string
  routes: Record<NotifyKind, NotifyRoute>
  templates: { chat: string }
  chatOnlyBackground: boolean
}

const KINDS: NotifyKind[] = [
  'arbitration',
  'marketDeal',
  'undercut',
  'trade',
  'reward',
  'chat',
  'cycle',
  'sniper'
]

export function defaultNotifyConfig(): NotifyConfig {
  return {
    webhook: '',
    routes: Object.fromEntries(KINDS.map((k) => [k, { windows: true, discord: false }])) as Record<
      NotifyKind,
      NotifyRoute
    >,
    templates: {
      chat: 'New in-game conversation from **<PLAYER_NAME>**'
    },
    chatOnlyBackground: true
  }
}

// Saved settings may predate a kind or field, so fill the gaps from the defaults.
export function getNotifyConfig(): NotifyConfig {
  const d = defaultNotifyConfig()
  const s = getPrefs().notify
  if (!s) return d
  for (const k of KINDS) d.routes[k] = { ...d.routes[k], ...s.routes?.[k] }
  return {
    webhook: typeof s.webhook === 'string' ? s.webhook : '',
    routes: d.routes,
    // an empty template means "use the default" (that is how the Reset button works)
    templates: {
      chat: s.templates?.chat || d.templates.chat
    },
    chatOnlyBackground: s.chatOnlyBackground ?? d.chatOnlyBackground
  }
}

// What the renderer may see: never the webhook itself.
export function getMaskedConfig(): Omit<NotifyConfig, 'webhook'> & {
  webhookSet: boolean
  webhookTail: string
} {
  const { webhook, ...rest } = getNotifyConfig()
  return { ...rest, webhookSet: !!webhook, webhookTail: webhook.slice(-4) }
}

export function setNotifyConfig(patch: {
  webhook?: string
  routes?: Partial<Record<NotifyKind, Partial<NotifyRoute>>>
  templates?: Partial<NotifyConfig['templates']>
  chatOnlyBackground?: boolean
}): void {
  const cur = getNotifyConfig()
  for (const k of KINDS)
    if (patch.routes?.[k]) cur.routes[k] = { ...cur.routes[k], ...patch.routes[k] }
  setPrefs({
    notify: {
      // only a real Discord webhook (or '' to clear) replaces the saved one
      webhook:
        typeof patch.webhook === 'string' &&
        (patch.webhook.trim() === '' || validWebhook(patch.webhook.trim()))
          ? patch.webhook.trim()
          : cur.webhook,
      routes: cur.routes,
      templates: { ...cur.templates, ...patch.templates },
      chatOnlyBackground:
        typeof patch.chatOnlyBackground === 'boolean'
          ? patch.chatOnlyBackground
          : cur.chatOnlyBackground
    }
  })
}

const WEBHOOK = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/
export const validWebhook = (u: string): boolean => WEBHOOK.test(u)

// One message at a time; a 429 is retried once after the wait Discord asks for.
let queue: Promise<unknown> = Promise.resolve()
export function sendDiscord(
  content: string,
  to?: string
): Promise<{ ok: boolean; error?: string }> {
  const job = queue.then(async () => {
    const url = to ?? getNotifyConfig().webhook
    if (!validWebhook(url)) return { ok: false, error: 'No valid Discord webhook set' }
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.slice(0, 2000),
            allowed_mentions: { parse: [] }
          }),
          signal: AbortSignal.timeout(20_000)
        })
        if (res.ok) return { ok: true }
        if (res.status === 429 && attempt === 0) {
          const j = (await res.json().catch(() => ({}))) as { retry_after?: number }
          await new Promise((r) => setTimeout(r, Math.min(30, j.retry_after ?? 1) * 1000))
          continue
        }
        console.warn('Discord webhook failed:', res.status)
        return { ok: false, error: `Discord answered ${res.status}` }
      }
    } catch (e) {
      console.warn('Discord webhook failed:', e)
      return { ok: false, error: e instanceof Error ? e.message : 'Request failed' }
    }
    return { ok: false, error: 'Rate limited' }
  })
  queue = job
  return job
}

export interface NotifyArgs {
  kind: NotifyKind
  title: string
  body: string
  discord?: string
  onClick?: () => void
}

export function notify(n: NotifyArgs): void {
  try {
    const cfg = getNotifyConfig()
    const r = cfg.routes[n.kind]
    if (!r) return
    if (r.windows && Notification.isSupported()) {
      // silent: no notification sounds
      const w = new Notification({ title: n.title, body: n.body, silent: true })
      if (n.onClick) w.on('click', n.onClick)
      w.show()
    }
    if (r.discord && validWebhook(cfg.webhook))
      void sendDiscord(n.discord ?? `**${n.title}**\n${n.body}`)
  } catch (e) {
    console.warn('notify failed:', e)
  }
}

export async function testNotify(): Promise<{ ok: boolean; error?: string }> {
  if (Notification.isSupported())
    new Notification({ title: 'ToxicFrame', body: 'Test notification', silent: true }).show()
  return sendDiscord('Test notification') // the webhook's name already shows who sent it
}
