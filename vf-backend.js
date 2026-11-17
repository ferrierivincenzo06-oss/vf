/* VF — collegamento ai dati su Supabase.
   Imita l'interfaccia che VF usava dentro Claude (window.claude.use('db') / use('downloads')),
   così il resto dell'app resta identico. */
(function(){
  const CFG = window.VF_CONFIG || {};
  const TABLE = 'vf_docs';
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vf-auth' }
  });
  window.vfSupabase = sb;

  /* ---------- login ---------- */
  const css = `
  #vfLogin{position:fixed;inset:0;z-index:99999;background:#F1F8FA;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  #vfLogin .vfbox{width:100%;max-width:360px;background:#fff;border-radius:22px;padding:28px 22px;box-shadow:0 10px 40px rgba(14,80,110,.12)}
  #vfLogin h1{margin:0 0 4px;padding:0;background:none;border:0;font-size:34px;font-weight:800;color:#0A9FC4;text-align:center;letter-spacing:-.5px}
  #vfLogin p{margin:0 0 18px;text-align:center;color:#5B7480;font-size:14px}
  #vfLogin input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:13px 14px;border:1.5px solid #DCE9EE;border-radius:12px;margin-bottom:10px;background:#F8FCFD;color:#0B2733}
  #vfLogin input:focus{outline:none;border-color:#0A9FC4}
  #vfLogin button{width:100%;font:inherit;font-weight:700;font-size:16px;padding:13px;border:0;border-radius:12px;background:#0A9FC4;color:#fff;margin-top:4px}
  #vfLogin button.sec{background:none;color:#0A9FC4;font-weight:600;font-size:14px;margin-top:8px}
  #vfLogin .msg{min-height:20px;margin-top:10px;text-align:center;font-size:14px;color:#C2410C}
  #vfLogin .msg.ok{color:#0E9F6E}`;
  function showLogin(){
    return new Promise(resolve => {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      const el = document.createElement('div'); el.id = 'vfLogin';
      el.innerHTML = '<form class="vfbox"><h1>VF</h1><p>Accedi per vedere i tuoi dati</p>' +
        '<input id="vfEmail" type="email" autocomplete="username" placeholder="Email" required>' +
        '<input id="vfPass" type="password" autocomplete="current-password" placeholder="Password" required minlength="6">' +
        '<button type="submit">Accedi</button>' +
        '<button type="button" class="sec" id="vfSignup">Prima volta? Crea l’account</button>' +
        '<div class="msg" id="vfMsg"></div></form>';
      document.body.appendChild(el);
      const msg = (t, ok) => { const m = el.querySelector('#vfMsg'); m.textContent = t; m.className = 'msg' + (ok ? ' ok' : ''); };
      const vals = () => ({ email: el.querySelector('#vfEmail').value.trim(), password: el.querySelector('#vfPass').value });
      el.querySelector('form').addEventListener('submit', async ev => {
        ev.preventDefault(); msg('Accedo…', true);
        const { data, error } = await sb.auth.signInWithPassword(vals());
        if (error){ msg(/confirm/i.test(error.message) ? 'Prima conferma l’email: apri il link che ti è arrivato.' : 'Email o password sbagliate.'); return; }
        el.remove(); resolve(data.session);
      });
      el.querySelector('#vfSignup').addEventListener('click', async () => {
        const v = vals(); if (!v.email || v.password.length < 6){ msg('Scrivi email e una password di almeno 6 caratteri.'); return; }
        msg('Creo l’account…', true);
        const { data, error } = await sb.auth.signUp({ ...v, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error){ msg(/registered|exists/i.test(error.message) ? 'Questo account esiste già: tocca Accedi.' : 'Non riesco a creare l’account: ' + error.message); return; }
        if (data.session){ el.remove(); resolve(data.session); }
        else msg('Fatto! Apri l’email che ti ho mandato, conferma, poi torna qui e tocca Accedi.', true);
      });
    });
  }
  async function session(){
    const { data } = await sb.auth.getSession();
    return data.session || await showLogin();
  }
  window.vfLogout = async () => { await sb.auth.signOut(); location.reload(); };

  /* ---------- db (stessa forma usata da VF) ---------- */
  function makeDb(user){
    const pending = {};   // path -> {n, data|undefined(delete)}
    const listeners = {}; // col -> [{cb, err}]
    const mark = (path, val) => { const p = pending[path] || (pending[path] = {n:0}); p.n++; p.val = val; };
    const unmark = path => { const p = pending[path]; if (p && --p.n <= 0) delete pending[path]; };
    async function fetchCol(col){
      const { data, error } = await sb.from(TABLE).select('id,data').eq('col', col);
      if (error) throw error;
      const map = {}; data.forEach(r => { map[r.id] = r.data; });
      Object.keys(pending).forEach(path => { const [c, id] = path.split('/'); if (c !== col) return; const v = pending[path].val; if (v === undefined) delete map[id]; else map[id] = v; });
      return map;
    }
    const timers = {};
    function refresh(col){
      clearTimeout(timers[col]);
      timers[col] = setTimeout(async () => {
        try {
          const map = await fetchCol(col);
          const snap = { docs: Object.entries(map).map(([id, d]) => ({ id, data: () => d })), metadata: { fromCache: false } };
          (listeners[col] || []).forEach(l => l.cb(snap));
        } catch(e){ (listeners[col] || []).forEach(l => l.err && l.err(e)); }
      }, 120);
    }
    const refreshAll = () => Object.keys(listeners).forEach(refresh);
    sb.channel('vf-docs').on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'user_id=eq.' + user.id }, p => {
      const col = (p.new && p.new.col) || (p.old && p.old.col);
      if (col) refresh(col); else refreshAll();
    }).subscribe();
    // su iPhone l'app in background perde la connessione: quando torni, ricarico tutto
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAll(); });
    window.addEventListener('online', refreshAll);
    setInterval(() => { if (document.visibilityState === 'visible') refreshAll(); }, 60000);
    return {
      collection(col){
        return { onSnapshot(cb, err){ (listeners[col] = listeners[col] || []).push({cb, err}); refresh(col); return () => { listeners[col] = listeners[col].filter(l => l.cb !== cb); }; } };
      },
      doc(path){
        const [col, id] = path.split('/');
        return {
          async set(data){
            mark(path, data);
            try {
              const { error } = await sb.from(TABLE).upsert({ user_id: user.id, col, id, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,col,id' });
              if (error) throw error;
            } finally { unmark(path); }
          },
          async delete(){
            mark(path, undefined);
            try {
              const { error } = await sb.from(TABLE).delete().eq('col', col).eq('id', id);
              if (error) throw error;
            } finally { unmark(path); }
          }
        };
      }
    };
  }

  /* ---------- download del backup ---------- */
  const downloads = {
    async save({ filename, data }){
      const blob = new Blob([data], { type: 'application/json' });
      try {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)){
          await navigator.share({ files: [file], title: filename }); return;
        }
      } catch(e){ if (e && e.name === 'AbortError'){ const err = new Error('declined'); err.code = 'declined'; throw err; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  };

  let dbPromise = null;
  window.claude = {
    use(name){
      if (name === 'downloads') return Promise.resolve(downloads);
      if (name === 'db') return dbPromise || (dbPromise = session().then(s => makeDb(s.user)));
      return Promise.reject(new Error('non disponibile'));
    }
  };

  if ('serviceWorker' in navigator){
    /* aggiornamenti: controlla sempre se c'è una versione nuova e, se arriva, ricarica da sola una volta */
    let reloaded = false; const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !hadSW) return; reloaded = true; location.reload(); });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'}).then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      window.addEventListener('focus', check);
    }).catch(() => {}));
  }
})();
