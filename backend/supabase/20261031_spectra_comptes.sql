-- NOXEL SPECTRA — comptes, forfaits et crédits de dessin IA
-- Même projet Supabase que NOXEL SEO et NOXEL FORGE : users, magic_links, passkeys et passkey_challenges
-- existent déjà et sont réutilisés tels quels. users.tier reste le forfait de NOXEL SEO : le forfait
-- SPECTRA est dans spectra_members.tier.
-- À exécuter une fois dans l'éditeur SQL de Supabase AVANT de déployer le backend.

CREATE TABLE IF NOT EXISTS public.spectra_members (
  user_id                uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tier                   text NOT NULL DEFAULT 'bronze'
                         CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  subscription_status    text,
  credits_period         text,                       -- mois des crédits inclus, 'YYYY-MM' (UTC)
  credits_used           integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  credits_extra          integer NOT NULL DEFAULT 0 CHECK (credits_extra >= 0),  -- crédits achetés, sans date limite
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Journal des crédits : achats (stripe_session_id unique = jamais crédité deux fois), dépenses, remises
CREATE TABLE IF NOT EXISTS public.spectra_credit_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta              integer NOT NULL,
  source             text NOT NULL CHECK (source IN ('achat', 'depense', 'remise')),
  stripe_session_id  text UNIQUE,
  detail             text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spectra_credit_events_user_idx ON public.spectra_credit_events (user_id, created_at DESC);

ALTER TABLE public.spectra_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spectra_credit_events ENABLE ROW LEVEL SECURITY;
-- Aucune politique : seul le backend (clé service) lit et écrit.

-- Dépense d'un crédit, atomique : d'abord les crédits inclus du mois, sinon les crédits achetés.
-- Renvoie 'inclus', 'achete' ou NULL (plus de crédits). Remet le compteur mensuel à zéro au changement de mois.
CREATE OR REPLACE FUNCTION public.spectra_depenser_credit(p_user uuid, p_inclus integer, p_cout integer DEFAULT 1)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m public.spectra_members%ROWTYPE;
  periode text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
BEGIN
  SELECT * INTO m FROM public.spectra_members WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF m.credits_period IS DISTINCT FROM periode THEN
    m.credits_used := 0;
    UPDATE public.spectra_members SET credits_period = periode, credits_used = 0 WHERE user_id = p_user;
  END IF;
  IF m.credits_used + p_cout <= p_inclus THEN
    UPDATE public.spectra_members SET credits_used = credits_used + p_cout, updated_at = now() WHERE user_id = p_user;
    INSERT INTO public.spectra_credit_events (user_id, delta, source, detail) VALUES (p_user, -p_cout, 'depense', 'inclus');
    RETURN 'inclus';
  ELSIF m.credits_extra >= p_cout THEN
    UPDATE public.spectra_members SET credits_extra = credits_extra - p_cout, updated_at = now() WHERE user_id = p_user;
    INSERT INTO public.spectra_credit_events (user_id, delta, source, detail) VALUES (p_user, -p_cout, 'depense', 'achete');
    RETURN 'achete';
  END IF;
  RETURN NULL;
END $$;

-- Remise d'un crédit quand la génération échoue (même réserve que celle d'où il venait)
CREATE OR REPLACE FUNCTION public.spectra_rendre_credit(p_user uuid, p_reserve text, p_cout integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_reserve = 'inclus' THEN
    UPDATE public.spectra_members SET credits_used = GREATEST(0, credits_used - p_cout), updated_at = now() WHERE user_id = p_user;
  ELSIF p_reserve = 'achete' THEN
    UPDATE public.spectra_members SET credits_extra = credits_extra + p_cout, updated_at = now() WHERE user_id = p_user;
  ELSE
    RETURN;
  END IF;
  INSERT INTO public.spectra_credit_events (user_id, delta, source, detail) VALUES (p_user, p_cout, 'remise', p_reserve);
END $$;

-- Achat de crédits, une seule fois par session Stripe Checkout
CREATE OR REPLACE FUNCTION public.spectra_ajouter_credits(p_user uuid, p_credits integer, p_session text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.spectra_credit_events (user_id, delta, source, stripe_session_id, detail)
    VALUES (p_user, p_credits, 'achat', p_session, 'stripe');
  INSERT INTO public.spectra_members (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.spectra_members SET credits_extra = credits_extra + p_credits, updated_at = now() WHERE user_id = p_user;
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;  -- session déjà créditée (webhook rejoué)
END $$;

REVOKE ALL ON FUNCTION public.spectra_depenser_credit(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spectra_rendre_credit(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spectra_ajouter_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;

SELECT
  to_regclass('public.spectra_members') IS NOT NULL       AS membres_ok,
  to_regclass('public.spectra_credit_events') IS NOT NULL AS credits_ok,
  to_regprocedure('public.spectra_depenser_credit(uuid,integer,integer)') IS NOT NULL AS fonctions_ok;
