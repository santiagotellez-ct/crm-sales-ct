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
    const {
      summary,
      description = '',
      scheduled_at, // ISO string
      duration_minutes = 30,
      ae_email,
      contact_emails = [],
    } = body ?? {}

    if (!summary || !scheduled_at) {
      return new Response(
        JSON.stringify({ error: 'summary and scheduled_at are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const start = new Date(scheduled_at)
    const end = new Date(start.getTime() + duration_minutes * 60_000)

    const attendees: { email: string }[] = []
    if (ae_email) attendees.push({ email: ae_email })
    for (const e of contact_emails) {
      if (e && typeof e === 'string') attendees.push({ email: e })
    }

    const event = {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `meet-${crypto.randomUUID()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }

    const url = `${GATEWAY_URL}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_CALENDAR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    const data = await resp.json()
    if (!resp.ok) {
      throw new Error(`Google Calendar API failed [${resp.status}]: ${JSON.stringify(data)}`)
    }

    const meetLink: string | null =
      data?.hangoutLink ??
      data?.conferenceData?.entryPoints?.find((p: any) => p.entryPointType === 'video')?.uri ??
      null

    return new Response(
      JSON.stringify({
        event_id: data.id,
        html_link: data.htmlLink,
        meet_link: meetLink,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('create-calendar-event error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})