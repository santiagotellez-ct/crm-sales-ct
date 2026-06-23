import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_calendar/calendar/v3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')
    const GOOGLE_CALENDAR_API_KEY = Deno.env.get('GOOGLE_CALENDAR_API_KEY')
    if (!GOOGLE_CALENDAR_API_KEY) throw new Error('GOOGLE_CALENDAR_API_KEY is not configured')

    const body = await req.json()
    const { event_id, scheduled_at, duration_minutes = 30 } = body ?? {}
    if (!event_id || !scheduled_at) {
      return new Response(JSON.stringify({ error: 'event_id and scheduled_at are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const start = new Date(scheduled_at)
    const end = new Date(start.getTime() + duration_minutes * 60_000)

    const url = `${GATEWAY_URL}/calendars/primary/events/${encodeURIComponent(event_id)}?sendUpdates=all`
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(`Google Calendar API failed [${resp.status}]: ${JSON.stringify(data)}`)

    return new Response(JSON.stringify({ ok: true, event_id: data.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('update-calendar-event error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})