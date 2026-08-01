# Video demo della landing page — scaletta di ripresa

**Stato attuale:** `public/landing-demo.mp4` è un'**animazione sintetica**, non una
registrazione del prodotto. Illustra il meccanismo con i colori e il modello di
turni veri, ma non mostra l'applicazione in funzione.

Questo documento serve a sostituirla con una registrazione autentica. Finché non
succede, l'animazione tiene il posto senza raccontare niente di falso: la griglia
che mostra è un piano valido secondo le regole del progetto.

---

## Perché non basta l'animazione

La sezione si intitola «Genera un piano in 3 step». Un visitatore che valuta il
prodotto vuole vedere **l'interfaccia reale**: quanto è leggibile la griglia,
quanto è veloce la generazione, che aspetto ha un piano vero. L'animazione
comunica il concetto, non l'esperienza.

---

## Cosa serve prima di registrare

1. **Un account di prova con dati realistici** — non il database di produzione.
   Servono almeno 7 lavoratori (il ciclo canonico M M P P N R R si chiude con 7
   persone sfasate di un giorno: ogni giornata risulta coperta da 2 mattini,
   2 pomeriggi e 1 notte) e 2-3 postazioni.
2. **Nomi inventati ma plausibili.** Mai nomi di persone reali: il video finisce
   su una pagina pubblica.
3. **Finestra a 1280×720 o 1920×1080**, zoom del browser al 100%, nessuna
   estensione visibile nella barra, nessuna scheda personale aperta.
4. **Un mese già configurato** in modo che la generazione vada a buon fine al
   primo colpo. Provare la sequenza una volta prima di registrare.

---

## Scaletta — 15-20 secondi, senza audio

Il video parte in autoplay muto e in loop: **non ci sarà parlato e non ci sarà
sonoro**. Tutto ciò che va comunicato deve stare nell'immagine.

### Inquadratura 1 — Il vincolo in italiano (0:00-0:06)

- Partire con il campo di inserimento vincoli vuoto e a fuoco.
- Digitare, a velocità naturale: `Marco è libero la domenica pomeriggio`
- Attendere che compaia il vincolo estratto dall'AI.
- Fermarsi un istante sulla conferma.

**Cosa deve leggersi:** si scrive come si parla, e il sistema chiede conferma
prima di applicare. L'AI propone, l'utente decide.

### Inquadratura 2 — La generazione (0:06-0:12)

- Cliccare «Genera piano».
- Riprendere la griglia che si popola, senza tagli.
- Se la generazione dura meno di due secondi, **non allungarla artificialmente**:
  la velocità è il punto. Semmai tenere l'inquadratura ferma sul risultato.

**Cosa deve leggersi:** da vuoto a piano completo, in un gesto solo.

### Inquadratura 3 — Il risultato (0:12-0:18)

- Mostrare l'indicatore di copertura completa / zero turni scoperti.
- Scorrere brevemente sulla domenica di Marco: deve essere libera.
- Chiudere sul pulsante di esportazione, senza cliccarlo.

**Cosa deve leggersi:** il vincolo di dieci secondi fa è stato rispettato, e il
piano è pronto da consegnare.

---

## Requisiti tecnici del file

Vanno rispettati, altrimenti la sezione si rompe:

| Voce | Valore | Perché |
|---|---|---|
| Formato | MP4, H.264, `yuv420p` | Altri profili di colore non si vedono su Safari |
| Risoluzione | 1280×720 o 1920×1080 | Il contenitore è `aspect-video` (16:9) |
| Durata | 15-20 s | Va in loop: più lungo stanca |
| Audio | **nessuno** | Parte muto; una traccia audio è solo peso |
| Peso | sotto i 2 MB | È sopra la piega della landing page |
| `-movflags +faststart` | obbligatorio | Senza, il video parte solo a scaricamento finito |

Comando di ricodifica di una registrazione grezza:

```bash
ffmpeg -i registrazione.mov -vf "scale=1280:720,fps=24,format=yuv420p" \
  -c:v libx264 -preset slow -crf 24 -movflags +faststart -an \
  public/landing-demo.mp4
```

Il poster va estratto dal fotogramma più rappresentativo — di norma il piano
completo, non il primo fotogramma, che è quasi sempre una schermata vuota:

```bash
ffmpeg -i public/landing-demo.mp4 -ss 13 -frames:v 1 \
  public/landing-demo-fallback.png
```

---

## Una trappola già pagata una volta

Il middleware (`proxy.ts`) reindirizza al login tutto ciò che non riconosce come
risorsa statica. L'elenco delle estensioni escluse **non comprendeva `mp4`**:
qualunque video messo in `public/` tornava un `307` verso `/accedi` invece di
essere servito. È corretto adesso, ma se un giorno il video sparisce dalla
landing senza motivo apparente, quello è il primo posto da guardare.

---

## Rigenerare l'animazione provvisoria

Finché il video vero non c'è, l'animazione si ricostruisce con:

```bash
./scripts/demo-landing/genera.sh
```

La sorgente è `scripts/demo-landing/fotogrammi.html`: una pagina che rende lo
stato del fotogramma `N` leggendo `?f=N`. Non ci sono animazioni a tempo, quindi
ogni scatto cattura esattamente lo stato voluto e due esecuzioni danno lo stesso
risultato. Per cambiare durata o ritmo si agisce su `N_FOTOGRAMMI` e
`FPS_SORGENTE` nello script.
