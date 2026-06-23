import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'
const TARGET_CHANNEL_NAME = Deno.env.get('SLACK_OPEN_DEALS_CHANNEL') ?? 'deals-abiertos'

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

function fmtMoney(v: number, c: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(v)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const TOKEN = Deno.env.get('SLACK_BOT_TOKEN')
    if (!TOKEN) throw new Error('SLACK_BOT_TOKEN missing')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [stagesRes, dealsRes] = await Promise.all([
      supabase.from('deal_stages').select('id, name, "order", is_won, is_lost').order('order', { ascending: true }),
      supabase.from('deals').select('id, company_name, stage_id, account_executive, value, currency, event'),
    ])
    if (stagesRes.error) throw stagesRes.error
    if (dealsRes.error) throw dealsRes.error

    // Include all stages from "Discovery realizada" through "Cierre ganado" (exclude lost)
    const stages = (stagesRes.data ?? []).filter((s: any) => !s.is_lost)
    const stageOrder = new Map<string, number>(stages.map((s: any) => [s.id, s.order]))
    const stageName = new Map<string, string>(stages.map((s: any) => [s.id, s.name]))

    const isCtw = (e: unknown) => typeof e === 'string' && e.toUpperCase().includes('CTW')
    const open = (dealsRes.data ?? []).filter((d: any) => stageOrder.has(d.stage_id) && isCtw(d.event))

    // Group by stage in order
    const byStage = new Map<string, any[]>()
    for (const s of stages) byStage.set(s.id, [])
    for (const d of open) byStage.get(d.stage_id)!.push(d)

    const today = new Date().toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long',
    })

    const text = `📂 Deals abiertos — ${today}`
    const blocks: any[] = [
      { type: 'header', text: { type: 'plain_text', text: '📂 Deals abiertos' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `${today} · ${open.length} empresas` }] },
    ]
    // One section per stage; chunk lines to stay under Slack's 3000-char limit per section.
    const pushChunked = (header: string, lines: string[]) => {
      const MAX = 2800
      let buf = header
      for (const ln of lines) {
        if (buf.length + ln.length + 1 > MAX) {
          blocks.push({ type: 'section', text: { type: 'mrkdwn', text: buf } })
          buf = `${header} _(cont.)_`
        }
        buf += '\n' + ln
      }
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: buf } })
    }

    let anyContent = false
    for (const s of stages) {
      const list = byStage.get(s.id) ?? []
      if (list.length === 0) continue
      anyContent = true
      const lines = list
        .sort((a: any, b: any) => a.company_name.localeCompare(b.company_name))
        .map((d: any) => `   • *${d.company_name}* — ${d.account_executive} · ${fmtMoney(Number(d.value ?? 0), d.currency || 'USD')}`)
      pushChunked(`*${s.name}* (${list.length})`, lines)
    }
    if (!anyContent) {
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_Sin deals abiertos_' } })
    }

    const channelId = await findChannelId(TARGET_CHANNEL_NAME, TOKEN)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel: channelId, text, blocks }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`chat.postMessage failed: ${data.error}`)

    return new Response(JSON.stringify({ ok: true, ts: data.ts, count: open.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-open-deals-report error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})