import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'
const TARGET_CHANNEL_NAME = Deno.env.get('SLACK_REPORT_CHANNEL') ?? 'ct-sales'
const PRIMARY_SDRS = ['Jissad', 'Mapi'] as const

// Emails used to resolve SDR Slack user IDs for @-mentions.
// Override via SDR_EMAILS_JSON env (e.g. {"Jissad":"x@y.com","Mapi":"a@b.com"}).
const DEFAULT_SDR_EMAILS: Record<string, string> = {
  Jissad: 'jissad@colombiatechweek.co',
  Mapi: 'mapi@colombiatechweek.co',
}
function loadSdrEmails(): Record<string, string> {
  try {
    const raw = Deno.env.get('SDR_EMAILS_JSON')
    if (raw) return { ...DEFAULT_SDR_EMAILS, ...JSON.parse(raw) }
  } catch (_) { /* ignore */ }
  return DEFAULT_SDR_EMAILS
}

async function lookupSlackUserIdByEmail(email: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok && data.user?.id) return data.user.id as string
  } catch (_) { /* ignore */ }
  return null
}

async function findChannelId(name: string, token: string): Promise<string> {
  const target = name.replace(/^#/, '')
  let cursor = ''
  do {
    const url = `${SLACK_API}/conversations.list?limit=200&types=public_channel,private_channel${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!data.ok) throw new Error(`conversations.list failed: ${data.error}`)
    const hit = data.channels?.find((c: { name: string; id: string }) => c.name === target)
    if (hit) return hit.id
    cursor = data.response_metadata?.next_cursor || ''
  } while (cursor)
  throw new Error(`Channel #${target} not found`)
}

// ISO week (Mon start, Jan 4 in week 1) — matches src/lib/week.ts
function getIsoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: d.getUTCFullYear(), week }
}

// Day range in Colombia time (UTC-5, no DST) → returns UTC ISO bounds
function colombiaDayRange(now: Date): { fromIso: string; toIso: string; label: string } {
  // Colombia = UTC-5 year-round. "Today in Bogota" = now shifted -5h, then take its UTC date.
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = bogota.getUTCFullYear()
  const m = bogota.getUTCMonth()
  const d = bogota.getUTCDate()
  // 00:00 Bogota = 05:00 UTC of same date
  const from = new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1)
  const label = new Date(Date.UTC(y, m, d, 12)).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return { fromIso: from.toISOString(), toIso: to.toISOString(), label }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') === '1'

    const TOKEN = Deno.env.get('SLACK_BOT_TOKEN')
    if (!TOKEN) throw new Error('SLACK_BOT_TOKEN missing')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const now = new Date()
    // Skip weekends (Bogota): only Mon–Fri
    const bogotaDow = new Date(now.getTime() - 5 * 60 * 60 * 1000).getUTCDay() // 0=Sun, 6=Sat
    if (!force && (bogotaDow === 0 || bogotaDow === 6)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'weekend' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { fromIso, toIso, label } = colombiaDayRange(now)
    const { year: isoYear, week: isoWeek } = getIsoWeek(now)

    // Resolve Slack user IDs for SDR @-mentions
    const sdrEmails = loadSdrEmails()
    const sdrMention: Record<string, string> = {}
    await Promise.all(
      Object.entries(sdrEmails).map(async ([sdr, email]) => {
        if (!email) return
        const uid = await lookupSlackUserIdByEmail(email, TOKEN)
        if (uid) sdrMention[sdr] = `<@${uid}>`
      }),
    )
    const mentionFor = (sdr: string): string => sdrMention[sdr] ?? `*${sdr}*`

    // Activities of the day
    const { data: activities, error: actErr } = await supabase
      .from('activities')
      .select('type, to_status, sdr, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
    if (actErr) throw actErr

    // Meetings created today (counts as "agendadas") — include company name
    const { data: meetingsToday, error: mtErr } = await supabase
      .from('meetings')
      .select('sdr, company_name, created_at')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
    if (mtErr) throw mtErr

    // Per-SDR aggregation — Jissad & Mapi individually, everyone else grouped as "Otros SDR"
    type Bucket = { prospectadas: number; contactos: number; reuniones: number; meetingCompanies: string[] }
    const newBucket = (): Bucket => ({ prospectadas: 0, contactos: 0, reuniones: 0, meetingCompanies: [] })
    const perSdr: Record<string, Bucket> = {
      Jissad: newBucket(),
      Mapi: newBucket(),
      'Otros SDR': newBucket(),
    }
    const bucketFor = (sdr: string | null): Bucket => {
      if (sdr === 'Jissad') return perSdr.Jissad
      if (sdr === 'Mapi') return perSdr.Mapi
      return perSdr['Otros SDR']
    }

    for (const a of activities ?? []) {
      const b = bucketFor(a.sdr as string | null)
      if (a.type === 'status_change' && a.to_status === 'contactado') b.prospectadas++
      else if (a.type === 'contact_added') b.contactos++
    }
    for (const m of meetingsToday ?? []) {
      const b = bucketFor(m.sdr as string | null)
      b.reuniones++
      if (m.company_name) b.meetingCompanies.push(m.company_name as string)
    }

    const orderedSdrs = ['Jissad', 'Mapi', 'Otros SDR'] as const
    const totals = orderedSdrs.reduce(
      (acc, s) => ({
        prospectadas: acc.prospectadas + perSdr[s].prospectadas,
        contactos: acc.contactos + perSdr[s].contactos,
        reuniones: acc.reuniones + perSdr[s].reuniones,
      }),
      { prospectadas: 0, contactos: 0, reuniones: 0 },
    )

    // Weekly meeting goal vs achieved (by AE, current ISO week)
    const { data: goals } = await supabase
      .from('meeting_goals')
      .select('account_executive, goal')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek)

    const { data: weekMeetings } = await supabase
      .from('meetings')
      .select('account_executive')
      .eq('iso_year', isoYear)
      .eq('iso_week', isoWeek)

    const goalByAe: Record<string, number> = {}
    for (const g of goals ?? []) goalByAe[g.account_executive] = g.goal
    const achievedByAe: Record<string, number> = {}
    for (const m of weekMeetings ?? []) {
      const ae = m.account_executive as string
      achievedByAe[ae] = (achievedByAe[ae] ?? 0) + 1
    }
    // Union of AE names from goals + achieved
    const aeNames = Array.from(new Set([...Object.keys(goalByAe), ...Object.keys(achievedByAe)])).sort()
    const totalGoal = Object.values(goalByAe).reduce((a, b) => a + b, 0)
    const totalAchieved = Object.values(achievedByAe).reduce((a, b) => a + b, 0)
    const pct = totalGoal > 0 ? Math.round((totalAchieved / totalGoal) * 100) : 0

    // Companies currently in "reagendar" — grouped by SDR
    const { data: reagendarRows } = await supabase
      .from('companies')
      .select('company_name, sdr')
      .eq('status', 'reagendar')
      .order('company_name')

    const reagendarBySdr: Record<string, string[]> = { Jissad: [], Mapi: [], 'Otros SDR': [] }
    const reagendarUnassigned: string[] = []
    for (const r of reagendarRows ?? []) {
      const sdr = r.sdr as string | null
      if (!sdr) reagendarUnassigned.push(r.company_name)
      else if (sdr === 'Jissad' || sdr === 'Mapi') reagendarBySdr[sdr].push(r.company_name)
      else reagendarBySdr['Otros SDR'].push(r.company_name)
    }
    const totalReagendar = (reagendarRows ?? []).length

    // Build message — skip "Otros SDR" if no value to report
    const visibleSdrs = orderedSdrs.filter((s) => {
      if (s !== 'Otros SDR') return true
      const b = perSdr[s]
      return b.prospectadas + b.contactos + b.reuniones > 0
    })
    const sdrLines = visibleSdrs.map((s) => {
      const b = perSdr[s]
      const label = s === 'Otros SDR' ? `*${s}*` : mentionFor(s)
      const head = `• ${label} — ${b.prospectadas} empresas · ${b.contactos} contactos · ${b.reuniones} reuniones`
      const meetings = b.meetingCompanies.length
        ? `\n   _Reuniones:_ ${b.meetingCompanies.join(', ')}`
        : ''
      return head + meetings
    }).join('\n')

    const goalLines = aeNames.length
      ? aeNames
          .map((ae) => `• *${ae}*: ${achievedByAe[ae] ?? 0} / ${goalByAe[ae] ?? 0}`)
          .join('\n')
      : '• _Sin metas configuradas para esta semana_'

    const reagendarSdrOrder = ['Jissad', 'Mapi', 'Otros SDR'] as const
    const reagendarSections = reagendarSdrOrder
      .map((s) => {
        const list = reagendarBySdr[s]
        if (!list || list.length === 0) return null
        const label = s === 'Otros SDR' ? `*${s}*` : mentionFor(s)
        return `${label} (${list.length})\n${list.map((n) => `   • ${n}`).join('\n')}`
      })
      .filter(Boolean)
    if (reagendarUnassigned.length > 0) {
      reagendarSections.push(
        `*Sin SDR asignado* (${reagendarUnassigned.length})\n${reagendarUnassigned.map((n) => `   • ${n}`).join('\n')}`,
      )
    }
    const reagendarText = totalReagendar === 0
      ? '_Ninguna empresa para reagendar_'
      : reagendarSections.join('\n\n')

    const text = `📊 Reporte del día — ${label}`
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: `📊 Reporte del día` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: label }] },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Por SDR*\n${sdrLines}` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Equipo (total del día)*\n• ${totals.prospectadas} empresas contactadas\n• ${totals.contactos} contactos agregados\n• ${totals.reuniones} reuniones agendadas`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎯 *Meta semanal de reuniones* (semana ${isoWeek})\n${goalLines}\n\n*Total equipo:* ${totalAchieved} / ${totalGoal} (${pct}%)`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔁 *Empresas para reagendar* (${totalReagendar})\n${reagendarText}`,
        },
      },
    ]

    const channelId = await findChannelId(TARGET_CHANNEL_NAME, TOKEN)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel: channelId, text, blocks }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`chat.postMessage failed: ${data.error}`)

    return new Response(
      JSON.stringify({ ok: true, ts: data.ts, totals, perSdr, weekly: { goalByAe, achievedByAe, totalGoal, totalAchieved, pct } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-daily-report error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})