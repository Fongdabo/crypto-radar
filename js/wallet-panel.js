// Wallet side panel, docked on the right like MetaMask's: account, total, coins by network, and the verified
// official sites for activities with a link checker. Read-only: it shows what the portfolio page last read and
// never connects, signs or sends anything. Balances come from the portfolio's cache on this device.
(function () {
  const EN = window.CR_LANG === 'en';
  const T = (th, en) => (EN ? en : th);
  const locale = window.CR_LOCALE || 'th-TH';
  const PF_KEY = 'crypto-radar:portfolio:v1', CACHE_KEY = 'crypto-radar:wallet-cache:v1';
  const OPEN_KEY = 'crypto-radar:panel:v1', ACCT_KEY = 'crypto-radar:panel-account:v1', TAB_KEY = 'crypto-radar:panel-tab:v1';
  const TRACKER = 'https://claude.ai/artifact/YDA7AQrbpHqMDbnA1biCbi#mine';
  const DOCK_MIN = 1200;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const usd = n => (n == null ? '–' : (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const amt = n => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toLocaleString('en-US', { maximumSignificantDigits: 5 }));
  const short = a => a.slice(0, 6) + '…' + a.slice(-4);
  const CHAIN_COLOR = { Ethereum: '#627eea', Base: '#0052ff', Polygon: '#8247e5', Arbitrum: '#28a0f0', Optimism: '#ff0420', Bitcoin: '#f7931a', Solana: '#14f195', Tron: '#eb0029', Stellar: '#7d7d7d' };

  // Wallet badges, shared with the portfolio page's wallet tabs. A wallet's own icon is used when the browser has it.
  const LOOK = { metamask: ['🦊', '#3b2412'], phantom: ['👻', '#ab9ff2'], ronin: ['R', '#1273ea'], rabby: ['🐰', '#7084ff'], okx: ['OKX', '#111'], coinbase: ['C', '#0052ff'], trust: ['T', '#0500ff'], binance: ['B', '#f0b90b'] };
  function badge(key, name, icon) {
    const b = h('span', 'wbadge');
    if (icon && /^data:image\//.test(icon)) { const i = document.createElement('img'); i.src = icon; i.alt = ''; b.append(i); b.classList.add('img'); return b; }
    const [t, bg] = LOOK[key] || [String(name || '?').trim().slice(0, 1).toUpperCase(), '#475569'];
    b.textContent = t; b.style.background = bg; if (t.length > 2) b.style.fontSize = '9px';
    return b;
  }
  window.CRWallets = { badge };

  // ---- panel shell ----
  const panel = h('aside', 'wpanel'); panel.setAttribute('aria-label', T('กระเป๋า', 'Wallet')); panel.hidden = true;
  document.body.append(panel);
  const tools = document.querySelector('.tools');
  const btn = h('button', 'tb wbtn'); btn.type = 'button';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><path d="M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="13.5" r="1.2"/></svg>';
  btn.title = T('กระเป๋า', 'Wallet'); btn.setAttribute('aria-label', btn.title);
  if (tools) tools.prepend(btn);

  // Width: drag the left edge (260–480px), remembered on this device; double-click goes back to the default.
  const W_KEY = 'crypto-radar:panel-width:v1', W_MIN = 260, W_MAX = 480, W_DEF = 300;
  const setW = w => { w = Math.round(Math.min(W_MAX, Math.max(W_MIN, w))); document.documentElement.style.setProperty('--wp-w', w + 'px'); return w; };
  try { const w = Number(localStorage.getItem(W_KEY)); if (w) setW(w); } catch (e) {}
  const grip = h('div', 'wp-grip'); grip.title = T('ลากเพื่อปรับความกว้าง · ดับเบิลคลิกเพื่อคืนค่า', 'Drag to resize · double-click to reset');
  document.body.append(grip);
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); grip.classList.add('drag'); document.body.classList.add('wp-resizing');
    const move = ev => setW(window.innerWidth - ev.clientX);
    const up = ev => {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.classList.remove('drag'); document.body.classList.remove('wp-resizing');
      put(W_KEY, String(setW(window.innerWidth - ev.clientX)));
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => { setW(W_DEF); put(W_KEY, String(W_DEF)); });
  // The docked panel starts below the top bar, whose height changes with wrapping and font loading.
  const appBar = document.querySelector('.app-bar');
  const barH = () => document.documentElement.style.setProperty('--bar-h', (appBar ? appBar.offsetHeight : 0) + 'px');
  barH(); if (appBar && window.ResizeObserver) new ResizeObserver(barH).observe(appBar);
  const wide = () => window.innerWidth >= DOCK_MIN;
  function setOpen(open, remember) {
    panel.hidden = !open;
    btn.setAttribute('aria-pressed', String(open));
    document.body.classList.toggle('wp-docked', open && wide());
    document.body.classList.toggle('wp-sheet', open && !wide());
    if (remember) put(OPEN_KEY, open ? '1' : '0');
    if (open) render();
  }
  btn.onclick = () => setOpen(panel.hidden, true);
  // Docked by default on wide screens; a sheet you open on phones.
  window.addEventListener('resize', () => { if (!panel.hidden) setOpen(true); });

  // ---- data ----
  let official = [], timeline = [], fakes = [], extra = [], dataDate = '';
  const json = id => (window.crFetchData ? window.crFetchData(id) : fetch('data/' + id + '.json')).then(r => r.json()).catch(() => []);
  Promise.all([json('official_links'), json('timeline'), json('airdrop_deadlines'),
    fetch('safety.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({})),
    fetch('data/meta.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}))])
    .then(([ol, tl, ad, sf, meta]) => {
      official = Array.isArray(ol) ? ol : [];
      timeline = [].concat(Array.isArray(tl) ? tl : [], Array.isArray(ad) ? ad.map(x => ({ label: x.project, url: x.url, url_note: x.url_note, date: x.key_date })) : []);
      fakes = (sf.fakes || []).filter(x => x && x.domain);
      extra = (sf.extra_official || []).filter(x => x && x.url);
      dataDate = meta.updated_at ? new Date(meta.updated_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
      if (!panel.hidden) render();
    });

  // Every official address we have verified: whole domains, except social sites where only the exact account counts.
  const SOCIAL = /^(x\.com|twitter\.com|t\.me|discord\.gg|discord\.com|youtube\.com|medium\.com)$/;
  const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return ''; } };
  function officialList() {
    const out = [], seen = new Set();
    const add = (project, url, note, kind) => {
      if (typeof url !== 'string' || !url.startsWith('https://')) return;
      const key = url.replace(/\/+$/, '').toLowerCase();
      if (seen.has(key)) return; seen.add(key);
      out.push({ project, url, host: hostOf(url), note, kind });
    };
    for (const r of official) { add(r.project, r.site, r.note, 'site'); for (const l of r.links || []) add(r.project, l.u, l.t, 'doc'); }
    for (const r of timeline) add(r.label, r.url, r.url_note, 'date');
    for (const r of extra) add(r.project, r.url, '', 'site');
    return out;
  }

  // ---- link checker ----
  function checkLink(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (!/^[a-z]+:\/\//i.test(s)) s = 'https://' + s;
    let u; try { u = new URL(s); } catch (e) { return { level: 'bad', text: T('ไม่ใช่ลิงก์เว็บ', 'Not a web link') }; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const list = officialList();
    const fake = fakes.find(f => host === f.domain || host.endsWith('.' + f.domain));
    if (fake) return { level: 'bad', text: T('เว็บปลอมที่รู้จักแล้ว (เลียนแบบ ' + fake.project + ') ห้ามเชื่อมกระเป๋า', 'Known fake site (copies ' + fake.project + '). Do not connect your wallet.') };
    if (host.startsWith('xn--') || host.includes('.xn--')) return { level: 'bad', text: T('ชื่อเว็บใช้ตัวอักษรหลอกตา (punycode) มักเป็นเว็บปลอม', 'The name uses look-alike characters (punycode); usually a fake') };
    if (u.protocol !== 'https:') return { level: 'bad', text: T('ไม่ใช่ https ห้ามเชื่อมกระเป๋า', 'Not https. Do not connect your wallet.') };
    const match = list.find(o => {
      if (SOCIAL.test(o.host)) {
        // Only that exact account counts: /StandX_Official or /StandX_Official/..., never /StandX_Official_2.
        const want = new URL(o.url).pathname.toLowerCase().replace(/\/+$/, ''), got = u.pathname.toLowerCase();
        return host === o.host && want.length > 1 && (got.replace(/\/+$/, '') === want || got.startsWith(want + '/'));
      }
      return host === o.host || host.endsWith('.' + o.host);
    });
    if (match) return { level: 'ok', text: T('ตรงกับเว็บทางการที่ตรวจแล้ว: ' + match.project, 'Matches a verified official site: ' + match.project), item: match };
    // A name that contains a known project's name but is not its domain is the classic phishing pattern.
    const words = new Set();
    for (const o of list) if (!SOCIAL.test(o.host)) { const w = o.host.split('.').slice(-2, -1)[0]; if (w && w.length >= 4) words.add(w); }
    for (const r of official) for (const w of String(r.project).toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 4) words.add(w);
    const look = [...words].find(w => host.includes(w));
    if (look) return { level: 'bad', text: T('ชื่อคล้ายเว็บทางการ (' + look + ') แต่ไม่ใช่โดเมนที่ตรวจแล้ว น่าจะเป็นเว็บปลอม ห้ามเชื่อมกระเป๋า', 'Looks like an official name (' + look + ') but is not the verified domain. Likely fake. Do not connect your wallet.') };
    return { level: 'warn', text: T('ยังไม่อยู่ในรายชื่อเว็บที่ตรวจแล้ว อย่าเพิ่งเชื่อมกระเป๋า ส่งลิงก์ให้ Claude ตรวจในแชตก่อน', 'Not in our verified list. Do not connect yet; send the link to Claude in chat to check first.') };
  }

  // ---- render ----
  function accounts() { const s = read(PF_KEY, {}); return Array.isArray(s.accounts) ? s.accounts.filter(a => a && Array.isArray(a.addresses)) : []; }
  function rowsFor(acct) {
    const cache = read(CACHE_KEY, {}), out = []; let at = 0;
    for (const [k, v] of Object.entries(cache)) {
      const addr = k.split('|')[0];
      if (!acct.addresses.includes(addr) || !v || !Array.isArray(v.rows)) continue;
      at = Math.max(at, v.at || 0);
      for (const r of v.rows) if (r && r.amount > 0) out.push(Object.assign({ addr }, r));
    }
    out.sort((a, b) => (b.value || 0) - (a.value || 0));
    return { rows: out, at };
  }
  let tab = get(TAB_KEY) || 'tokens';

  function render() {
    if (panel.hidden) return;
    panel.replaceChildren();
    const accts = accounts();
    const head = h('div', 'wp-head');
    const close = h('button', 'wp-x', '×'); close.type = 'button'; close.title = T('ปิด', 'Close'); close.setAttribute('aria-label', close.title);
    close.onclick = () => setOpen(false, true);

    if (!accts.length || !accts.some(a => a.addresses.length)) {
      head.append(h('b', '', T('กระเป๋า', 'Wallet')), close); panel.append(head);
      const e = h('div', 'wp-empty');
      e.append(h('p', '', T('ยังไม่มีที่อยู่กระเป๋า เพิ่มได้ในหน้าพอร์ต (ดูอย่างเดียว ไม่ต้องเซ็นอะไร)', 'No wallet addresses yet. Add them on the Portfolio page (read-only, nothing to sign).')));
      const a = h('a', 'wp-cta', T('เพิ่มกระเป๋า →', 'Add a wallet →')); a.href = 'portfolio.html#wallets'; a.onclick = () => put(ACCT_KEY, '+'); e.append(a);
      panel.append(e, sites());
      return;
    }
    let acct = accts.find(a => a.id === get(ACCT_KEY)) || accts.find(a => a.addresses.length) || accts[0];
    const title = h('b', 'wp-name', acct.name); title.dataset.noI18n = '';
    head.append(badge(acct.wallet, acct.name), title, close); panel.append(head);
    // One tab per wallet the user added, like the portfolio page; + goes to adding one.
    const wt = h('div', 'wp-wtabs'); wt.setAttribute('role', 'tablist');
    for (const a of accts) {
      const b = h('button', 'wp-wtab' + (a.id === acct.id ? ' on' : '')); b.type = 'button'; b.title = a.name; b.setAttribute('aria-label', a.name);
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(a.id === acct.id)); b.dataset.noI18n = '';
      b.append(badge(a.wallet, a.name));
      b.onclick = () => { put(ACCT_KEY, a.id); render(); };
      wt.append(b);
    }
    const plus = h('a', 'wp-wtab plus', '+'); plus.href = 'portfolio.html#wallets'; plus.title = T('เพิ่มกระเป๋า', 'Add a wallet');
    plus.onclick = () => put(ACCT_KEY, '+');
    wt.append(plus); panel.append(wt);

    if (acct.addresses.length) {
      const ad = h('button', 'wp-addr'); ad.type = 'button'; ad.title = T('คัดลอกที่อยู่', 'Copy address');
      ad.append(h('span', '', short(acct.addresses[0])), h('span', 'muted', acct.addresses.length > 1 ? ' +' + (acct.addresses.length - 1) : ''), h('span', 'ic', ' ⧉'));
      ad.onclick = () => copy(acct.addresses[0], ad);
      panel.append(ad);
    }
    const { rows, at } = rowsFor(acct);
    const counted = rows.filter(r => !r.unverified && r.value != null);
    const total = counted.reduce((s, r) => s + r.value, 0);
    const bal = h('div', 'wp-total');
    bal.append(h('b', '', usd(total)), h('span', 'muted', at ? T('อ่านยอดล่าสุด ', 'Last read ') + new Date(at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : T('ยังไม่ได้อ่านยอด เปิดหน้าพอร์ตเพื่ออ่าน', 'Not read yet; open Portfolio to read')));
    panel.append(bal);

    const acts = h('div', 'wp-acts');
    const act = (ico, label, onclick, href) => {
      const b = h(href ? 'a' : 'button', 'wp-act'); if (href) b.href = href; else { b.type = 'button'; b.onclick = onclick; }
      b.append(h('span', 'i', ico), h('span', '', label)); acts.append(b); return b;
    };
    act('$', T('ซื้อ', 'Buy'), null, 'guide.html#buy');
    const rcv = act('↙', T('รับ', 'Receive'), () => receive(acct, rcv));
    act('↻', T('อ่านยอด', 'Refresh'), () => { const r = document.getElementById('w-refresh'); if (r) r.click(); else location.href = 'portfolio.html'; });
    act('▤', T('พอร์ต', 'Portfolio'), null, 'portfolio.html');
    panel.append(acts);

    const tabs = h('div', 'wp-tabs');
    for (const [k, label] of [['tokens', T('เหรียญ', 'Tokens')], ['sites', T('กิจกรรม', 'Activities')]]) {
      const b = h('button', k === tab ? 'on' : '', label); b.type = 'button';
      b.onclick = () => { tab = k; put(TAB_KEY, k); render(); };
      tabs.append(b);
    }
    panel.append(tabs);
    panel.append(tab === 'sites' ? sites() : tokens(rows));
  }

  function tokens(rows) {
    const box = h('div', 'wp-list');
    if (!rows.length) { box.append(h('p', 'muted wp-pad', T('ไม่มีเหรียญที่มีราคาในตลาด หรือยังไม่ได้อ่านยอด', 'No coins with a market price, or balances not read yet'))); return box; }
    for (const r of rows) {
      const a = h('a', 'wp-tok' + (r.unverified ? ' unv' : ''));
      const sym = String(r.sym).replace(' ⚠', '');
      if (!r.unverified && /^[A-Za-z0-9.$_-]{1,20}$/.test(sym)) a.href = 'coin.html?sym=' + encodeURIComponent(sym);
      let dot;
      if (window.CRLogo) dot = window.CRLogo(sym, r.chain, r.logo, { unverified: r.unverified });
      else { dot = h('span', 'wp-dot', sym.slice(0, 1)); dot.style.background = CHAIN_COLOR[r.chain] || '#64748b'; }
      const l = h('span', 'l'); l.append(h('b', '', r.sym), h('span', 'muted', r.chain + (r.unverified ? ' · ' + T('ไม่นับรวม', 'not counted') : '')));
      const v = h('span', 'r'); v.append(h('b', '', usd(r.value)), h('span', 'muted', amt(r.amount) + ' ' + sym));
      a.append(dot, l, v); box.append(a);
    }
    return box;
  }

  function sites() {
    const box = h('div', 'wp-list wp-sites');
    // Link checker.
    const chk = h('div', 'wp-check');
    chk.append(h('b', '', T('ตรวจลิงก์ก่อนเชื่อมกระเป๋า', 'Check a link before connecting')));
    const row = h('div', 'wp-row');
    const inp = h('input'); inp.type = 'url'; inp.placeholder = T('วางลิงก์ เช่น claim.pharos.xyz', 'Paste a link, e.g. claim.pharos.xyz'); inp.autocomplete = 'off'; inp.spellcheck = false;
    const go = h('button', '', T('ตรวจ', 'Check')); go.type = 'button';
    const out = h('div', 'wp-res');
    const run = () => {
      const r = checkLink(inp.value); out.replaceChildren(); out.className = 'wp-res';
      if (!r) return;
      out.classList.add(r.level); out.append(h('span', '', (r.level === 'ok' ? '✅ ' : r.level === 'warn' ? '⚠️ ' : '🚫 ') + r.text));
      if (r.item) { const a = h('a', '', T('เปิดเว็บทางการ ↗', 'Open the official site ↗')); a.href = r.item.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; out.append(a); }
    };
    go.onclick = run; inp.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    row.append(inp, go); chk.append(row, out); box.append(chk);

    // What is normal to approve on an activity site, and what never is.
    const rules = h('div', 'wp-rules');
    rules.append(h('b', '', T('ตอนทำกิจกรรมบนเว็บทางการ', 'On an official activity site')));
    const ul = h('ul');
    for (const [ok, t] of [
      [true, T('Connect (ให้เว็บเห็นที่อยู่) และเซ็นข้อความล็อกอินที่อ่านรู้เรื่อง', 'Connect (lets the site see your address) and signing a readable sign-in message')],
      [true, T('ธุรกรรมที่คุณตั้งใจทำเอง เช่น swap จำนวนที่คุณพิมพ์', 'Transactions you meant to make, e.g. a swap of the amount you typed')],
      [false, T('Approve แบบไม่จำกัด (Unlimited) หรือ setApprovalForAll', 'Unlimited Approve or setApprovalForAll')],
      [false, T('Permit หรือข้อความยาวที่อ่านไม่รู้เรื่อง', 'A Permit or a long message you cannot read')],
      [false, T('จ่ายค่าธรรมเนียมเพื่อเคลมแอร์ดรอป หรือขอ seed phrase', 'Paying a fee to claim an airdrop, or any request for your seed phrase')],
    ]) { const li = h('li', ok ? 'ok' : 'no', (ok ? '✓ ' : '✕ ') + t); ul.append(li); }
    rules.append(ul);
    rules.append(h('p', 'muted', T('แอปนี้เปิดเว็บที่ถูกให้ แต่ไม่เชื่อมหรือเซ็นแทนคุณ คุณกด Connect ใน MetaMask บนเว็บนั้นเอง', 'This app opens the right site for you, but never connects or signs for you. You press Connect in MetaMask on that site.')));
    box.append(rules);

    const tr = h('a', 'wp-cta', T('ตารางกิจกรรมของฉัน (แอร์ดรอป) ↗', 'My activity tracker (airdrops) ↗')); tr.href = TRACKER; tr.target = '_blank'; tr.rel = 'noopener noreferrer';
    box.append(tr);

    box.append(h('div', 'wp-sec', T('เว็บทางการที่ตรวจแล้ว', 'Verified official sites') + (dataDate ? ' · ' + T('ตรวจ ', 'checked ') + dataDate : '')));
    const list = officialList().filter(o => o.kind !== 'doc');
    if (!list.length) box.append(h('p', 'muted wp-pad', T('กำลังโหลด…', 'Loading…')));
    for (const o of list) {
      const a = h('a', 'wp-site'); a.href = o.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const l = h('span', 'l'); const name = h('b', '', o.project); name.dataset.noI18n = ''; l.append(name);
      const host = h('span', 'host', '✓ ' + o.host + (SOCIAL.test(o.host) ? new URL(o.url).pathname : '')); l.append(host);
      if (o.note) { const n = h('span', 'muted', o.note); n.dataset.noI18n = ''; l.append(n); }
      a.append(l, h('span', 'go', '↗')); box.append(a);
    }
    return box;
  }

  function receive(acct, anchor) {
    const old = panel.querySelector('.wp-recv'); if (old) { old.remove(); return; }
    const box = h('div', 'wp-recv');
    box.append(h('p', 'muted', T('ที่อยู่สำหรับรับเงิน เลือกเครือข่ายให้ตรงกับฝั่งที่โอนทุกครั้ง', 'Addresses for receiving. Always pick the same network as the sender.')));
    for (const a of acct.addresses) {
      const b = h('button', 'wp-addr full'); b.type = 'button'; b.append(h('span', 'mono', a), h('span', 'ic', ' ⧉')); b.onclick = () => copy(a, b);
      box.append(b);
    }
    anchor.parentElement.after(box);
  }
  function copy(text, el) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => {
      el.classList.add('copied'); setTimeout(() => el.classList.remove('copied'), 1200);
    }).catch(() => window.prompt(T('คัดลอกที่อยู่', 'Copy the address'), text));
  }

  window.addEventListener('cr-wallets', render);
  window.addEventListener('storage', e => { if (e.key === PF_KEY || e.key === CACHE_KEY) render(); });

  const saved = get(OPEN_KEY);
  setOpen(saved === '1' || (saved == null && wide()));
})();
