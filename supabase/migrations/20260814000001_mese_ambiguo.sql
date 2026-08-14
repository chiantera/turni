-- La generazione di un piano falliva sempre con
--   42702: column reference "mese" is ambiguous
--
-- `salva_piano_intervallo` dichiarava una variabile plpgsql chiamata `mese`,
-- e `schedules` ha una colonna chiamata `mese`. Nella lista `values` questo non
-- dà fastidio — le colonne della destinazione non sono in scope, quindi `mese`
-- può essere solo la variabile. Ma la clausola di inferenza `on conflict (...)`
-- nomina per forza colonne della tabella di destinazione: lì i due candidati
-- coesistono e, con il default `plpgsql.variable_conflict = error`, Postgres
-- si rifiuta di scegliere.
--
-- plpgsql compila le istruzioni SQL alla prima esecuzione, non a
-- `create function`: la migrazione originale si è applicata senza un errore e
-- il difetto è rimasto invisibile fino al primo clic su «Genera il piano».
-- Nessun piano è mai stato salvato da questa funzione — le uniche righe in
-- `schedules` sono quelle del seed dimostrativo del 30 luglio 2026.
--
-- La cura è dare alla variabile un nome che nessuna colonna possa avere, come
-- già fanno `v_schedule_id` e `v_schedule_ids` nella stessa funzione.

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
  v_mese date;
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

  for v_mese in
    select generate_series(primo_mese, date_trunc('month', p_al)::date, interval '1 month')::date
  loop
    segmento_al := least((v_mese + interval '1 month - 1 day')::date, p_al);
    insert into schedules (planning_run_id, mese, seed, parametri, punteggio, aggiornato_il)
    values (run_id, v_mese, p_seme, p_parametri, p_punteggio, now())
    on conflict (planning_run_id, mese) do update set
      seed = excluded.seed,
      parametri = excluded.parametri,
      punteggio = excluded.punteggio,
      aggiornato_il = excluded.aggiornato_il
    returning id into v_schedule_id;

    delete from assignments a
    where a.schedule_id = v_schedule_id
      and a.data between greatest(v_mese, p_dal) and segmento_al
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
    where x.data between greatest(v_mese, p_dal) and segmento_al
    on conflict (schedule_id, data, worker_id) do update set
      shift_type_id = excluded.shift_type_id,
      position_id = excluded.position_id,
      bloccato = excluded.bloccato,
      origine = excluded.origine;

    delete from violations v
    where v.schedule_id = v_schedule_id
      and ((v.data is not null and v.data between greatest(v_mese, p_dal) and segmento_al)
        or (v.data is null and v_mese = primo_mese));

    insert into violations (schedule_id, tipo, gravita, messaggio, data, riferimenti)
    select v_schedule_id, x.tipo, x.gravita::gravita_violazione, x.messaggio, x.data,
           coalesce(x.riferimenti, '{}'::jsonb) || jsonb_build_object('intervallo', jsonb_build_object('dal', p_dal, 'al', p_al))
    from jsonb_to_recordset(p_violazioni) as x(
      tipo text, gravita text, messaggio text, data date, riferimenti jsonb
    )
    where (x.data is not null and x.data between greatest(v_mese, p_dal) and segmento_al)
       or (x.data is null and v_mese = primo_mese);

    v_schedule_ids := v_schedule_ids || jsonb_build_array(v_schedule_id);
  end loop;

  return jsonb_build_object('planningRunId', run_id, 'scheduleIds', v_schedule_ids);
end;
$$;

grant execute on function public.salva_piano_intervallo(date, date, bigint, jsonb, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.salva_piano_intervallo(date, date, bigint, jsonb, jsonb, jsonb, jsonb) from public;
