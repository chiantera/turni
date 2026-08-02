-- RLS già impedisce ad anon di toccare newsletter_subscriptions: la tabella non
-- ha policy di scrittura e quella di lettura è riservata ai pianificatori. Ma i
-- privilegi di default di Supabase concedono comunque ad anon i permessi sulla
-- tabella, quindi l'unica barriera sarebbe la policy.
--
-- Verificato prima di questa migrazione: has_table_privilege('anon', ...) dava
-- true sia per insert sia per select, e la richiesta REST come anon rispondeva
-- 200. Dopo la revoca risponde 401 (42501), che è ciò che deve fare — l'unica
-- via prevista verso questa tabella è iscrivi_newsletter().
revoke all on table public.newsletter_subscriptions from anon;
