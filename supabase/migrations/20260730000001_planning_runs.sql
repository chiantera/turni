-- Piano come intervallo temporale: il mese resta solo una partizione di lettura.
create table planning_runs (
  id            uuid primary key default gen_random_uuid(),
  dal           date not null,
  al            date not null,
  stato         stato_piano not null default 'bozza',
  versione      bigint not null default 1,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (al >= dal),
  unique (dal, al)
);

comment on table planning_runs is
  'Unità logica di pianificazione. Un run può attraversare più mesi; i mesi non sono confini di transazione.';

alter table schedules add column planning_run_id uuid references planning_runs(id) on delete cascade;

insert into planning_runs (dal, al, stato, versione, creato_il, aggiornato_il)
select mese, (mese + interval '1 month - 1 day')::date, stato, 1, creato_il, aggiornato_il
from schedules
on conflict (dal, al) do nothing;

update schedules s
set planning_run_id = r.id
from planning_runs r
where r.dal = s.mese
  and r.al = (s.mese + interval '1 month - 1 day')::date;

alter table schedules alter column planning_run_id set not null;
alter table schedules drop constraint schedules_mese_key;
create unique index schedules_run_mese_key on schedules (planning_run_id, mese);
create index planning_runs_intervallo_idx on planning_runs (dal, al, aggiornato_il desc);

alter table planning_runs enable row level security;
create policy "planning runs lettura" on planning_runs
  to authenticated for select using (public.e_pianificatore() or stato = 'pubblicato');
create policy "planning runs scrittura" on planning_runs
  to authenticated for all using (public.e_pianificatore()) with check (public.e_pianificatore());

create or replace function public.applica_riduzione_ore(
  p_planning_run_id uuid,
  p_versione bigint,
  p_precondizioni jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_versione bigint;
  r jsonb;
  id_assegnazione uuid;
  cancellate integer := 0;
  righe integer;
begin
  if not public.e_pianificatore() then
    raise exception 'NON_AUTORIZZATO' using errcode = '42501';
  end if;

  select versione into run_versione
  from planning_runs
  where id = p_planning_run_id
  for update;

  if run_versione is null then
    raise exception 'PIANO_NON_TROVATO' using errcode = 'P0002';
  end if;
  if run_versione <> p_versione then
    raise exception 'PIANO_OBSOLETO' using errcode = '40001';
  end if;
  if jsonb_typeof(p_precondizioni) <> 'array' then
    raise exception 'PRECONDIZIONI_NON_VALIDE' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_precondizioni)
  loop
    select a.id into id_assegnazione
    from assignments a
    join schedules s on s.id = a.schedule_id
    join planning_runs pr on pr.id = s.planning_run_id
    where s.planning_run_id = p_planning_run_id
      and a.worker_id = (r->>'workerId')::uuid
      and a.data = (r->>'data')::date
      and a.data between pr.dal and pr.al
      and a.shift_type_id = (r->>'shiftTypeId')::uuid
      and a.position_id = (r->>'positionId')::uuid
      and a.bloccato = false;

    if id_assegnazione is null then
      raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = '40001';
    end if;

    delete from assignments where id = id_assegnazione;
    get diagnostics righe = row_count;
    cancellate := cancellate + righe;
  end loop;

  update planning_runs
  set versione = versione + 1, aggiornato_il = now()
  where id = p_planning_run_id;

  return cancellate;
end;
$$;

grant execute on function public.applica_riduzione_ore(uuid, bigint, jsonb) to authenticated;
revoke execute on function public.applica_riduzione_ore(uuid, bigint, jsonb) from public;

create or replace function public.salva_modifiche_intervallo(
  p_planning_run_id uuid,
  p_versione bigint,
  p_modifiche jsonb,
  p_precondizioni jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_versione bigint;
  m jsonb;
  pre jsonb;
  id_assegnazione uuid;
  id_schedule uuid;
  salvate integer := 0;
begin
  if not public.e_pianificatore() then
    raise exception 'NON_AUTORIZZATO' using errcode = '42501';
  end if;
  select versione into run_versione from planning_runs where id = p_planning_run_id for update;
  if run_versione is null then
    raise exception 'PIANO_NON_TROVATO' using errcode = 'P0002';
  end if;
  if run_versione <> p_versione then
    raise exception 'PIANO_OBSOLETO' using errcode = '40001';
  end if;
  if jsonb_typeof(p_modifiche) <> 'array' or jsonb_typeof(p_precondizioni) <> 'array' then
    raise exception 'MODIFICHE_NON_VALIDE' using errcode = '22023';
  end if;

  for m in select value from jsonb_array_elements(p_modifiche)
  loop
    select s.id into id_schedule
    from schedules s
    where s.planning_run_id = p_planning_run_id
      and s.mese = date_trunc('month', (m->>'data')::date)::date
      and (m->>'data')::date between (select dal from planning_runs where id = p_planning_run_id)
                              and (select al from planning_runs where id = p_planning_run_id);
    if id_schedule is null then
      raise exception 'CELLA_FUORI_INTERVALLO' using errcode = '40001';
    end if;

    select value into pre
    from jsonb_array_elements(p_precondizioni)
    where value->>'workerId' = m->>'workerId'
      and value->>'data' = m->>'data'
    limit 1;

    select a.id into id_assegnazione
    from assignments a
    where a.schedule_id = id_schedule
      and a.worker_id = (m->>'workerId')::uuid
      and a.data = (m->>'data')::date
    for update;

    if id_assegnazione is not null then
      if exists (select 1 from assignments a where a.id = id_assegnazione and a.bloccato) then
        raise exception 'ASSEGNAZIONE_BLOCCATA' using errcode = '40001';
      end if;
      if pre is not null and (
        (pre->>'shiftTypeId')::uuid is distinct from (select shift_type_id from assignments where id = id_assegnazione)
        or (pre->>'positionId')::uuid is distinct from (select position_id from assignments where id = id_assegnazione)
      ) then
        raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = '40001';
      end if;
    elsif pre is not null and ((pre->>'shiftTypeId') is not null or (pre->>'positionId') is not null) then
      raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = '40001';
    end if;

    if (m->>'shiftTypeId') is null or (m->>'positionId') is null then
      if id_assegnazione is not null then
        delete from assignments where id = id_assegnazione;
        salvate := salvate + 1;
      end if;
    else
      insert into assignments (schedule_id, data, worker_id, shift_type_id, position_id, bloccato, origine)
      values (id_schedule, (m->>'data')::date, (m->>'workerId')::uuid,
              (m->>'shiftTypeId')::uuid, (m->>'positionId')::uuid, false, 'manuale')
      on conflict (schedule_id, data, worker_id) do update set
        shift_type_id = excluded.shift_type_id,
        position_id = excluded.position_id,
        bloccato = false,
        origine = 'manuale';
      salvate := salvate + 1;
    end if;
  end loop;

  update planning_runs set versione = versione + 1, aggiornato_il = now()
  where id = p_planning_run_id;
  return salvate;
end;
$$;

grant execute on function public.salva_modifiche_intervallo(uuid, bigint, jsonb, jsonb) to authenticated;
revoke execute on function public.salva_modifiche_intervallo(uuid, bigint, jsonb, jsonb) from public;

create or replace function public.salva_piano_intervallo(
  p_dal date,
  p_al date,
  p_seme bigint,
  p_parametri jsonb,
  p_punteggio jsonb,
  p_assegnazioni jsonb,
  p_violazioni jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  run_id uuid;
  v_schedule_id uuid;
  mese date;
  segmento_al date;
  primo_mese date := date_trunc('month', p_dal)::date;
  v_schedule_ids jsonb := '[]'::jsonb;
begin
  if not public.e_pianificatore() then
    raise exception 'NON_AUTORIZZATO' using errcode = '42501';
  end if;
  if p_al < p_dal then
    raise exception 'INTERVALLO_NON_VALIDO' using errcode = '22023';
  end if;
  if jsonb_typeof(p_assegnazioni) <> 'array' or jsonb_typeof(p_violazioni) <> 'array' then
    raise exception 'DATI_PIANO_NON_VALIDI' using errcode = '22023';
  end if;

  update planning_runs
  set stato = 'archiviato', aggiornato_il = now()
  where not (dal = p_dal and al = p_al)
    and stato = 'bozza'
    and dal <= p_al
    and al >= p_dal;

  insert into planning_runs (dal, al, stato, versione, aggiornato_il)
  values (p_dal, p_al, 'bozza', 1, now())
  on conflict (dal, al) do update set
    stato = 'bozza',
    versione = planning_runs.versione + 1,
    aggiornato_il = now()
  returning id into run_id;

  for mese in
    select generate_series(primo_mese, date_trunc('month', p_al)::date, interval '1 month')::date
  loop
    segmento_al := least((mese + interval '1 month - 1 day')::date, p_al);
    insert into schedules (planning_run_id, mese, seed, parametri, punteggio, aggiornato_il)
    values (run_id, mese, p_seme, p_parametri, p_punteggio, now())
    on conflict (planning_run_id, mese) do update set
      seed = excluded.seed,
      parametri = excluded.parametri,
      punteggio = excluded.punteggio,
      aggiornato_il = excluded.aggiornato_il
    returning id into v_schedule_id;

    delete from assignments a
    where a.schedule_id = v_schedule_id
      and a.data between greatest(mese, p_dal) and segmento_al
      and not exists (
        select 1 from jsonb_array_elements(p_assegnazioni) x
        where (x->>'data')::date = a.data
          and (x->>'worker_id')::uuid = a.worker_id
      );

    insert into assignments (schedule_id, data, worker_id, shift_type_id, position_id, bloccato, origine)
    select v_schedule_id, x.data, x.worker_id, x.shift_type_id, x.position_id, x.bloccato,
           case when x.bloccato then 'manuale'::origine_assegnazione else 'solver'::origine_assegnazione end
    from jsonb_to_recordset(p_assegnazioni) as x(
      data date, worker_id uuid, shift_type_id uuid, position_id uuid, bloccato boolean
    )
    where x.data between greatest(mese, p_dal) and segmento_al
    on conflict (schedule_id, data, worker_id) do update set
      shift_type_id = excluded.shift_type_id,
      position_id = excluded.position_id,
      bloccato = excluded.bloccato,
      origine = excluded.origine;

    delete from violations v
    where v.schedule_id = v_schedule_id
      and ((v.data is not null and v.data between greatest(mese, p_dal) and segmento_al)
        or (v.data is null and mese = primo_mese));

    insert into violations (schedule_id, tipo, gravita, messaggio, data, riferimenti)
    select v_schedule_id, x.tipo, x.gravita::gravita_violazione, x.messaggio, x.data,
           coalesce(x.riferimenti, '{}'::jsonb) || jsonb_build_object('intervallo', jsonb_build_object('dal', p_dal, 'al', p_al))
    from jsonb_to_recordset(p_violazioni) as x(
      tipo text, gravita text, messaggio text, data date, riferimenti jsonb
    )
    where (x.data is not null and x.data between greatest(mese, p_dal) and segmento_al)
       or (x.data is null and mese = primo_mese);

    v_schedule_ids := v_schedule_ids || jsonb_build_array(v_schedule_id);
  end loop;

  return jsonb_build_object('planningRunId', run_id, 'scheduleIds', v_schedule_ids);
end;
$$;

grant execute on function public.salva_piano_intervallo(date, date, bigint, jsonb, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.salva_piano_intervallo(date, date, bigint, jsonb, jsonb, jsonb, jsonb) from public;
