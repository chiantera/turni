-- Iscrizioni alla newsletter raccolte dalla landing page.
--
-- Chi si iscrive non ha una sessione: la landing è pubblica. La via ovvia
-- sarebbe una policy di insert per il ruolo anon, ma renderebbe la tabella
-- scrivibile da chiunque conosca l'URL del progetto e la chiave pubblicabile
-- — che sta nel bundle del browser, quindi da chiunque. Qui invece la tabella
-- non ha alcuna policy di scrittura e l'unico ingresso è una funzione security
-- definer che valida, normalizza e non dice nulla a chi la chiama.

create table newsletter_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  -- Doppio opt-in: finché resta false non va inviata alcuna comunicazione.
  -- Il consenso raccolto da un campo di testo non è ancora un consenso provato.
  confermata    boolean not null default false,
  confermata_il timestamptz,
  origine       text not null default 'landing',
  creato_il     timestamptz not null default now()
);

comment on table newsletter_subscriptions is
  'Iscrizioni newsletter dalla landing. Scrivibile solo via iscrivi_newsletter().';
comment on column newsletter_subscriptions.confermata is
  'false finché l''indirizzo non ha confermato: nessun invio prima di allora.';
comment on column newsletter_subscriptions.origine is
  'Da dove arriva l''iscrizione, per sapere cosa converte.';

create index on newsletter_subscriptions (creato_il desc);

alter table newsletter_subscriptions enable row level security;

-- Lettura ai soli pianificatori. Nessuna policy di scrittura, di proposito.
create policy "newsletter lettura pianificatori" on newsletter_subscriptions
  for select to authenticated
  using (public.e_pianificatore());

create or replace function public.iscrivi_newsletter(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_pulita text;
begin
  email_pulita := lower(trim(p_email));

  if length(email_pulita) > 254 then
    raise exception 'EMAIL_NON_VALIDA' using errcode = '22023';
  end if;
  if email_pulita !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'EMAIL_NON_VALIDA' using errcode = '22023';
  end if;

  -- Iscriversi due volte non è un errore, ed è importante che non lo sembri:
  -- una risposta diversa per un indirizzo già presente direbbe a un estraneo
  -- chi è iscritto e chi no.
  insert into public.newsletter_subscriptions (email)
  values (email_pulita)
  on conflict (email) do nothing;
end;
$$;

revoke all on function public.iscrivi_newsletter(text) from public;
grant execute on function public.iscrivi_newsletter(text) to anon, authenticated;
