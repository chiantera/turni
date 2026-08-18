-- Recuperata dal registro remoto il 19 agosto 2026.
--
-- Questa migrazione era applicata in produzione dal 28 luglio ma il suo SQL
-- non e' mai esistito in questo repository: era una delle tre che rendevano
-- impossibile ricostruire la produzione da zero. Il testo qui sotto e' quello
-- realmente eseguito, letto da `supabase_migrations.schema_migrations`.
--
-- Chiarisce la risoluzione delle regole di copertura.
--
--   tipo_giorno = 'feriale' -> regola normale, giorno_settimana OBBLIGATORIO (0-6)
--   tipo_giorno = 'festivo' -> override per le festività, giorno_settimana NULL
--
-- Risoluzione: se la data è in `holidays` con usa_copertura_festiva si cerca
-- prima la regola 'festivo'; altrimenti quella del giorno della settimana.

alter type tipo_giorno rename to tipo_giorno_old;
create type tipo_giorno as enum ('feriale', 'festivo');

alter table coverage_rules
  drop constraint coverage_rules_position_id_shift_type_id_giorno_settimana_t_key;

alter table coverage_rules
  alter column tipo_giorno drop default,
  alter column tipo_giorno type tipo_giorno using tipo_giorno::text::tipo_giorno,
  alter column tipo_giorno set default 'feriale',
  alter column giorno_settimana drop not null;

drop type tipo_giorno_old;

alter table coverage_rules
  add constraint coverage_giorno_coerente check (
    (tipo_giorno = 'feriale' and giorno_settimana is not null)
    or
    (tipo_giorno = 'festivo' and giorno_settimana is null)
  );

-- `nulls not distinct`: al massimo UNA regola festiva per postazione e turno.
-- E' cio' che rende impossibile configurare sette righe festive dove il solver
-- ne legge una sola — schema e codice si tengono, e non e' un caso.
create unique index coverage_rules_chiave
  on coverage_rules (position_id, shift_type_id, giorno_settimana, tipo_giorno)
  nulls not distinct;
