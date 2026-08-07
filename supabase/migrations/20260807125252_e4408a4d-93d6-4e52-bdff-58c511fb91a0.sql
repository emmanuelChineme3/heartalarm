CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  deep_link text,
  audience text NOT NULL DEFAULT 'all',
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  push_sent integer NOT NULL DEFAULT 0,
  push_failed integer NOT NULL DEFAULT 0,
  email_sent integer NOT NULL DEFAULT 0,
  email_failed integer NOT NULL DEFAULT 0,
  email_status text NOT NULL DEFAULT 'pending',
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broadcasts" ON public.broadcasts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create broadcasts" ON public.broadcasts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY "Admins can update broadcasts" ON public.broadcasts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete broadcasts" ON public.broadcasts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX broadcasts_status_scheduled_idx ON public.broadcasts (status, scheduled_at);

CREATE TABLE public.legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_version text NOT NULL,
  privacy_policy_version text NOT NULL,
  terms_version text NOT NULL,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.legal_consents TO authenticated;
GRANT ALL ON public.legal_consents TO service_role;
ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record their own consent" ON public.legal_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own consent" ON public.legal_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX legal_consents_user_version_idx ON public.legal_consents (user_id, document_version);