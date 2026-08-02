@AGENTS.md

---

## Ambienti e collegamenti

| Cosa | Dove |
|---|---|
| **Produzione** | https://turni-psi.vercel.app |
| Trattamento dei dati | https://turni-psi.vercel.app/privacy |
| Accesso | https://turni-psi.vercel.app/accedi |
| Dashboard (richiede sessione) | https://turni-psi.vercel.app/home |
| Progetto Vercel | https://vercel.com/chiantera-5967s-projects/turni |
| Progetto Supabase | https://supabase.com/dashboard/project/uxwmletpnmsbvdyxktln |
| Repository | https://github.com/chiantera/turni |
| CI e smoke test | https://github.com/chiantera/turni/actions |

Alias equivalenti dello stesso deployment di produzione:
`turni-chiantera-5967s-projects.vercel.app`,
`turni-git-main-chiantera-5967s-projects.vercel.app`.

**Il deployment è automatico**: ogni push su `main` costruisce e pubblica. Non
esiste uno staging separato — quello che pushi è quello che vedono i beta
tester. Dopo ogni deploy riuscito parte da solo
`scripts/verifica-produzione.sh`; vale la pena lanciarlo anche a mano quando si
tocca la landing o il middleware.
