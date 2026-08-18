-- Congedo parentale fra i tipi di assenza.
--
-- Il prospetto del coordinatore usa la sigla `C`, che non compare nella sua
-- legenda: e' stata sciolta chiedendo, dopo che due operatori risultavano
-- assenti per 12 giornate senza che nulla dicesse perche'.
--
-- Serviva un valore proprio e non `permesso`. Per la pianificazione sarebbero
-- equivalenti — il solver guarda solo se la giornata e' occupata, non da cosa
-- (`assenza: true` in `lib/dati/stato-cella-piano.ts`) — ma il tipo governa il
-- codice e l'etichetta mostrati nella griglia, e congedo e permesso sono due
-- istituti distinti. Archiviare l'uno sotto l'altro non avrebbe cambiato un
-- turno e avrebbe ingannato chi legge, che e' la sola cosa per cui il campo
-- esiste.
--
-- `add value` e' additivo: le righe esistenti non si toccano e nessuna query
-- cambia comportamento. Il nuovo valore non e' pero' utilizzabile nella stessa
-- transazione che lo introduce, quindi le assenze si inseriscono a parte.

alter type tipo_assenza add value if not exists 'congedo';
