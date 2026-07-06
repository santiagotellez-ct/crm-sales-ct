CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('sdr', 'ae', 'secondary_ae')),
  email text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE TO authenticated USING (true);

INSERT INTO public.team_members (name, role, display_order) VALUES
  ('César',    'sdr', 0),
  ('Jissad',   'sdr', 1),
  ('Juan',     'sdr', 2),
  ('Dani',     'sdr', 3),
  ('Majo',     'sdr', 4),
  ('Self AE',  'sdr', 5);

INSERT INTO public.team_members (name, role, email, display_order) VALUES
  ('Nico',     'ae', 'nicolas@colombiatechweek.co',  0),
  ('Majo',     'ae', 'mariajose@colombiatechweek.co', 1),
  ('Santi',    'ae', 'santiago@colombiatechweek.co',  2),
  ('Toqui',    'ae', 'juan@colombiatechweek.co',      3),
  ('Otro AE',  'ae', '',                              4);

INSERT INTO public.team_members (name, role, display_order) VALUES
  ('Nath',           'secondary_ae', 0),
  ('Liz',            'secondary_ae', 1),
  ('Lau',            'secondary_ae', 2),
  ('Fernando',       'secondary_ae', 3),
  ('Carlos Alberto', 'secondary_ae', 4);
