// Personal portfolio kept in this browser only (localStorage). Wallet balances are read-only lookups by public address.
(function () {
  const $ = id => document.getElementById(id);
  const KEY = 'crypto-radar:portfolio:v1';
  const usd = n => {
    if (n == null || !isFinite(n)) return '–';
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    return s + '$' + (a < 1 && a !== 0 ? a.toPrecision(3) : a.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  };
  const CHAINS = [['eth', 'Ethereum', 'ETH'], ['base', 'Base', 'ETH'], ['polygon', 'Polygon', 'POL'], ['arbitrum', 'Arbitrum', 'ETH'], ['optimism', 'Optimism', 'ETH']];
  const short = a => a.slice(0, 6) + '…' + a.slice(-4);

  let prices = [], walletRows = [], walletState = '';
  let store = read();

  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || '{}');
      return clean(s);
    } catch (e) { return { holdings: [], addresses: [] }; }
  }
  function clean(s) {
    const holdings = (Array.isArray(s.holdings) ? s.holdings : [])
      .filter(h => h && typeof h.asset === 'string' && /^[A-Z0-9.$_-]{1,20}$/.test(h.asset) && isFinite(h.amount) && isFinite(h.buy_price_usd))
      .map(h => ({ id: String(h.id || Math.random().toString(36).slice(2)), asset: h.asset, amount: Number(h.amount), buy_price_usd: Number(h.buy_price_usd), manual_price_usd: h.manual_price_usd == null ? undefined : Number(h.manual_price_usd), added_at: String(h.added_at || '') }));
    const addresses = (Array.isArray(s.addresses) ? s.addresses : []).filter(a => typeof a === 'string' && (/^0x[0-9a-f]{40}$/.test(a) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a))).slice(0, 5);
    return { holdings, addresses };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
    catch (e) { $('msg').textContent = 'บันทึกในเครื่องไม่ได้ (อาจเปิดโหมดไม่ระบุตัวตนอยู่)'; return false; }
  }

  function units(v, dec) { const d = Number(dec) || 0; try { const b = BigInt(v); const p = 10n ** BigInt(d); return Number(b / p) + Number(b % p) / Number(p); } catch (e) { return Number(v) / 10 ** d; } }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function getJson(u, opts) {
    const r = await fetch(u, Object.assign({ headers: { accept: 'application/json' } }, opts));
    if (!r.ok) { const e = new Error(String(r.status)); e.status = r.status; throw e; }
    return r.json();
  }
  // Public explorers rate-limit bursts, so retry with a growing pause before calling a chain failed.
  async function retry(fn, tries) {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (e) { if (e.status === 404 || i >= (tries || 3) - 1) throw e; await sleep(800 * 2 ** i); }
    }
  }
  // Run tasks a few at a time instead of all at once.
  async function pool(tasks, n) {
    const out = []; let i = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
    return out;
  }

  const isEvm = a => /^0x[0-9a-f]{40}$/.test(a);
  const isSol = a => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  const CACHE_KEY = 'crypto-radar:wallet-cache:v1';
  function cacheGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { return {}; } }
  function cachePut(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {} }

  async function readEvmChain(a, host, chain, native) {
    const base = `https://${host}.blockscout.com/api/v2/addresses/${a}`;
    const info = await retry(() => getJson(base)).catch(e => { if (e.status === 404) return null; throw e; });
    const toks = await retry(() => getJson(base + '/token-balances')).catch(e => { if (e.status === 404) return []; throw e; });
    const rows = [];
    if (info && info.coin_balance && info.coin_balance !== '0') {
      const amt = units(info.coin_balance, 18), px = info.exchange_rate != null ? Number(info.exchange_rate) : null;
      if (amt > 0) rows.push({ sym: native, chain, amount: amt, price: px, value: px == null ? null : amt * px });
    }
    for (const t of Array.isArray(toks) ? toks : []) {
      const tk = t.token || {};
      if (tk.type !== 'ERC-20' || tk.exchange_rate == null || typeof tk.symbol !== 'string') continue;
      const amt = units(t.value, tk.decimals), px = Number(tk.exchange_rate);
      if (amt > 0) rows.push({ sym: tk.symbol.slice(0, 20), chain, amount: amt, price: px, value: amt * px });
    }
    return rows;
  }

  const SOL_RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
  const WSOL = 'So11111111111111111111111111111111111111112';
  const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PTn2Y6MjqGVGNdN'];
  async function solRpc(method, params) {
    let last;
    for (const url of SOL_RPCS) {
      try {
        const j = await retry(() => getJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }), 2);
        if (j.error) throw new Error(j.error.message || 'rpc error');
        return j.result;
      } catch (e) { last = e; }
    }
    throw last;
  }
  // Symbol and USD price per mint: Jupiter first, DexScreener as the fallback.
  async function solPrices(mints) {
    const out = {};
    for (let i = 0; i < mints.length; i += 50) {
      const part = mints.slice(i, i + 50);
      try {
        const list = await retry(() => getJson('https://lite-api.jup.ag/tokens/v2/search?query=' + part.join(',')), 2);
        for (const t of Array.isArray(list) ? list : []) {
          if (t && t.id && t.usdPrice != null) out[t.id] = { sym: String(t.symbol || '').slice(0, 20), price: Number(t.usdPrice), verified: !!t.isVerified };
        }
      } catch (e) {}
      const missing = part.filter(m => !out[m]);
      for (let k = 0; k < missing.length; k += 30) {
        try {
          const pairs = await retry(() => getJson('https://api.dexscreener.com/tokens/v1/solana/' + missing.slice(k, k + 30).join(',')), 2);
          const best = {};
          for (const p of Array.isArray(pairs) ? pairs : []) {
            const m = p && p.baseToken && p.baseToken.address;
            if (!m || p.priceUsd == null) continue;
            const liq = (p.liquidity && p.liquidity.usd) || 0;
            if (!best[m] || liq > best[m].liq) best[m] = { liq, sym: String(p.baseToken.symbol || '').slice(0, 20), price: Number(p.priceUsd) };
          }
          for (const m in best) out[m] = { sym: best[m].sym, price: best[m].price, verified: best[m].liq >= 50000 };
        } catch (e) {}
      }
    }
    return out;
  }
  async function readSolana(a) {
    const bal = await solRpc('getBalance', [a]);
    const accts = [];
    for (const pid of TOKEN_PROGRAMS) {
      const r = await solRpc('getTokenAccountsByOwner', [a, { programId: pid }, { encoding: 'jsonParsed' }]);
      for (const it of (r && r.value) || []) {
        const info = it.account && it.account.data && it.account.data.parsed && it.account.data.parsed.info;
        const amt = info && info.tokenAmount && Number(info.tokenAmount.uiAmountString);
        if (info && amt > 0) accts.push({ mint: info.mint, amount: amt });
      }
    }
    const sol = ((bal && bal.value) || 0) / 1e9;
    const px = await solPrices([WSOL, ...new Set(accts.map(t => t.mint))]);
    const rows = [];
    if (sol > 0) { const p = px[WSOL] ? px[WSOL].price : null; rows.push({ sym: 'SOL', chain: 'Solana', amount: sol, price: p, value: p == null ? null : sol * p }); }
    for (const t of accts) {
      const p = px[t.mint];
      if (!p || !p.sym) continue;   // no market price: skip, like unpriced EVM tokens
      rows.push({ sym: p.sym + (p.verified ? '' : ' ⚠'), chain: 'Solana', amount: t.amount, price: p.price, value: t.amount * p.price, unverified: !p.verified });
    }
    return rows;
  }

  let failedChains = [], fromCache = false;
  async function loadWallets() {
    const addrs = store.addresses;
    walletRows = []; failedChains = []; fromCache = false;
    walletState = addrs.length ? 'loading' : ''; renderWallet();
    if (!addrs.length) { render(); return; }
    const cache = cacheGet(), jobs = [];
    for (const a of addrs) {
      if (isSol(a) && !isEvm(a)) jobs.push({ key: a + '|sol', label: 'Solana', run: () => readSolana(a) });
      else for (const [host, chain, native] of CHAINS) jobs.push({ key: a + '|' + host, label: chain, run: () => readEvmChain(a, host, chain, native) });
    }
    let ok = 0;
    const results = await pool(jobs.map(j => async () => {
      try { const rows = await j.run(); ok++; cache[j.key] = { at: Date.now(), rows }; return rows; }
      catch (e) {
        failedChains.push(j.label);
        const c = cache[j.key];
        if (c && Array.isArray(c.rows)) { fromCache = true; return c.rows; }
        return [];
      }
    }), 3);
    for (const k of Object.keys(cache)) if (!jobs.some(j => j.key === k)) delete cache[k];
    cachePut(cache);
    walletRows = results.flat().filter(r => r.value == null || r.value >= 0.01).sort((x, y) => (y.value || 0) - (x.value || 0));
    walletState = ok === 0 && !walletRows.length ? 'blocked' : failedChains.length ? 'partial' : 'ok';
    renderWallet(); render();
  }

  function renderWallet() {
    const list = $('w-list'); list.textContent = '';
    for (const a of store.addresses) {
      const row = document.createElement('div'); row.className = 'muted'; row.style.margin = '6px 0';
      row.append(document.createTextNode('กระเป๋า ' + (isEvm(a) ? 'EVM ' : 'Solana ') + short(a) + ' '));
      const b = document.createElement('button'); b.className = 'ghost'; b.type = 'button'; b.textContent = 'เอาออก';
      b.onclick = () => { store.addresses = store.addresses.filter(x => x !== a); save(); loadWallets(); };
      row.append(b); list.append(row);
    }
    const tb = $('w-rows'); tb.textContent = '';
    const note = t => { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 'muted'; td.textContent = t; tr.append(td); tb.append(tr); };
    if (!store.addresses.length) return note('ยังไม่ได้ใส่ที่อยู่กระเป๋า');
    if (walletState === 'loading') return note('กำลังอ่านยอดจากบล็อกเชน…');
    if (walletState === 'blocked') return note('ตอนนี้เชื่อมต่อบล็อกเชนไม่ได้ ลองกด "อ่านยอดใหม่" อีกครั้งในอีกสักครู่ หรือใช้ช่องกรอกเองด้านล่างไปก่อน');
    if (!walletRows.length) note('ไม่พบเหรียญที่มีราคาในตลาดในกระเป๋านี้');
    for (const r of walletRows) {
      const tr = document.createElement('tr');
      for (const c of [r.sym, r.chain, r.amount.toLocaleString('en-US', { maximumFractionDigits: 6 }), usd(r.price), usd(r.value)]) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
      tb.append(tr);
    }
    if (walletRows.some(r => r.unverified)) note('⚠ = เหรียญที่ยังไม่ได้รับการยืนยันหรือสภาพคล่องต่ำ ราคาอาจไม่จริง อาจเป็นเหรียญสแกมที่ถูกส่งมาเอง และไม่นับรวมในยอดรวม');
    if (walletState === 'partial') {
      const names = [...new Set(failedChains)].join(', ');
      note('อ่านไม่สำเร็จ: ' + names + (fromCache ? ' (แสดงยอดล่าสุดที่เคยอ่านได้แทน)' : '') + ' มักเกิดจากเว็บสำรวจบล็อกเชนจำกัดจำนวนครั้ง กด "อ่านยอดใหม่" อีกครั้งได้');
    }
  }

  $('w-add').onclick = () => {
    const m = $('w-msg'), v = $('w-addr').value.trim();
    const clear = t => { $('w-addr').value = ''; m.textContent = t; };
    if (v.split(/\s+/).length >= 6) return clear('นี่ดูเหมือน seed phrase! แอปไม่ได้บันทึกไว้ ห้ามให้ใครเห็นคำชุดนี้เด็ดขาด ให้ใส่เฉพาะที่อยู่กระเป๋า');
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(v) || /^\[\s*\d+(\s*,\s*\d+){31,}\s*\]$/.test(v) || /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(v)) return clear('นี่ดูเหมือน private key! แอปไม่ได้บันทึกไว้ ถ้าเคยให้ใครเห็นให้ย้ายเงินไปกระเป๋าใหม่ทันที ให้ใส่เฉพาะที่อยู่กระเป๋า');
    let a;
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) a = v.toLowerCase();
    else if (isSol(v)) a = v;
    else { m.textContent = 'ที่อยู่ไม่ถูกต้อง ใส่ได้ 2 แบบ: กระเป๋า EVM ขึ้นต้นด้วย 0x ยาว 42 ตัว หรือกระเป๋า Solana ยาว 32–44 ตัว (กดคัดลอกจากแอปกระเป๋าได้เลย)'; return; }
    if (store.addresses.includes(a)) { m.textContent = 'มีกระเป๋านี้แล้ว'; return; }
    if (store.addresses.length >= 5) { m.textContent = 'ใส่ได้สูงสุด 5 กระเป๋า'; return; }
    $('w-addr').value = ''; m.textContent = '';
    store.addresses.push(a); save(); loadWallets();
  };
  $('w-refresh').onclick = loadWallets;

  function fillSelect() {
    const sel = $('f-asset'), cur = sel.value;
    sel.textContent = '';
    for (const p of prices) {
      const o = document.createElement('option');
      o.value = p.token; o.textContent = p.token + (p.game ? ' – ' + p.game : '');
      sel.append(o);
    }
    const o = document.createElement('option');
    o.value = '__custom'; o.textContent = 'เหรียญอื่น (กรอกเอง)';
    sel.append(o);
    if (cur) sel.value = cur;
    toggleCustom();
  }
  function toggleCustom() {
    const c = $('f-asset').value === '__custom';
    $('custom-wrap').classList.toggle('hidden', !c);
    $('manual-wrap').classList.toggle('hidden', !c);
  }

  function render() {
    const tb = $('rows'); tb.textContent = '';
    let tv = 0, tc = 0, missing = false;
    const holdings = store.holdings;
    if (!holdings.length) {
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 7; td.className = 'muted'; td.textContent = 'ยังไม่มีเหรียญในพอร์ต เพิ่มได้จากช่องด้านบน';
      tr.append(td); tb.append(tr);
    }
    for (const h of holdings) {
      const p = prices.find(x => x.token === h.asset);
      const price = p ? Number(p.price_usd) : (h.manual_price_usd != null ? Number(h.manual_price_usd) : null);
      const cost = h.amount * h.buy_price_usd;
      const value = price == null ? null : h.amount * price;
      const pl = value == null ? null : value - cost;
      tc += cost; if (value == null) missing = true; else tv += value;
      const tr = document.createElement('tr');
      const cells = [h.asset, h.amount.toLocaleString('en-US', { maximumFractionDigits: 6 }), usd(h.buy_price_usd), usd(price) + (p || price == null ? '' : ' (กรอกเอง)'), usd(value)];
      for (const c of cells) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
      const tdp = document.createElement('td');
      if (pl != null) { tdp.textContent = (pl >= 0 ? '+' : '') + usd(pl) + (cost ? ` (${(pl / cost * 100).toFixed(1)}%)` : ''); tdp.className = pl >= 0 ? 'pos' : 'neg'; } else tdp.textContent = '–';
      tr.append(tdp);
      const tdd = document.createElement('td'), b = document.createElement('button');
      b.className = 'ghost'; b.type = 'button'; b.textContent = 'ลบ';
      b.onclick = () => { store.holdings = store.holdings.filter(x => x.id !== h.id); save(); render(); };
      tdd.append(b); tr.append(tdd); tb.append(tr);
    }
    const wv = walletRows.reduce((t, r) => t + (r.unverified ? 0 : r.value || 0), 0);   // ⚠ tokens are often airdropped scams
    $('k-wallet').textContent = store.addresses.length ? usd(wv) : '–';
    $('k-total').textContent = usd(tv + wv);
    $('k-value').textContent = usd(tv) + (missing ? '*' : '');
    $('k-cost').textContent = usd(tc);
    const pl = tv - tc, k = $('k-pl');
    k.textContent = holdings.length ? (pl >= 0 ? '+' : '') + usd(pl) : '–';
    k.className = holdings.length ? (pl >= 0 ? 'pos' : 'neg') : '';
  }

  $('f-asset').onchange = toggleCustom;
  $('f-add').onclick = () => {
    const msg = $('msg');
    let asset = $('f-asset').value;
    if (asset === '__custom') asset = $('f-custom').value.trim().toUpperCase();
    const amount = Number($('f-amount').value), buy = Number($('f-buy').value);
    if (!asset || !/^[A-Z0-9.$_-]{1,20}$/.test(asset)) { msg.textContent = 'กรุณาเลือกหรือกรอกชื่อเหรียญ (ตัวอักษร/ตัวเลขเท่านั้น)'; return; }
    if (!(amount > 0) || !(buy >= 0) || $('f-buy').value === '') { msg.textContent = 'กรุณากรอกจำนวนและราคาที่ซื้อให้ถูกต้อง'; return; }
    const h = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), asset, amount, buy_price_usd: buy, added_at: new Date().toISOString() };
    const manual = $('f-manual').value;
    if ($('f-asset').value === '__custom' && manual !== '') h.manual_price_usd = Number(manual);
    store.holdings.push(h);
    if (save()) { msg.textContent = 'บันทึกแล้ว'; $('f-amount').value = ''; $('f-buy').value = ''; $('f-manual').value = ''; $('f-custom').value = ''; }
    render();
  };

  $('b-export').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'crypto-radar', version: 1, exported_at: new Date().toISOString(), ...store }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crypto-radar-portfolio-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $('b-msg').textContent = 'ดาวน์โหลดไฟล์สำรองแล้ว เก็บไว้ในที่ปลอดภัย';
  };
  $('b-import').onclick = () => $('b-file').click();
  $('b-file').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const next = clean(JSON.parse(await f.text()));
      if (!confirm(`นำเข้า ${next.holdings.length} เหรียญ และ ${next.addresses.length} กระเป๋า แทนข้อมูลเดิมในเครื่องนี้?`)) return;
      store = next; save(); render(); loadWallets();
      $('b-msg').textContent = 'นำเข้าเรียบร้อย';
    } catch (err) { $('b-msg').textContent = 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้'; }
  };

  // Another tab or window changed the portfolio.
  window.addEventListener('storage', e => { if (e.key === KEY) { store = read(); render(); loadWallets(); } });

  fetch('data/prices.json', { cache: 'no-cache' }).then(r => r.json()).then(j => {
    const rows = Array.isArray(j) ? j : (j && j.rows) || [];
    prices = rows.filter(r => r && typeof r.token === 'string');
    const asOf = prices.map(p => p.as_of).filter(Boolean).sort().pop();
    $('asof').textContent = asOf ? 'ราคาล่าสุด ณ ' + asOf + ' · อัปเดตทุกเช้าประมาณ 06:47 น.' : '';
    fillSelect(); render();
  }).catch(() => { $('asof').textContent = 'โหลดราคาไม่ได้'; fillSelect(); render(); });

  render(); loadWallets();
})();
