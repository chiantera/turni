-- Schema iniziale: anagrafiche, vincoli e piani turni
-- Tutte le durate sono in minuti; tutte le date sono nel fuso Europe/Rome.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type ruolo_utente   as enum ('admin', 'pianificatore', 'lavoratore');
create type tipo_assenza   as enum ('ferie', 'malattia', 'permesso', 'l104', 'formazione', 'altro');
create type origine_vincolo as enum ('manuale', 'ai');
create type stato_piano    as enum ('bozza', 'pubblicato', 'archiviato');
create type origine_assegnazione as enum ('solver', 'manuale');
create type tipo_giorno    as enum ('feriale', 'sabato', 'festivo');
create type gravita_violazione as enum ('bloccante', 'avviso', 'info');

-- ---------------------------------------------------------------------------
-- Anagrafiche
-- ---------------------------------------------------------------------------
create table positions (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  descrizione text,
  colore      text not null default '#64748b',
  ordine      int  not null default 0,
  attiva      boolean not null default true,
  creato_il   timestamptz not null default now()
);
comment on table positions is 'Postazioni da coprire (le "m positions")';

create table workers (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null,
  cognome                text not null,
  email                  text unique,
  matricola              text unique,
  -- Monte ore contrattuale settimanale. 38h = 2 mattini + 2 pomeriggi + 1 notte.
  ore_settimanali        numeric(5,2) not null default 38,
  percentuale_part_time  int not null default 100 check (percentuale_part_time between 1 and 100),
  riposo_min_dopo_notte_h int not null default 48 check (riposo_min_dopo_notte_h between 11 and 96),
  max_giorni_consecutivi int not null default 6 check (max_giorni_consecutivi between 1 and 13),
  note                   text,
  attivo                 boolean not null default true,
  creato_il              timestamptz not null default now()
);
comment on table workers is 'Lavoratori (gli "n workers")';
comment on column workers.riposo_min_dopo_notte_h is
  'Riposo minimo dopo l''ultima notte di un blocco. Il ciclo canonico MMPPN+2 riposi ne produce 48.';

-- Abilitazioni: quale lavoratore può coprire quale postazione
create table worker_positions (
  worker_id   uuid not null references workers(id)   on delete cascade,
  position_id uuid not null references positions(id) on delete cascade,
  livello     int  not null default 1 check (livello between 1 and 3),
  primary key (worker_id, position_id)
);
comment on column worker_positions.livello is '1=base, 2=esperto, 3=referente';

-- ---------------------------------------------------------------------------
-- Tipi di turno (i 3 base + eventuali extra definiti dall''utente)
-- ---------------------------------------------------------------------------
create table shift_types (
  id                  uuid primary key default gen_random_uuid(),
  codice              text not null unique,
  nome                text not null,
  ora_inizio          time not null,
  ora_fine            time not null,
  durata_min          int  not null check (durata_min > 0),
  scavalca_mezzanotte boolean not null default false,
  is_notte            boolean not null default false,
  -- Ordine della rotazione in avanti: M(1) -> P(2) -> N(3).
  -- NULL per i turni extra che non partecipano alla rotazione.
  ordine_rotazione    int,
  conta_nelle_ore     boolean not null default true,
  peso_ore            numeric(4,2) not null default 1.0,
  colore              text not null default '#64748b',
  attivo              boolean not null default true,
  creato_il           timestamptz not null default now()
);
comment on table shift_types is 'Tipi di turno. I turni extra (semi-notte, spezzato, reperibilità) vivono qui.';
comment on column shift_types.peso_ore is
  'Moltiplicatore sulle ore contabilizzate. Es. reperibilità 0.25 = un''ora di reperibilità vale 15 min.';

-- ---------------------------------------------------------------------------
-- Fabbisogno di personale
-- ---------------------------------------------------------------------------
create table coverage_rules (
  id              uuid primary key default gen_random_uuid(),
  position_id     uuid not null references positions(id)   on delete cascade,
  shift_type_id   uuid not null references shift_types(id) on delete cascade,
  -- 0 = domenica ... 6 = sabato (coerente con Date.getDay())
  giorno_settimana int not null check (giorno_settimana between 0 and 6),
  tipo_giorno     tipo_giorno not null default 'feriale',
  n_richiesti     int not null default 1 check (n_richiesti >= 0),
  valido_dal      date,
  valido_al       date,
  unique (position_id, shift_type_id, giorno_settimana, tipo_giorno)
);
comment on table coverage_rules is
  'Quante persone servono per postazione/turno/giorno. Default di riferimento: 2 mattino, 2 pomeriggio, 1 notte.';

create table holidays (
  data       date primary key,
  nome       text not null,
  nazionale  boolean not null default true,
  -- Se true la giornata usa le coverage_rules con tipo_giorno='festivo'
  usa_copertura_festiva boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Assenze
-- ---------------------------------------------------------------------------
create table absences (
  id             uuid primary key default gen_random_uuid(),
  worker_id      uuid not null references workers(id) on delete cascade,
  dal            date not null,
  al             date not null,
  tipo           tipo_assenza not null default 'ferie',
  giornata_intera boolean not null default true,
  -- Valorizzato solo se giornata_intera = false (assenza su un turno specifico)
  shift_type_id  uuid references shift_types(id) on delete cascade,
  note           text,
  creato_il      timestamptz not null default now(),
  check (al >= dal),
  check (giornata_intera or shift_type_id is not null)
);
create index on absences (worker_id, dal, al);

-- ---------------------------------------------------------------------------
-- Vincoli (manuali o estratti dall'AI e confermati dall'utente)
-- ---------------------------------------------------------------------------
create table constraints (
  id              uuid primary key default gen_random_uuid(),
  origine         origine_vincolo not null default 'manuale',
  testo_originale text,
  kind            text not null,
  params          jsonb not null default '{}'::jsonb,
  is_hard         boolean not null default false,
  peso            numeric(6,2) not null default 1.0,
  descrizione     text not null,
  valido_dal      date,
  valido_al       date,
  attivo          boolean not null default true,
  creato_il       timestamptz not null default now()
);
comment on table constraints is
  'Vincoli in DSL chiuso. L''AI propone, l''utente conferma, il solver applica.';
create index on constraints (attivo, kind);

-- ---------------------------------------------------------------------------
-- Piani turni
-- ---------------------------------------------------------------------------
create table schedules (
  id          uuid primary key default gen_random_uuid(),
  -- Primo giorno del mese pianificato
  mese        date not null unique,
  stato       stato_piano not null default 'bozza',
  seed        bigint not null default 1,
  parametri   jsonb not null default '{}'::jsonb,
  punteggio   jsonb,
  creato_il   timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create table assignments (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references schedules(id)   on delete cascade,
  data          date not null,
  shift_type_id uuid not null references shift_types(id) on delete restrict,
  position_id   uuid not null references positions(id)   on delete restrict,
  worker_id     uuid not null references workers(id)     on delete restrict,
  bloccato      boolean not null default false,
  origine       origine_assegnazione not null default 'solver',
  -- Un lavoratore non può avere due turni nello stesso giorno: garantito dal DB,
  -- non solo dal solver.
  unique (schedule_id, data, worker_id)
);
create index on assignments (schedule_id, data);
create index on assignments (worker_id, data);

create table violations (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references schedules(id) on delete cascade,
  tipo         text not null,
  gravita      gravita_violazione not null default 'avviso',
  messaggio    text not null,
  data         date,
  worker_id    uuid references workers(id) on delete cascade,
  riferimenti  jsonb not null default '{}'::jsonb
);
create index on violations (schedule_id, gravita);

-- ---------------------------------------------------------------------------
-- Impostazioni globali e AI
-- ---------------------------------------------------------------------------
create table settings (
  chiave  text primary key,
  valore  jsonb not null,
  aggiornato_il timestamptz not null default now()
);

create table ai_interactions (
  id           uuid primary key default gen_random_uuid(),
  testo        text not null,
  risposta     jsonb,
  accettato    boolean not null default false,
  provider     text,
  modello      text,
  token_input  int,
  token_output int,
  latenza_ms   int,
  errore       text,
  creato_il    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profili utente
-- ---------------------------------------------------------------------------
create table profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text,
  ruolo     ruolo_utente not null default 'lavoratore',
  worker_id uuid references workers(id) on delete set null,
  creato_il timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
