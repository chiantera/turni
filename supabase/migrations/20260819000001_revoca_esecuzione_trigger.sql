-- `handle_new_user` e' una funzione di trigger, non un endpoint.
--
-- Sta nello schema `public`, quindi PostgREST la espone come
-- `/rest/v1/rpc/handle_new_user` e chiunque, anche senza sessione, puo'
-- chiamarla: e' uno dei rilievi del linter Supabase. Il trigger continua a
-- funzionare — scatta su `auth.users`, per mano del servizio di autenticazione,
-- ed e' `security definer`, quindi gira come il proprietario a prescindere dai
-- privilegi di chi ha causato l'INSERT.
--
-- Le altre funzioni segnalate dal linter restano com'erano ed e' voluto:
-- `e_pianificatore`, `ruolo_corrente` e `worker_corrente` leggono l'identita'
-- di chi chiama e servono proprio alle policy RLS; `cambia_ruolo` verifica di
-- suo che il chiamante sia admin, vieta di modificare il proprio ruolo e vieta
-- di rimuovere l'ultimo admin.

revoke execute on function public.handle_new_user() from anon, authenticated;
