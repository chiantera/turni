-- Gli errori di dominio non devono usare lo SQLSTATE 40001.
--
-- 40001 è `serialization_failure`: in Postgres non è un'etichetta, è un
-- protocollo. Significa «ho fallito per un conflitto di concorrenza, ritenta e
-- probabilmente riuscirai», ed è il segnale su cui si appoggiano gli
-- automatismi di ritentativo di tutto lo stack a valle.
--
-- Qui marcava invece cinque regole permanenti: un'assegnazione bloccata resta
-- bloccata anche al milionesimo tentativo. Il risultato, fra il 4 e il 9 agosto
-- 2026: un client ha letto «riprova», ha riprovato, e non ha più smesso.
-- 135.409.553 transazioni abortite contro 498.542 riuscite — 271 fallimenti per
-- ogni successo — a un ritmo misurato di 357 al secondo. Il database ha
-- registrato circa 31 milioni di errori al giorno per cinque giorni.
--
-- P0001 è il codice che Postgres assegna di sua iniziativa a `raise exception`:
-- «errore definito dall'applicazione». Nessuno lo ritenta. Il nome simbolico
-- del messaggio resta il discriminante per il codice chiamante, che è già il
-- modo in cui queste funzioni comunicano da sempre.
--
-- PIANO_OBSOLETO e PRECONDIZIONE_NON_SODDISFATTA restano dei conflitti veri e
-- l'API continua a rispondere 409: ma è una scelta del nostro route handler,
-- non una promessa fatta al database che qualcuno interpreterà come «ritenta».

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
    raise exception 'PIANO_OBSOLETO' using errcode = 'P0001';
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
      raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = 'P0001';
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
    raise exception 'PIANO_OBSOLETO' using errcode = 'P0001';
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
      raise exception 'CELLA_FUORI_INTERVALLO' using errcode = 'P0001';
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
        raise exception 'ASSEGNAZIONE_BLOCCATA' using errcode = 'P0001';
      end if;
      if pre is not null and (
        (pre->>'shiftTypeId')::uuid is distinct from (select shift_type_id from assignments where id = id_assegnazione)
        or (pre->>'positionId')::uuid is distinct from (select position_id from assignments where id = id_assegnazione)
      ) then
        raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = 'P0001';
      end if;
    elsif pre is not null and ((pre->>'shiftTypeId') is not null or (pre->>'positionId') is not null) then
      raise exception 'PRECONDIZIONE_NON_SODDISFATTA' using errcode = 'P0001';
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
