import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'
const TARGET_CHANNEL_NAME = 'meeting-feedback'

// AE name (as stored in meetings.account_executive) → corporate email
const AE_EMAILS: Record<string, string> = {
  Nico: 'nicolas@colombiatechweek.co',
  Majo: 'mariajose@colombiatechweek.co',
  Santi: 'santiago@colombiatechweek.co',
  Toqui: 'juan@colombiatechweek.co',
}

async function slack(method: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`${method} failed: ${data.error ?? res.status}`)
  return data
}

async function findChannelId(name: string, token: string): Promise<string> {
  const target = name.replace(/^#/, '')
  let cursor = ''
  do {
    const url = `${SLACK_API}/conversations.list?limit=200&types=public_channel,private_channel${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!data.ok) throw new Error(`conversations.list failed: ${data.error}`)
    const hit = data.channels?.find((c: { name: string; id: string }) => c.name === target)
    if (hit) return hit.id
    cursor = data.response_metadata?.next_cursor || ''
  } while (cursor)
  throw new Error(`Channel #${target} not found (bot may need to be invited)`)
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

    const nowIso = new Date().toISOString()
    const { data: pending, error } = await supabase
      .from('meetings')
      .select('id, company_name, account_executive, scheduled_at, meeting_ends_at, meet_link, sdr')
      .lte('meeting_ends_at', nowIso)
      .is('slack_prompt_sent_at', null)
      .is('outcome', null)
      .limit(25)

    if (error) throw error
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const channelId = await findChannelId(TARGET_CHANNEL_NAME, TOKEN)

    const results: Array<{ id: string; ok: boolean; error?: string }> = []

    for (const m of pending) {
      try {
        const aeName = m.account_executive as string
        const email = AE_EMAILS[aeName]
        // Try to resolve Slack user for @mention; fallback to plain name
        let mention = `*${aeName}*`
        if (email) {
          try {
            const lookupRes = await fetch(
              `${SLACK_API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
              {
                method: 'GET',
                headers: { Authorization: `Bearer ${TOKEN}` },
              },
            )
            const user = await lookupRes.json()
            if (user.ok && user.user?.id) {
              mention = `<@${user.user.id}>`
            } else {
              console.warn(`users.lookupByEmail (${email}): ${user.error} — using plain name`)
            }
          } catch (e) {
            console.warn(`lookup error for ${email}:`, e)
          }
        }

        const localTime = new Date(m.scheduled_at).toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })

        const text = `${mention} ¿cómo te fue la reunión con ${m.company_name}? (${localTime})`
        const blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:wave: ${mention} *Validación de reunión*\n*Empresa:* ${m.company_name}\n*Hora:* ${localTime}${m.meet_link ? `\n*Meet:* ${m.meet_link}` : ''}\n\n¿Cómo te fue?`,
            },
          },
          {
            type: 'actions',
            block_id: `meeting_${m.id}`,
            elements: [
              {
                type: 'button',
                style: 'primary',
                text: { type: 'plain_text', text: '✅ Qualified' },
                value: `qualified:${m.id}`,
                action_id: 'meeting_qualified',
              },
              {
                type: 'button',
                style: 'danger',
                text: { type: 'plain_text', text: '❌ Unqualified' },
                value: `unqualified:${m.id}`,
                action_id: 'meeting_unqualified',
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '🔁 No show' },
                value: `no_show:${m.id}`,
                action_id: 'meeting_no_show',
              },
            ],
          },
        ]

        const post = await slack(
          'chat.postMessage',
          { channel: channelId, text, blocks },
          TOKEN,
        )

        await supabase
          .from('meetings')
          .update({
            slack_prompt_sent_at: new Date().toISOString(),
            slack_channel_id: channelId,
            slack_message_ts: post.ts,
          })
          .eq('id', m.id)

        results.push({ id: m.id, ok: true })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('meeting validation failed', m.id, msg)
        results.push({ id: m.id, ok: false, error: msg })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('send-meeting-validation error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})