-- Recuperata dallo schema in produzione il 19 agosto 2026.
--
-- Seconda delle tre migrazioni che esistevano solo nel registro remoto. Il
-- testo non era piu' leggibile dal registro, quindi e' ricostruita dalla
-- definizione viva della funzione e del trigger (`pg_get_functiondef`,
-- `pg_get_triggerdef`) — che e' comunque la fonte piu' attendibile delle due.
--
-- Perche' conta: `20260728000001_schema_iniziale.sql` crea una versione
-- PRECEDENTE di questa funzione, senza il bootstrap. Un repository ricostruito
-- da zero produceva un database in cui il primo utente registrato nasce
-- 'lavoratore', le policy RLS danno scrittura solo ad admin e pianificatore, e
-- non esiste nessuno che possa promuovere qualcuno: applicazione inutilizzabile
-- appena installata.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  primo boolean;
begin
  select not exists (select 1 from public.profiles) into primo;

  insert into public.profiles (id, nome, ruolo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    case when primo then 'admin'::public.ruolo_utente
         else 'lavoratore'::public.ruolo_utente end
  );
  return new;
end;
$$;

-- Il trigger esiste gia' da `schema_iniziale`: `create or replace` sopra basta,
-- e ricrearlo qui fallirebbe. Lasciato scritto perche' e' la prima cosa che si
-- cerca leggendo questa migrazione.
