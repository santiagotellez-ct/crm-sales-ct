ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS meeting_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS slack_channel_id text,
  ADD COLUMN IF NOT EXISTS slack_message_ts text;

-- Backfill: si no hay end, asumir 30 min después del scheduled
UPDATE public.meetings 
  SET meeting_ends_at = scheduled_at + interval '30 minutes' 
  WHERE meeting_ends_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_pending_validation 
  ON public.meetings (meeting_ends_at) 
  WHERE slack_prompt_sent_at IS NULL AND outcome IS NULL;