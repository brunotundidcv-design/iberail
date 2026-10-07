/* Iberail — Supabase de mentira, en memoria, para la DEMO del panel (y para probar la web sin tocar la base de datos real).
   NO va en la web publicada: lo mete tools/demo/build.py solo en la versión de demo.
   Imita lo que usa la web de supabase-js v2: from().select/insert/update/upsert/delete con filtros, rpc, auth,
   canales (tiempo real y presencia), storage y las edge functions (fetch a /functions/v1/…).
   Los datos los pone otro archivo en window.IB_DEMO = { db: { tabla: [filas] }, rpc: { nombre(args, db) }, user,
   presencia: [...], funciones: { nombre(body) }, latencia: [min, max] }. Nada sale del navegador. */
(function(){
  const D = window.IB_DEMO = window.IB_DEMO || {};
  D.db = D.db || {};
  D.rpc = D.rpc || {};
  D.funciones = D.funciones || {};
  D.archivos = D.archivos || {};          // 'bucket/ruta' → Blob | url
  const PK = { rutas_notas: 'ruta_id', sorteo_ganadores: 'user_id', seguro_ofertas: 'grupo_id', sorteo_inscritos: 'user_id', wa_chats: 'telefono' };
  const ids = {};
  const tabla = t => (D.db[t] = D.db[t] || []);
  const nextId = t => { if(ids[t] == null) ids[t] = tabla(t).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0); return ++ids[t]; };
  const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
  const espera = () => { const [a, b] = D.latencia || [60, 180]; return new Promise(r => setTimeout(r, a + Math.random() * (b - a))); };
  const errNoTabla = t => ({ message: `relation "public.${t}" does not exist`, code: '42P01' });

  /* ---------- tiempo real ---------- */
  const canales = new Set();
  D.emitir = (table, eventType, fila, vieja) => {
    canales.forEach(ch => ch._pg.forEach(l => {
      if(l.f.table && l.f.table !== table) return;
      if(l.f.event && l.f.event !== '*' && l.f.event !== eventType) return;
      try{ l.cb({ eventType, table, schema: 'public', new: fila ? copia(fila) : {}, old: vieja ? copia(vieja) : {} }); }catch(e){ console.error(e); }
    }));
  };
  D.presenciaCambia = () => canales.forEach(ch => { if(ch._presencia) ch._pres.forEach(cb => { try{ cb(); }catch(e){} }); });

  function canal(nombre){
    const ch = {
      _pg: [], _pres: [], _presencia: nombre === 'iberail-en-directo',
      on(tipo, f, cb){ if(tipo === 'postgres_changes') this._pg.push({ f: f || {}, cb }); else if(tipo === 'presence') this._pres.push(cb); return this; },
      subscribe(cb){ canales.add(this); setTimeout(() => { if(cb) cb('SUBSCRIBED'); if(this._presencia) this._pres.forEach(f => { try{ f(); }catch(e){} }); }, 250); return this; },
      presenceState(){ const st = {}; (D.presencia || []).forEach((p, i) => { st['demo-' + i] = [p]; }); return st; },
      track(){ return Promise.resolve('ok'); }, untrack(){ return Promise.resolve('ok'); },
      send(){ return Promise.resolve('ok'); },
      unsubscribe(){ canales.delete(this); return Promise.resolve('ok'); }
    };
    return ch;
  }

  /* ---------- consultas ---------- */
  const vale = (fila, f) => {
    const v = fila[f.col];
    switch(f.op){
      case 'eq': return v != null && String(v) === String(f.val);
      case 'neq': return v == null || String(v) !== String(f.val);
      case 'in': return f.val.map(String).includes(String(v));
      case 'is': return f.val === null ? v == null : v === f.val;
      case 'not': return f.sub === 'is' ? (f.val === null ? v != null : v !== f.val) : f.sub === 'eq' ? String(v) !== String(f.val) : f.sub === 'in' ? !String(f.val).replace(/[()]/g, '').split(',').includes(String(v)) : true;
      case 'gt': return v != null && (typeof v === 'number' ? v > f.val : String(v) > String(f.val));
      case 'gte': return v != null && (typeof v === 'number' ? v >= f.val : String(v) >= String(f.val));
      case 'lt': return v != null && (typeof v === 'number' ? v < f.val : String(v) < String(f.val));
      case 'lte': return v != null && (typeof v === 'number' ? v <= f.val : String(v) <= String(f.val));
      case 'like': case 'ilike': {
        const re = new RegExp('^' + String(f.val).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', f.op === 'ilike' ? 'i' : '');
        return re.test(String(v == null ? '' : v));
      }
      case 'contains': return Array.isArray(v) && [].concat(f.val).every(x => v.includes(x));
      default: return true;
    }
  };
  function columnas(sel, fila){
    if(!sel || sel.trim() === '*') return copia(fila);
    const o = {};
    sel.split(',').map(s => s.trim()).filter(Boolean).forEach(c => { const [n, alias] = c.split(':').reverse(); o[alias || n] = copia(fila[n]); });
    return o;
  }

  class Q {
    constructor(t){ this.t = t; this.op = 'select'; this.f = []; this.ord = []; this.lim = null; this.rng = null; this.one = null; this.sel = '*'; this.opts = {}; this.ret = false; }
    select(cols, opts){ if(this.op === 'select'){ this.sel = cols || '*'; this.opts = opts || {}; } else { this.ret = true; this.sel = cols || '*'; } return this; }
    insert(filas){ this.op = 'insert'; this.filas = [].concat(filas); return this; }
    upsert(filas, o){ this.op = 'upsert'; this.filas = [].concat(filas); this.conf = (o && o.onConflict) || PK[this.t] || 'id'; return this; }
    update(p){ this.op = 'update'; this.patch = p; return this; }
    delete(){ this.op = 'delete'; return this; }
    eq(col, val){ this.f.push({ op: 'eq', col, val }); return this; }
    neq(col, val){ this.f.push({ op: 'neq', col, val }); return this; }
    in(col, val){ this.f.push({ op: 'in', col, val: [].concat(val) }); return this; }
    is(col, val){ this.f.push({ op: 'is', col, val }); return this; }
    not(col, sub, val){ this.f.push({ op: 'not', col, sub, val }); return this; }
    gt(col, val){ this.f.push({ op: 'gt', col, val }); return this; }
    gte(col, val){ this.f.push({ op: 'gte', col, val }); return this; }
    lt(col, val){ this.f.push({ op: 'lt', col, val }); return this; }
    lte(col, val){ this.f.push({ op: 'lte', col, val }); return this; }
    like(col, val){ this.f.push({ op: 'like', col, val }); return this; }
    ilike(col, val){ this.f.push({ op: 'ilike', col, val }); return this; }
    contains(col, val){ this.f.push({ op: 'contains', col, val }); return this; }
    match(o){ Object.keys(o || {}).forEach(k => this.eq(k, o[k])); return this; }
    filter(col, op, val){ this.f.push({ op, col, val }); return this; }
    or(){ return this; }
    order(col, o){ this.ord.push({ col, asc: !o || o.ascending !== false }); return this; }
    limit(n){ this.lim = n; return this; }
    range(a, b){ this.rng = [a, b]; return this; }
    single(){ this.one = 'single'; return this; }
    maybeSingle(){ this.one = 'maybe'; return this; }
    abortSignal(){ return this; }
    throwOnError(){ return this; }
    then(ok, ko){ return this._run().then(ok, ko); }
    catch(ko){ return this._run().catch(ko); }
    finally(fn){ return this._run().finally(fn); }
    async _run(){
      await espera();
      if(D.tablasQueFaltan && D.tablasQueFaltan.includes(this.t)) return { data: null, error: errNoTabla(this.t), count: null, status: 404 };
      const T = tabla(this.t), coinciden = r => this.f.every(f => vale(r, f));
      let out = [];
      if(this.op === 'select'){
        out = T.filter(coinciden);
        if(this.ord.length) out = out.slice().sort((a, b) => {
          for(const o of this.ord){ const x = a[o.col], y = b[o.col]; if(x === y) continue; if(x == null) return 1; if(y == null) return -1; const c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y)); if(c) return o.asc ? c : -c; }
          return 0;
        });
        const total = out.length;
        if(this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
        if(this.lim != null) out = out.slice(0, this.lim);
        if(this.opts.head) return { data: null, error: null, count: total, status: 200 };
        out = out.map(r => columnas(this.sel, r));
        return this._fin(out, this.opts.count ? total : null);
      }
      if(this.op === 'insert'){
        const nuevas = this.filas.map(f => {
          const r = { ...copia(f) };
          if(r.id == null && !PK[this.t]) r.id = nextId(this.t);
          if(r.created_at == null) r.created_at = new Date().toISOString();
          return r;
        });
        for(const r of nuevas){ const k = PK[this.t]; if(k && T.some(x => String(x[k]) === String(r[k]))) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' }, status: 409 }; }
        nuevas.forEach(r => { T.push(r); D.emitir(this.t, 'INSERT', r); });
        return this._fin(this.ret ? nuevas.map(r => columnas(this.sel, r)) : null);
      }
      if(this.op === 'upsert'){
        const keys = String(this.conf).split(',').map(s => s.trim());
        const res = this.filas.map(f => {
          const ex = T.find(x => keys.every(k => String(x[k]) === String(f[k])));
          if(ex){ const old = copia(ex); Object.assign(ex, copia(f)); D.emitir(this.t, 'UPDATE', ex, old); return ex; }
          const r = { ...copia(f) }; if(r.id == null && keys[0] === 'id') r.id = nextId(this.t); if(r.created_at == null) r.created_at = new Date().toISOString();
          T.push(r); D.emitir(this.t, 'INSERT', r); return r;
        });
        return this._fin(this.ret ? res.map(r => columnas(this.sel, r)) : null);
      }
      if(this.op === 'update'){
        const res = T.filter(coinciden);
        res.forEach(r => { const old = copia(r); Object.assign(r, copia(this.patch)); D.emitir(this.t, 'UPDATE', r, old); });
        return this._fin(this.ret ? res.map(r => columnas(this.sel, r)) : null);
      }
      if(this.op === 'delete'){
        const fuera = T.filter(coinciden);
        D.db[this.t] = T.filter(r => !coinciden(r));
        fuera.forEach(r => D.emitir(this.t, 'DELETE', null, r));
        return this._fin(this.ret ? fuera.map(r => columnas(this.sel, r)) : null);
      }
      return { data: null, error: null };
    }
    _fin(data, count){
      if(this.one && Array.isArray(data)){
        if(this.one === 'single' && data.length !== 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, status: 406 };
        return { data: data[0] || null, error: null, count, status: 200 };
      }
      return { data, error: null, count, status: 200 };
    }
  }

  /* ---------- rpc ---------- */
  function rpc(nombre, args){
    const p = (async () => {
      await espera();
      const fn = D.rpc[nombre];
      if(!fn) return { data: null, error: { message: `Could not find the function public.${nombre} in the schema cache`, code: 'PGRST202' } };
      try{ return { data: copia(await fn(args || {}, D.db, D.user)), error: null }; }
      catch(e){ return { data: null, error: { message: String(e && e.message || e) } }; }
    })();
    const q = { then: (a, b) => p.then(a, b), catch: b => p.catch(b), single(){ return q; }, maybeSingle(){ return q; } };
    return q;
  }

  /* ---------- sesión ---------- */
  const oyentesAuth = new Set();
  const sesion = () => D.user ? { user: copia(D.user), access_token: 'demo', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600 } : null;
  const auth = {
    async getSession(){ return { data: { session: sesion() }, error: null }; },
    async getUser(){ return { data: { user: D.user ? copia(D.user) : null }, error: null }; },
    onAuthStateChange(cb){ oyentesAuth.add(cb); setTimeout(() => cb('INITIAL_SESSION', sesion()), 0); return { data: { subscription: { unsubscribe(){ oyentesAuth.delete(cb); } } } }; },
    async signOut(){ D.user = null; oyentesAuth.forEach(cb => cb('SIGNED_OUT', null)); return { error: null }; },
    async updateUser(p){ if(D.user && p && p.data) D.user.user_metadata = { ...(D.user.user_metadata || {}), ...p.data }; oyentesAuth.forEach(cb => cb('USER_UPDATED', sesion())); return { data: { user: copia(D.user) }, error: null }; },
    async signInWithOtp(){ return { data: {}, error: null }; },
    async verifyOtp(){ return { data: { session: sesion(), user: copia(D.user) }, error: null }; },
    async signInWithPassword(){ return { data: { session: sesion(), user: copia(D.user) }, error: null }; },
    async resetPasswordForEmail(){ return { data: {}, error: null }; }
  };

  /* ---------- archivos ---------- */
  const PIXEL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560"><rect width="100%" height="100%" fill="#F7F0E3"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" fill="#1A1614" text-anchor="middle">Archivo de ejemplo (demo)</text></svg>');
  const url = (b, p) => { const x = D.archivos[b + '/' + p]; if(!x) return (D.imagenDe && D.imagenDe(b, p)) || PIXEL; return typeof x === 'string' ? x : URL.createObjectURL(x); };
  const storage = {
    from(b){
      return {
        async upload(p, file){ await espera(); D.archivos[b + '/' + p] = file; return { data: { path: p }, error: null }; },
        async createSignedUrl(p){ return { data: { signedUrl: url(b, p) }, error: null }; },
        async createSignedUrls(ps){ return { data: ps.map(p => ({ path: p, signedUrl: url(b, p), error: null })), error: null }; },
        getPublicUrl(p){ return { data: { publicUrl: url(b, p) } }; },
        async remove(ps){ [].concat(ps || []).forEach(p => delete D.archivos[b + '/' + p]); return { data: [], error: null }; },
        async list(){ return { data: [], error: null }; },
        async download(p){ const x = D.archivos[b + '/' + p]; return { data: x instanceof Blob ? x : new Blob(['demo']), error: null }; }
      };
    }
  };

  /* ---------- edge functions (la web las llama con fetch) ---------- */
  const fetch0 = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = async function(u, o){
    const s = String(u && u.url || u);
    const m = s.match(/\/functions\/v1\/([a-z0-9_-]+)/i);
    if(m){
      await espera();
      let body = {}; try{ body = JSON.parse(o && o.body || '{}'); }catch(e){}
      const fn = D.funciones[m[1]];
      const res = fn ? await fn(body) : { ok: false, error: 'En la demo no se envía nada de verdad.' };
      return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if(/supabase\.co/.test(s)) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });   // por si algo intenta ir a la base de datos real
    return fetch0(u, o);
  };

  function createClient(){
    return { from: t => new Q(t), rpc, auth, storage, channel: canal, removeChannel(ch){ if(ch && ch.unsubscribe) ch.unsubscribe(); return Promise.resolve('ok'); }, removeAllChannels(){ canales.clear(); return Promise.resolve([]); }, functions: { async invoke(n, o){ const fn = D.funciones[n]; return { data: fn ? await fn((o && o.body) || {}) : null, error: fn ? null : { message: 'demo' } }; } } };
  }
  window.supabase = { createClient };
})();
