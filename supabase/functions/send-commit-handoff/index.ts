import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'
const TARGET_CHANNEL = Deno.env.get('SLACK_COMMIT_HANDOFF_CHANNEL') ?? 'cierres-handoff-customersuccess'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const TOKEN = Deno.env.get('SLACK_BOT_TOKEN')
    if (!TOKEN) throw new Error('SLACK_BOT_TOKEN missing')

    const { deal_id } = await req.json()
    if (!deal_id) throw new Error('deal_id required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: deal, error } = await supabase
      .from('deals')
      .select('company_name, name, account_executive, event, value, currency, paquete_vendido, adicionales_paquete, sponsor_pain, sponsor_icp, commit_speaking_main, commit_speaking_second, commit_workshop, commit_stand, commit_experience_id, notes')
      .eq('id', deal_id)
      .single()
    if (error) throw error
    if (!deal) throw new Error('deal not found')

    let experienceName: string | null = null
    if (deal.commit_experience_id) {
      const { data: exp } = await supabase
        .from('event_experiences')
        .select('name')
        .eq('id', deal.commit_experience_id)
        .maybeSingle()
      experienceName = exp?.name ?? null
    }

    const incluye: string[] = []
    if (deal.commit_speaking_main) incluye.push('Speaking main stage')
    if (deal.commit_speaking_second) incluye.push('Speaking second stage')
    if (deal.commit_workshop) incluye.push('Workshop')
    if (deal.commit_stand) incluye.push('Stand')
    if (experienceName) incluye.push(`Experiencia: ${experienceName}`)

    const money = deal.value
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD', maximumFractionDigits: 0 }).format(Number(deal.value))
      : null

    const lines: string[] = []
    lines.push(`🎉 *Nuevo Commit* — *${deal.company_name}*${deal.event ? ` · _${deal.event}_` : ''}`)
    if (deal.account_executive) lines.push(`*AE:* ${deal.account_executive}`)
    if (money) lines.push(`*Valor:* ${money}`)
    lines.push('')
    lines.push(`*Paquete vendido:* ${deal.paquete_vendido || '—'}`)
    if (deal.adicionales_paquete) lines.push(`*Adicionales:* ${deal.adicionales_paquete}`)
    lines.push(`*Incluye:* ${incluye.length ? incluye.join(', ') : '—'}`)
    lines.push(`*Pain / expectativa:* ${deal.sponsor_pain || '—'}`)
    lines.push(`*ICP del sponsor:* ${deal.sponsor_icp || '—'}`)

    const text = lines.join('\n')
    const channel = await findChannelId(TARGET_CHANNEL, TOKEN)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`chat.postMessage failed: ${data.error}`)

    return new Response(JSON.stringify({ ok: true, ts: data.ts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('send-commit-handoff error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})