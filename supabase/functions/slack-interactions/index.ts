import { createClient } from 'npm:@supabase/supabase-js@2'

const SLACK_API = 'https://slack.com/api'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

async function verifySlackSignature(req: Request, rawBody: string, signingSecret: string): Promise<boolean> {
  const ts = req.headers.get('x-slack-request-timestamp')
  const sig = req.headers.get('x-slack-signature')
  if (!ts || !sig) return false

  // Reject if older than 5 min (replay protection)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(ts, 10)) > 60 * 5) return false

  const base = `v0:${ts}:${rawBody}`
  const keyData = new TextEncoder().encode(signingSecret)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base))
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const expected = `v0=${hex}`
  return timingSafeEqual(expected, sig)
}

const OUTCOME_LABEL: Record<string, string> = {
  qualified: '✅ Qualified',
  unqualified: '❌ Unqualified',
  no_show: '🔁 No show',
}

async function slackApi(method: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const SIGNING_SECRET = Deno.env.get('SLACK_SIGNING_SECRET')
    if (!SIGNING_SECRET) throw new Error('SLACK_SIGNING_SECRET missing')
    const TOKEN = Deno.env.get('SLACK_BOT_TOKEN')
    if (!TOKEN) throw new Error('SLACK_BOT_TOKEN missing')

    const rawBody = await req.text()

    const valid = await verifySlackSignature(req, rawBody, SIGNING_SECRET)
    if (!valid) {
      console.error('Invalid Slack signature')
      return new Response('Invalid signature', { status: 401 })
    }

    // Slack sends application/x-www-form-urlencoded with `payload=<json>`
    const params = new URLSearchParams(rawBody)
    const payloadRaw = params.get('payload')
    if (!payloadRaw) return new Response('No payload', { status: 400 })
    const payload = JSON.parse(payloadRaw)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ---- Handle modal submission for Unqualified reason ----
    if (payload.type === 'view_submission' && payload.view?.callback_id === 'unqualified_reason_modal') {
      const meta = JSON.parse(payload.view.private_metadata || '{}') as {
        meetingId: string; channel: string; ts: string; userName?: string
      }
      const reason = payload.view.state?.values?.reason_block?.reason_input?.value?.trim() || ''
      if (!reason) {
        return new Response(JSON.stringify({
          response_action: 'errors',
          errors: { reason_block: 'Por favor escribe la razón del unqualified.' },
        }), { headers: { 'Content-Type': 'application/json' } })
      }

      const { data: meeting } = await supabase
        .from('meetings')
        .select('id, company_id, company_name, sdr')
        .eq('id', meta.meetingId)
        .maybeSingle()
      if (!meeting) return new Response('', { status: 200 })

      await supabase
        .from('meetings')
        .update({ outcome: 'unqualified', outcome_reason: reason })
        .eq('id', meeting.id)

      await supabase
        .from('companies')
        .update({ status: 'unqualified_post_meeting', unqualified_reason: reason })
        .eq('id', meeting.company_id)

      await supabase.from('activities').insert({
        type: 'meeting_outcome',
        company_id: meeting.company_id,
        company_name: meeting.company_name,
        sdr: meeting.sdr,
        to_status: 'unqualified',
      })

      // Edit original Slack message
      if (meta.channel && meta.ts) {
        const userName = meta.userName ?? payload.user?.name ?? 'el AE'
        const updatedBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:wave: *Validación de reunión*\n*Empresa:* ${meeting.company_name}\n\n*Resultado:* ${OUTCOME_LABEL.unqualified}\n*Razón:* ${reason}\n_Marcado por @${userName}_`,
            },
          },
        ]
        await slackApi('chat.update', {
          channel: meta.channel,
          ts: meta.ts,
          text: `Reunión con ${meeting.company_name}: ${OUTCOME_LABEL.unqualified}`,
          blocks: updatedBlocks,
        }, TOKEN)
      }

      return new Response('', { status: 200 })
    }

    // ---- Handle modal submission for Qualified deal ----
    if (payload.type === 'view_submission' && payload.view?.callback_id === 'qualified_deal_modal') {
      const meta = JSON.parse(payload.view.private_metadata || '{}') as {
        meetingId: string; channel: string; ts: string; userName?: string
      }
      const v = payload.view.state?.values ?? {}
      const event = v.event_block?.event_input?.selected_option?.value || null
      const valueStr = v.value_block?.value_input?.value?.trim() || ''
      const value = Number(valueStr)
      const expectedClose = v.close_block?.close_input?.selected_date || null
      const stageId = v.stage_block?.stage_input?.selected_option?.value || ''
      const taskTitle = v.task_block?.task_input?.value?.trim() || ''
      const taskDue = v.task_due_block?.task_due_input?.selected_date || null
      const selectedAe = v.ae_block?.ae_input?.selected_option?.value || null

      const errors: Record<string, string> = {}
      if (!valueStr || isNaN(value) || value < 0) errors.value_block = 'Ingresa un monto válido en USD.'
      if (!stageId) errors.stage_block = 'Selecciona un stage.'
      if (!taskTitle) errors.task_block = 'Escribe la tarea siguiente.'
      if (!taskDue) errors.task_due_block = 'Selecciona la fecha de la tarea.'
      if (Object.keys(errors).length > 0) {
        return new Response(JSON.stringify({ response_action: 'errors', errors }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const { data: meeting } = await supabase
        .from('meetings')
        .select('id, company_id, company_name, sdr, account_executive')
        .eq('id', meta.meetingId)
        .maybeSingle()
      if (!meeting) return new Response('', { status: 200 })

      // Confirm/override AE owner. If the AE marked qualified is different from the
      // one currently assigned to the meeting, update the meeting so dashboards stay aligned.
      const finalAe = selectedAe || meeting.account_executive
      const aeChanged = !!selectedAe && selectedAe !== meeting.account_executive
      const meetingPatch: Record<string, unknown> = { outcome: 'qualified' }
      if (aeChanged) meetingPatch.account_executive = finalAe
      await supabase.from('meetings').update(meetingPatch).eq('id', meeting.id)

      const { data: existing } = await supabase
        .from('deals')
        .select('id')
        .eq('meeting_id', meeting.id)
        .maybeSingle()

      if (!existing) {
        const { data: deal } = await supabase
          .from('deals')
          .insert({
            company_id: meeting.company_id,
            company_name: meeting.company_name,
            stage_id: stageId,
            account_executive: finalAe,
            sdr: meeting.sdr,
            meeting_id: meeting.id,
            value,
            currency: 'USD',
            event,
            expected_close_date: expectedClose,
            notes: '',
          })
          .select('id')
          .maybeSingle()
        if (deal?.id) {
          await supabase.from('deal_tasks').insert({
            deal_id: deal.id,
            title: taskTitle,
            due_at: new Date(`${taskDue}T09:00:00`).toISOString(),
            assignee: finalAe,
            completed: false,
          })
        }
      }

      await supabase.from('activities').insert({
        type: 'meeting_outcome',
        company_id: meeting.company_id,
        company_name: meeting.company_name,
        sdr: meeting.sdr,
        to_status: 'qualified',
      })

      if (meta.channel && meta.ts) {
        const userName = meta.userName ?? payload.user?.name ?? 'el AE'
        const fmtValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
        const updatedBlocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:wave: *Validación de reunión*\n*Empresa:* ${meeting.company_name}\n\n*Resultado:* ${OUTCOME_LABEL.qualified}\n*AE owner:* ${finalAe}${aeChanged ? ` _(antes: ${meeting.account_executive})_` : ''}\n*Monto:* ${fmtValue}${event ? `\n*Evento:* ${event}` : ''}${expectedClose ? `\n*Cierre estimado:* ${expectedClose}` : ''}\n*Tarea:* ${taskTitle} (${taskDue})\n_Marcado por @${userName}_`,
            },
          },
        ]
        await slackApi('chat.update', {
          channel: meta.channel,
          ts: meta.ts,
          text: `Reunión con ${meeting.company_name}: ${OUTCOME_LABEL.qualified}`,
          blocks: updatedBlocks,
        }, TOKEN)
      }

      return new Response('', { status: 200 })
    }

    if (payload.type !== 'block_actions') {
      return new Response('ignored', { status: 200 })
    }

    const action = payload.actions?.[0]
    if (!action) return new Response('no action', { status: 200 })

    const [outcomeRaw, meetingId] = String(action.value).split(':')
    const outcome = outcomeRaw as keyof typeof OUTCOME_LABEL
    if (!OUTCOME_LABEL[outcome] || !meetingId) {
      return new Response('bad action value', { status: 400 })
    }

    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, company_id, company_name, sdr, account_executive')
      .eq('id', meetingId)
      .maybeSingle()

    if (!meeting) return new Response('meeting not found', { status: 404 })

    // For Unqualified, open a modal to collect the reason instead of finalizing now.
    if (outcome === 'unqualified') {
      const triggerId = payload.trigger_id
      const channel = payload.channel?.id
      const ts = payload.message?.ts
      const userName = payload.user?.name ?? payload.user?.username ?? 'el AE'
      if (triggerId) {
        await slackApi('views.open', {
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: 'unqualified_reason_modal',
            private_metadata: JSON.stringify({ meetingId, channel, ts, userName }),
            title: { type: 'plain_text', text: 'Unqualified' },
            submit: { type: 'plain_text', text: 'Guardar' },
            close: { type: 'plain_text', text: 'Cancelar' },
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: `*Empresa:* ${meeting.company_name}` },
              },
              {
                type: 'input',
                block_id: 'reason_block',
                label: { type: 'plain_text', text: 'Razón del unqualified' },
                element: {
                  type: 'plain_text_input',
                  action_id: 'reason_input',
                  multiline: true,
                  placeholder: { type: 'plain_text', text: 'Ej: Fuera de ICP, sin presupuesto, competidor...' },
                },
              },
            ],
          },
        }, TOKEN)
      }
      return new Response('', { status: 200 })
    }

    // For Qualified, open a modal to collect deal fields before creating the deal.
    if (outcome === 'qualified') {
      const triggerId = payload.trigger_id
      const channel = payload.channel?.id
      const ts = payload.message?.ts
      const userName = payload.user?.name ?? payload.user?.username ?? 'el AE'

      const { data: stageRows } = await supabase
        .from('deal_stages')
        .select('id, name, "order", is_won, is_lost')
        .order('order', { ascending: true })
      const stageOptions = (stageRows ?? [])
        .filter((s: { is_lost: boolean }) => !s.is_lost)
        .map((s: { id: string; name: string }) => ({
          text: { type: 'plain_text', text: s.name },
          value: s.id,
        }))
      const firstStage = stageOptions[0]

      const eventOptions = [
        { text: { type: 'plain_text', text: 'CTW2026' }, value: 'CTW2026' },
        { text: { type: 'plain_text', text: 'AISummit2026' }, value: 'AISummit2026' },
        { text: { type: 'plain_text', text: 'AISummit2027' }, value: 'AISummit2027' },
        { text: { type: 'plain_text', text: 'GovTech' }, value: 'GovTech' },
      ]

      const aeNames = ['Nico', 'Majo', 'Santi', 'Toqui', 'Otro AE']
      const aeOptions = aeNames.map((n) => ({
        text: { type: 'plain_text', text: n },
        value: n,
      }))
      const currentAe = meeting.account_executive && aeNames.includes(meeting.account_executive)
        ? meeting.account_executive
        : 'Otro AE'
      const aeInitial = aeOptions.find((o) => o.value === currentAe) ?? aeOptions[aeOptions.length - 1]

      const today = new Date()
      const taskDefault = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      if (triggerId) {
        await slackApi('views.open', {
          trigger_id: triggerId,
          view: {
            type: 'modal',
            callback_id: 'qualified_deal_modal',
            private_metadata: JSON.stringify({ meetingId, channel, ts, userName }),
            title: { type: 'plain_text', text: 'Qualified — Deal' },
            submit: { type: 'plain_text', text: 'Crear deal' },
            close: { type: 'plain_text', text: 'Cancelar' },
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Deal:* ${meeting.company_name}\n*AE:* ${meeting.account_executive}${meeting.sdr ? `  •  *SDR:* ${meeting.sdr}` : ''}`,
                },
              },
              {
                type: 'input',
                block_id: 'ae_block',
                label: { type: 'plain_text', text: 'AE owner del deal' },
                element: {
                  type: 'static_select',
                  action_id: 'ae_input',
                  placeholder: { type: 'plain_text', text: 'Confirma el AE owner' },
                  options: aeOptions,
                  initial_option: aeInitial,
                },
              },
              {
                type: 'input',
                block_id: 'event_block',
                optional: true,
                label: { type: 'plain_text', text: 'Evento' },
                element: {
                  type: 'static_select',
                  action_id: 'event_input',
                  placeholder: { type: 'plain_text', text: 'Selecciona evento' },
                  options: eventOptions,
                },
              },
              {
                type: 'input',
                block_id: 'value_block',
                label: { type: 'plain_text', text: 'Monto (USD)' },
                element: {
                  type: 'plain_text_input',
                  action_id: 'value_input',
                  placeholder: { type: 'plain_text', text: 'Ej: 15000' },
                },
              },
              {
                type: 'input',
                block_id: 'close_block',
                optional: true,
                label: { type: 'plain_text', text: 'Fecha estimada de cierre' },
                element: { type: 'datepicker', action_id: 'close_input' },
              },
              {
                type: 'input',
                block_id: 'stage_block',
                label: { type: 'plain_text', text: 'Stage' },
                element: {
                  type: 'static_select',
                  action_id: 'stage_input',
                  placeholder: { type: 'plain_text', text: 'Selecciona stage' },
                  options: stageOptions,
                  ...(firstStage ? { initial_option: firstStage } : {}),
                },
              },
              {
                type: 'input',
                block_id: 'task_block',
                label: { type: 'plain_text', text: 'Tarea siguiente' },
                element: {
                  type: 'plain_text_input',
                  action_id: 'task_input',
                  placeholder: { type: 'plain_text', text: 'Ej: Enviar propuesta' },
                },
              },
              {
                type: 'input',
                block_id: 'task_due_block',
                label: { type: 'plain_text', text: 'Fecha de la tarea' },
                element: {
                  type: 'datepicker',
                  action_id: 'task_due_input',
                  initial_date: taskDefault,
                },
              },
            ],
          },
        }, TOKEN)
      }
      return new Response('', { status: 200 })
    }

    await supabase
      .from('meetings')
      .update({ outcome })
      .eq('id', meetingId)

    // Side effects per outcome
    if (outcome === 'no_show') {
      // Move company back to "reagendar" so SDR re-books it
      await supabase
        .from('companies')
        .update({ status: 'reagendar' })
        .eq('id', meeting.company_id)
    }

    // Log activity
    await supabase.from('activities').insert({
      type: 'meeting_outcome',
      company_id: meeting.company_id,
      company_name: meeting.company_name,
      sdr: meeting.sdr,
      to_status: outcome,
    })

    // Edit the original Slack message via chat.update
    const channel = payload.channel?.id
    const ts = payload.message?.ts
    const userName = payload.user?.name ?? payload.user?.username ?? 'el AE'
    if (channel && ts) {
      const updatedBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:wave: *Validación de reunión*\n*Empresa:* ${meeting.company_name}\n\n*Resultado:* ${OUTCOME_LABEL[outcome]}\n_Marcado por @${userName}_`,
          },
        },
      ]
      await fetch(`${SLACK_API}/chat.update`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel,
          ts,
          text: `Reunión con ${meeting.company_name}: ${OUTCOME_LABEL[outcome]}`,
          blocks: updatedBlocks,
        }),
      })
    }

    return new Response('', { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('slack-interactions error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})