// Price targets: kept on this device, checked when the app opens and every 5 minutes while it stays open.
(function () {
  const KEY = 'crypto-radar:targets:v1';
  const CHECK_MS = 5 * 60e3;
  const listeners = [];

  function load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return (Array.isArray(a) ? a : []).filter(t => t && typeof t.sym === 'string' && /^[A-Z0-9.$_-]{1,20}$/.test(t.sym) && (t.dir === 'above' || t.dir === 'below') && t.price > 0);
    } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    for (const fn of listeners) fn(list);
  }

  async function notify(title, body, opts) {
    const href = (opts && opts.href) || 'portfolio.html#targets', kind = (opts && opts.kind) || 'alert';
    let shown = false;
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title });
        else new Notification(title, { body, icon: 'icons/icon-192.png' });
        shown = true;
      }
    } catch (e) {}
    // Keep it for the bell in the toolbar (last 30).
    try {
      const k = 'crypto-radar:bell-log:v1', log = JSON.parse(localStorage.getItem(k) || '[]');
      log.push({ at: new Date().toISOString(), title, body, href, kind }); localStorage.setItem(k, JSON.stringify(log.slice(-30)));
      window.dispatchEvent(new Event('cr-bell'));
    } catch (e) {}
    // Always also show it inside the app.
    const t = document.createElement('a');
    t.className = 'toast alert-toast'; t.href = href;
    t.textContent = '🔔 ' + title + ' · ' + body;
    document.body.append(t); setTimeout(() => t.remove(), 12000);
    if (window.CRTelegram) window.CRTelegram.send('🔔 ' + title + '\n' + body).catch(() => {});
    return shown;
  }

  let lastPrices = {};
  async function check() {
    const list = load();
    const live = list.filter(t => !t.hit_at);
    if (!live.length || !window.CR) return lastPrices;
    try {
      for (const t of live) if (!t.id) t.id = await window.CR.resolveId(t.sym).catch(() => null);
      const px = await window.CR.livePrices(live.map(t => t.id));
      lastPrices = px;
      let changed = false;
      for (const t of live) {
        const p = px[t.id] && px[t.id].usd;
        if (p == null) continue;
        t.last = p; t.checked_at = new Date().toISOString(); changed = true;
        if ((t.dir === 'above' && p >= t.price) || (t.dir === 'below' && p <= t.price)) {
          t.hit_at = t.checked_at; t.hit_price = p;
          notify(t.sym + (t.dir === 'above' ? ' ขึ้นถึง' : ' ลงถึง') + 'ราคาเป้าหมาย', 'ราคาตอนนี้ $' + fmt(p) + ' (เป้า $' + fmt(t.price) + ')' + (t.note ? ' · ' + t.note : ''));
        }
      }
      if (changed) {
        // Merge onto the latest list so edits made meanwhile in another tab are kept.
        const cur = load();
        for (const t of live) { const i = cur.findIndex(x => x.key === t.key); if (i >= 0) cur[i] = Object.assign(cur[i], { id: t.id, last: t.last, checked_at: t.checked_at, hit_at: t.hit_at, hit_price: t.hit_price }); }
        save(cur);
      }
    } catch (e) {}
    return lastPrices;
  }
  // Coins I hold (manual holdings, and wallet coins worth $10+) that moved 10%+ in 24h: one alert per coin per day.
  const MOVES_KEY = 'crypto-radar:moves:v1';
  function heldSyms() {
    const out = new Set();
    try { for (const h of (JSON.parse(localStorage.getItem('crypto-radar:portfolio:v1') || '{}').holdings || [])) if (h && h.asset) out.add(String(h.asset)); } catch (e) {}
    try { for (const v of Object.values(JSON.parse(localStorage.getItem('crypto-radar:wallet-cache:v1') || '{}'))) for (const r of (v && v.rows) || []) if (!r.unverified && (r.value || 0) >= 10 && !/^(USDT|USDC|DAI)$/.test(r.sym)) out.add(String(r.sym)); } catch (e) {}
    return [...out].filter(x => /^[A-Z0-9.$_-]{1,20}$/.test(x)).slice(0, 40);
  }
  async function checkMoves() {
    if (!window.CR) return;
    const syms = heldSyms();
    if (!syms.length) return;
    const ids = {};
    for (const s of syms) { try { const id = await window.CR.resolveId(s); if (id) ids[s] = id; } catch (e) {} }
    const px = await window.CR.livePrices(Object.values(ids)).catch(() => ({}));
    let sent = {}; try { sent = JSON.parse(localStorage.getItem(MOVES_KEY) || '{}'); } catch (e) {}
    const day = new Date().toISOString().slice(0, 10);
    for (const [s, id] of Object.entries(ids)) {
      const c = px[id] && px[id].change24;
      if (c == null || Math.abs(c) < 10 || sent[s] === day) continue;
      sent[s] = day;
      notify(s + (c > 0 ? ' ขึ้นแรง +' : ' ลงแรง ') + c.toFixed(1) + '% ใน 24 ชม.', 'ราคาตอนนี้ $' + fmt(px[id].usd) + ' · เป็นเหรียญที่คุณถืออยู่');
    }
    try { localStorage.setItem(MOVES_KEY, JSON.stringify(sent)); } catch (e) {}
  }

  const fmt = n => (n < 1 ? n.toPrecision(4) : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));

  async function enableNotifications() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  }

  window.CRAlerts = {
    list: load,
    add(t) { const list = load(); list.push(Object.assign({ key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created_at: new Date().toISOString() }, t)); save(list); check(); },
    remove(key) { save(load().filter(t => t.key !== key)); },
    rearm(key) { const list = load(); const t = list.find(x => x.key === key); if (t) { delete t.hit_at; delete t.hit_price; save(list); check(); } },
    onChange(fn) { listeners.push(fn); },
    check, enableNotifications, notify,
    permission: () => ('Notification' in window ? Notification.permission : 'unsupported'),
  };
  window.addEventListener('storage', e => { if (e.key === KEY) for (const fn of listeners) fn(load()); });

  const tick = () => { check(); checkMoves().catch(() => {}); };
  setTimeout(tick, 1500);
  setInterval(() => { if (document.visibilityState === 'visible') tick(); }, CHECK_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
})();
