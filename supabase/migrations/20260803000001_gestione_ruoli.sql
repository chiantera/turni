-- Chi può cambiare il ruolo di chi.
--
-- Prima di questa migrazione chiunque fosse registrato poteva promuoversi:
--
--   update profiles set ruolo = 'admin' where id = auth.uid();
--
-- La policy che lo consentiva si chiama "profilo aggiorna proprio nome", e il
-- nome dice l'intenzione — ma RLS filtra RIGHE, non colonne, e il ruolo
-- `authenticated` aveva il privilegio di UPDATE su tutte le colonne, `ruolo`
-- compresa. Verificato in transazione annullata: righe aggiornate 1, ruolo
-- risultante 'admin', partendo da 'lavoratore'.

-- --------------------------------------------------------------------------
-- Chi ha cambiato il ruolo, e quando. Due colonne al posto di una tabella di
-- audit: la degradazione di un amministratore deve lasciare una traccia.
-- --------------------------------------------------------------------------
alter table profiles add column if not exists ruolo_aggiornato_il timestamptz;
alter table profiles add column if not exists ruolo_aggiornato_da uuid references profiles(id) on delete set null;

comment on column profiles.ruolo_aggiornato_da is
  'Chi ha assegnato il ruolo attuale. Nullo per il primo amministratore.';

-- --------------------------------------------------------------------------
-- Il privilegio di UPDATE torna a coincidere con l'intenzione.
--
-- PostgreSQL non permette di revocare una colonna da un privilegio concesso a
-- livello di tabella: va tolto quello e riconcesso solo su ciò che è ammesso.
-- Da qui in poi `nome` è l'unica colonna che un utente può toccare da sé, e
-- `ruolo` si cambia solo passando da cambia_ruolo().
-- --------------------------------------------------------------------------
revoke update on profiles from authenticated;
revoke update on profiles from anon;
grant update (nome) on profiles to authenticated;

-- --------------------------------------------------------------------------
-- L'unica porta.
-- --------------------------------------------------------------------------
create or replace function public.cambia_ruolo(
  p_utente uuid,
  p_ruolo ruolo_utente
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  altri_admin int;
begin
  if public.ruolo_corrente() <> 'admin' then
    raise exception 'NON_AUTORIZZATO' using errcode = '42501';
  end if;

  -- Nessuno cambia il proprio ruolo. Una regola sola che chiude tre cose:
  -- niente autopromozione, niente amministratore che si chiude fuori per
  -- sbaglio, e soprattutto una rimozione è sempre la decisione di qualcun
  -- altro — che è l'unica versione con una responsabilità attribuibile.
  if p_utente = auth.uid() then
    raise exception 'RUOLO_PROPRIO' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_utente) then
    raise exception 'UTENTE_NON_TROVATO' using errcode = 'P0002';
  end if;

  -- Uno spazio senza amministratori non si recupera dall'applicazione.
  -- Il controllo sta qui e non nell'interfaccia: un vincolo che vive solo
  -- in un bottone non è un vincolo.
  if p_ruolo <> 'admin' then
    select count(*) into altri_admin
    from public.profiles
    where ruolo = 'admin' and id <> p_utente;

    if altri_admin = 0 then
      raise exception 'ULTIMO_ADMIN' using errcode = '23514';
    end if;
  end if;

  update public.profiles
  set ruolo = p_ruolo,
      ruolo_aggiornato_il = now(),
      ruolo_aggiornato_da = auth.uid()
  where id = p_utente;
end;
$$;

revoke all on function public.cambia_ruolo(uuid, ruolo_utente) from public;
grant execute on function public.cambia_ruolo(uuid, ruolo_utente) to authenticated;
