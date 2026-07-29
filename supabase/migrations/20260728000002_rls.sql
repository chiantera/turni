-- Row Level Security.
--
-- Due livelli di accesso:
--   admin / pianificatore -> CRUD completo su tutto
--   lavoratore            -> sola lettura delle anagrafiche e dei PROPRI turni
--                            su piani pubblicati
--
-- Le funzioni helper sono SECURITY DEFINER con search_path vuoto: senza questo
-- una policy su `profiles` che interroga `profiles` va in ricorsione infinita.

create or replace function public.ruolo_corrente()
returns public.ruolo_utente
language sql
stable
security definer
set search_path = ''
as $$
  select ruolo from public.profiles where id = auth.uid();
$$;

create or replace function public.e_pianificatore()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ruolo in ('admin', 'pianificatore') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Il worker_id collegato all'utente corrente (null se non collegato)
create or replace function public.worker_corrente()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select worker_id from public.profiles where id = auth.uid();
$$;

alter table positions        enable row level security;
alter table workers          enable row level security;
alter table worker_positions enable row level security;
alter table shift_types      enable row level security;
alter table coverage_rules   enable row level security;
alter table holidays         enable row level security;
alter table absences         enable row level security;
alter table constraints      enable row level security;
alter table schedules        enable row level security;
alter table assignments      enable row level security;
alter table violations       enable row level security;
alter table settings         enable row level security;
alter table ai_interactions  enable row level security;
alter table profiles         enable row level security;

-- --- Anagrafiche: lettura per tutti gli autenticati, scrittura ai pianificatori
do $$
declare t text;
begin
  foreach t in array array['positions','workers','worker_positions','shift_types',
                           'coverage_rules','holidays','settings']
  loop
    execute format(
      'create policy "lettura autenticati" on %I for select to authenticated using (true)', t);
    execute format(
      'create policy "scrittura pianificatori" on %I for all to authenticated
         using (public.e_pianificatore()) with check (public.e_pianificatore())', t);
  end loop;
end $$;

-- --- Vincoli e interazioni AI: solo pianificatori
create policy "vincoli pianificatori" on constraints
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

create policy "ai pianificatori" on ai_interactions
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

-- --- Assenze: il lavoratore vede le proprie, il pianificatore tutte
create policy "assenze lettura" on absences
  for select to authenticated
  using (public.e_pianificatore() or worker_id = public.worker_corrente());

create policy "assenze scrittura" on absences
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

-- --- Piani: il lavoratore vede solo quelli pubblicati
create policy "piani lettura" on schedules
  for select to authenticated
  using (public.e_pianificatore() or stato = 'pubblicato');

create policy "piani scrittura" on schedules
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

-- --- Assegnazioni: il lavoratore vede SOLO le proprie e SOLO se pubblicate
create policy "assegnazioni lettura" on assignments
  for select to authenticated
  using (
    public.e_pianificatore()
    or (
      worker_id = public.worker_corrente()
      and exists (
        select 1 from schedules s
        where s.id = assignments.schedule_id and s.stato = 'pubblicato'
      )
    )
  );

create policy "assegnazioni scrittura" on assignments
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

-- --- Violazioni: solo pianificatori (sono diagnostica interna)
create policy "violazioni pianificatori" on violations
  for all to authenticated
  using (public.e_pianificatore()) with check (public.e_pianificatore());

-- --- Profili: ognuno legge il proprio, il pianificatore li legge tutti
create policy "profilo proprio" on profiles
  for select to authenticated
  using (id = auth.uid() or public.e_pianificatore());

create policy "profilo aggiorna proprio nome" on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profili admin" on profiles
  for all to authenticated
  using (public.ruolo_corrente() = 'admin')
  with check (public.ruolo_corrente() = 'admin');
