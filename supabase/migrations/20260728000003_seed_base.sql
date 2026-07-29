-- Seed di base: tipi di turno, festività italiane, impostazioni globali.
-- Non contiene dati dimostrativi (quelli stanno nella migrazione successiva).

-- ---------------------------------------------------------------------------
-- I 3 turni base. Durate 7h / 7h / 10h: il ciclo settimanale
--   M M P P N R R  =  2x7 + 2x7 + 1x10  =  38 ore esatte
-- e la notte finisce alle 07:00 seguita da 2 riposi = 48h di stacco.
-- ---------------------------------------------------------------------------
insert into shift_types
  (codice, nome, ora_inizio, ora_fine, durata_min, scavalca_mezzanotte, is_notte, ordine_rotazione, colore)
values
  ('M', 'Mattino',    '07:00', '14:00',  420, false, false, 1, '#fbbf24'),
  ('P', 'Pomeriggio', '14:00', '21:00',  420, false, false, 2, '#38bdf8'),
  ('N', 'Notte',      '21:00', '07:00',  600, true,  true,  3, '#6366f1');

-- ---------------------------------------------------------------------------
-- Festività nazionali italiane 2026-2028.
-- Pasqua: 5 apr 2026, 28 mar 2027, 16 apr 2028 (il Lunedì dell'Angelo segue).
-- ---------------------------------------------------------------------------
insert into holidays (data, nome) values
  ('2026-01-01', 'Capodanno'),
  ('2026-01-06', 'Epifania'),
  ('2026-04-06', 'Lunedì dell''Angelo'),
  ('2026-04-25', 'Festa della Liberazione'),
  ('2026-05-01', 'Festa del Lavoro'),
  ('2026-06-02', 'Festa della Repubblica'),
  ('2026-08-15', 'Ferragosto'),
  ('2026-11-01', 'Ognissanti'),
  ('2026-12-08', 'Immacolata Concezione'),
  ('2026-12-25', 'Natale'),
  ('2026-12-26', 'Santo Stefano'),
  ('2027-01-01', 'Capodanno'),
  ('2027-01-06', 'Epifania'),
  ('2027-03-29', 'Lunedì dell''Angelo'),
  ('2027-04-25', 'Festa della Liberazione'),
  ('2027-05-01', 'Festa del Lavoro'),
  ('2027-06-02', 'Festa della Repubblica'),
  ('2027-08-15', 'Ferragosto'),
  ('2027-11-01', 'Ognissanti'),
  ('2027-12-08', 'Immacolata Concezione'),
  ('2027-12-25', 'Natale'),
  ('2027-12-26', 'Santo Stefano'),
  ('2028-01-01', 'Capodanno'),
  ('2028-01-06', 'Epifania'),
  ('2028-04-17', 'Lunedì dell''Angelo'),
  ('2028-04-25', 'Festa della Liberazione'),
  ('2028-05-01', 'Festa del Lavoro'),
  ('2028-06-02', 'Festa della Repubblica'),
  ('2028-08-15', 'Ferragosto'),
  ('2028-11-01', 'Ognissanti'),
  ('2028-12-08', 'Immacolata Concezione'),
  ('2028-12-25', 'Natale'),
  ('2028-12-26', 'Santo Stefano');

-- ---------------------------------------------------------------------------
-- Impostazioni globali
-- ---------------------------------------------------------------------------
insert into settings (chiave, valore) values
  -- Vincoli di legge / contratto (D.Lgs 66/2003)
  ('regole', jsonb_build_object(
      'riposo_min_ore',           11,   -- art. 7: riposo giornaliero
      'riposo_dopo_notte_ore',    48,   -- richiesta utente: 24-48h, default 48
      'max_giorni_consecutivi',    6,   -- art. 9: 24h di riposo ogni 7 giorni
      'max_ore_settimana',        48,   -- art. 4: media sul periodo di riferimento
      'ore_settimanali_default',  38
  )),
  -- Pesi dei vincoli morbidi: alzarli rende quel criterio più importante.
  ('pesi', jsonb_build_object(
      'ore_target',            100,  -- scostamento dalle 38h
      'pattern_settimanale',    60,  -- aderenza al ciclo M M P P N R R
      'rotazione_avanti',       40,  -- M->P->N premiato, all'indietro penalizzato
      'equita_notti',           30,
      'equita_weekend',         25,
      'equita_ore',             20,
      'stabilita_postazione',   15,
      'giorno_isolato',         35,  -- un solo giorno di lavoro tra due riposi
      'riposo_isolato',         25,  -- un solo riposo dentro una serie di lavoro
      'preferenze',             50   -- peso base delle preferenze soft
  )),
  ('solver', jsonb_build_object(
      'tempo_max_ms',   10000,
      'seed',               1,
      'giorni_contesto',    7   -- coda del mese precedente caricata per rotazione/riposi
  )),
  ('ai', jsonb_build_object(
      'provider', 'glm',
      'modello',  null
  ));
