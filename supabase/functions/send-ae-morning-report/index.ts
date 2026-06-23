import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'
const TARGET_CHANNEL_NAME = Deno.env.get('SLACK_AE_REPORT_CHANNEL') ?? 'ct-sales'

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

function bogotaDayRange(now: Date): { fromIso: string; toIso: string; label: string } {
  const bogota = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = bogota.getUTCFullYear()
  const m = bogota.getUTCMonth()
  const d = bogota.getUTCDate()
  const from = new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1)
  const label = new Date(Date.UTC(y, m, d, 12)).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
  })
  return { fromIso: from.toISOString(), toIso: to.toISOString(), label }
}

function fmtMoney(v: number, c: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(v)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    const force = url.searchParams.get('force') === '1'
    const TOKEN = Deno.env.get('SLACK_BOT_TOKEN')
    if (!TOKEN) throw new Error('SLACK_BOT_TOKEN missing')

    const now = new Date()
    const bogotaDow = new Date(now.getTime() - 5 * 60 * 60 * 1000).getUTCDay()
    if (!force && (bogotaDow === 0 || bogotaDow === 6)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'weekend' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { fromIso, toIso, label } = bogotaDayRange(now)

    const [stagesRes, dealsRes, tasksRes] = await Promise.all([
      supabase.from('deal_stages').select('id, name, is_won, is_lost'),
      supabase.from('deals').select('id, account_executive, stage_id, value, currency, company_name'),
      supabase.from('deal_tasks').select('id, deal_id, title, due_at, assignee, completed').eq('completed', false).lte('due_at', toIso),
    ])
    if (stagesRes.error) throw stagesRes.error
    if (dealsRes.error) throw dealsRes.error
    if (tasksRes.error) throw tasksRes.error

    const stageMap = new Map<string, { name: string; is_won: boolean; is_lost: boolean }>(
      (stagesRes.data ?? []).map((s: any) => [s.id, { name: s.name, is_won: s.is_won, is_lost: s.is_lost }]),
    )
    const dealMap = new Map<string, any>((dealsRes.data ?? []).map((d: any) => [d.id, d]))

    // Also fetch ALL open tasks per deal to compute "deals sin tareas"
    const { data: allOpenTasks, error: allTasksErr } = await supabase
      .from('deal_tasks')
      .select('deal_id, completed')
      .eq('completed', false)
    if (allTasksErr) throw allTasksErr
    const dealsWithOpenTasks = new Set<string>((allOpenTasks ?? []).map((t: any) => t.deal_id))

    const NEGOCIACION = 'Propuesta en negociación'

    type AeAgg = {
      activeCount: number
      pipelineByCurrency: Record<string, number>
      tasksTodayCount: number
      dealsSinTareas: number
      negociacionTasks: { title: string; company: string; due: string }[]
    }
    const byAe: Record<string, AeAgg> = {}
    const ensure = (ae: string): AeAgg => (byAe[ae] ??= {
      activeCount: 0,
      pipelineByCurrency: {},
      tasksTodayCount: 0,
      dealsSinTareas: 0,
      negociacionTasks: [],
    })

    for (const d of dealsRes.data ?? []) {
      const s = stageMap.get(d.stage_id)
      if (!s || s.is_won || s.is_lost) continue
      const ae = ensure(d.account_executive)
      ae.activeCount++
      const cur = d.currency || 'USD'
      ae.pipelineByCurrency[cur] = (ae.pipelineByCurrency[cur] ?? 0) + Number(d.value ?? 0)
      if (!dealsWithOpenTasks.has(d.id)) ae.dealsSinTareas++
    }

    for (const t of tasksRes.data ?? []) {
      const d = dealMap.get(t.deal_id)
      if (!d) continue
      const s = stageMap.get(d.stage_id)
      if (!s || s.is_won || s.is_lost) continue
      if (new Date(t.due_at).toISOString() > toIso) continue
      const ae = ensure(t.assignee || d.account_executive)
      ae.tasksTodayCount++
      if (s.name === NEGOCIACION) {
        ae.negociacionTasks.push({
          title: t.title,
          company: d.company_name,
          due: new Date(t.due_at).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' }),
        })
      }
    }

    const aeNames = Object.keys(byAe).sort()
    const sections = aeNames.length === 0
      ? '_Sin deals activos_'
      : aeNames.map((ae) => {
          const a = byAe[ae]
          const pipeline = Object.entries(a.pipelineByCurrency)
            .map(([c, v]) => fmtMoney(v, c))
            .join(' + ') || '—'
          const header = `*${ae}*\n   Deals activos: *${a.activeCount}*  ·  Pipeline: *${pipeline}*  ·  Tareas hoy: *${a.tasksTodayCount}*  ·  Deals sin tareas: *${a.dealsSinTareas}*`
          const negTxt = a.negociacionTasks.length === 0
            ? '   _Sin tareas en Propuesta en negociación_'
            : `   _Tareas en Propuesta en negociación:_\n${a.negociacionTasks.map((t) => `   • ${t.title} — *${t.company}* _(${t.due})_`).join('\n')}`
          return `${header}\n${negTxt}`
        }).join('\n\n')

    const text = `☀️ Reporte AE — ${label}`
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: '☀️ Reporte de la mañana (AE)' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: label }] },
      { type: 'section', text: { type: 'mrkdwn', text: sections } },
    ]

    const channelId = await findChannelId(TARGET_CHANNEL_NAME, TOKEN)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel: channelId, text, blocks }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`chat.postMessage failed: ${data.error}`)

    return new Response(JSON.stringify({ ok: true, ts: data.ts, byAe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-ae-morning-report error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})