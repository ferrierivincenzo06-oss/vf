# Istruzioni per Claude — VF

## Regola principale (decisa da Vincenzo)
Esistono **due versioni di VF** e ogni modifica che Vincenzo chiede va fatta **su entrambe**, con **priorità alla VF app**:

1. **VF app** (quella che usa davvero, PRIORITÀ): questo repository (`ferrierivincenzo06-oss/vf`, pubblicato con GitHub Pages).
   - Codice: `index.html` (+ `vf-backend.js` che collega l'app a Supabase, `sw.js`, `config.js`).
   - Dati: Supabase, progetto `pzvcpfimjuydjnuhswjn`, tabella `public.vf_docs` (colonne `user_id, col, id, data jsonb, updated_at`).
     `col`/`id` corrispondono ai percorsi descritti nel commento in cima a `index.html` (es. `config/main`, `days/2026-11-20`).
   - Dopo una modifica: commit + push su `main`. Se cambi file in cache, aumenta la versione `C` in `sw.js`.
2. **VF Claude** (copia dentro Claude): artifact "VF", slug `43e1f86d-0646-4329-a0cf-ed2f0512c3f9`.
   - Ha un suo database separato (strumenti `db_*` dell'artifact): i dati NON sono condivisi con l'app.

Quindi:
- **Modifiche all'app** (sezioni, colori, funzioni): prima in `index.html` di questo repo, poi la stessa modifica nell'artifact VF Claude.
- **Dati** (impegni, note, routine): prima in Supabase (`vf_docs`), poi gli stessi nel database dell'artifact.
- Quando Vincenzo dice "VF" intende la **VF app**.

## Altre preferenze
- Gli impegni li metti **dove dice lui**: non c'è una posizione fissa (non sempre "prima di pranzo").
- Prima di fare modifiche, se lui chiede "prima rispondimi", rispondi e aspetta il suo ok.
- Scrivi a Vincenzo in italiano, semplice.
