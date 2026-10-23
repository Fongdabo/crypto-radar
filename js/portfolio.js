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
    const addresses = (Array.isArray(s.addresses) ? s.addresses : []).filter(a => typeof a === 'string' && /^0x[0-9a-f]{40}$/.test(a)).slice(0, 5);
    return { holdings, addresses };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); return true; }
    catch (e) { $('msg').textContent = 'บันทึกในเครื่องไม่ได้ (อาจเปิดโหมดไม่ระบุตัวตนอยู่)'; return false; }
  }

  function units(v, dec) { const d = Number(dec) || 0; try { const b = BigInt(v); const p = 10n ** BigInt(d); return Number(b / p) + Number(b % p) / Number(p); } catch (e) { return Number(v) / 10 ** d; } }
  async function getJson(u) { const r = await fetch(u, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(r.status); return r.json(); }

  async function loadWallets() {
    const addrs = store.addresses;
    walletRows = []; walletState = addrs.length ? 'loading' : ''; renderWallet();
    if (!addrs.length) { render(); return; }
    let ok = 0, failed = 0;
    const rows = [];
    await Promise.all(addrs.flatMap(a => CHAINS.map(async ([host, chain, native]) => {
      const base = `https://${host}.blockscout.com/api/v2/addresses/${a}`;
      try {
        const [info, toks] = await Promise.all([
          getJson(base).catch(e => e.message === '404' ? null : Promise.reject(e)),
          getJson(base + '/token-balances').catch(e => e.message === '404' ? [] : Promise.reject(e)),
        ]);
        ok++;
        if (info && info.coin_balance && info.coin_balance !== '0') {
          const amt = units(info.coin_balance, 18), px = info.exchange_rate != null ? Number(info.exchange_rate) : null;
          if (amt > 0) rows.push({ sym: native, chain, amount: amt, price: px, value: px == null ? null : amt * px });
        }
        for (const t of Array.isArray(toks) ? toks : []) {
          const tk = t.token || {};
          if (tk.type !== 'ERC-20' || tk.exchange_rate == null || typeof tk.symbol !== 'string') continue;
          const amt = units(t.value, tk.decimals), px = Number(tk.exchange_rate);
          if (!(amt > 0)) continue;
          rows.push({ sym: tk.symbol.slice(0, 20), chain, amount: amt, price: px, value: amt * px });
        }
      } catch (e) { failed++; }
    })));
    walletRows = rows.filter(r => r.value == null || r.value >= 0.01).sort((x, y) => (y.value || 0) - (x.value || 0));
    walletState = ok === 0 ? 'blocked' : failed ? 'partial' : 'ok';
    renderWallet(); render();
  }

  function renderWallet() {
    const list = $('w-list'); list.textContent = '';
    for (const a of store.addresses) {
      const row = document.createElement('div'); row.className = 'muted'; row.style.margin = '6px 0';
      row.append(document.createTextNode('กระเป๋า ' + short(a) + ' '));
      const b = document.createElement('button'); b.className = 'ghost'; b.type = 'button'; b.textContent = 'เอาออก';
      b.onclick = () => { store.addresses = store.addresses.filter(x => x !== a); save(); loadWallets(); };
      row.append(b); list.append(row);
    }
    const tb = $('w-rows'); tb.textContent = '';
    const note = t => { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 'muted'; td.textContent = t; tr.append(td); tb.append(tr); };
    if (!store.addresses.length) return note('ยังไม่ได้ใส่ที่อยู่กระเป๋า');
    if (walletState === 'loading') return note('กำลังอ่านยอดจากบล็อกเชน…');
    if (walletState === 'blocked') return note('ตอนนี้เชื่อมต่อตัวสำรวจบล็อกเชนไม่ได้ ใช้ช่องกรอกเองด้านล่างไปก่อนได้');
    if (!walletRows.length) note('ไม่พบเหรียญที่มีราคาในกระเป๋านี้');
    for (const r of walletRows) {
      const tr = document.createElement('tr');
      for (const c of [r.sym, r.chain, r.amount.toLocaleString('en-US', { maximumFractionDigits: 6 }), usd(r.price), usd(r.value)]) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
      tb.append(tr);
    }
    if (walletState === 'partial') note('บางเครือข่ายอ่านไม่สำเร็จ ยอดอาจไม่ครบ');
  }

  $('w-add').onclick = () => {
    const m = $('w-msg'), v = $('w-addr').value.trim();
    if (v.split(/\s+/).length >= 6) { $('w-addr').value = ''; m.textContent = 'นี่ดูเหมือน seed phrase! แอปไม่ได้บันทึกไว้ ห้ามให้ใครเห็นคำชุดนี้เด็ดขาด ให้ใส่เฉพาะที่อยู่ที่ขึ้นต้นด้วย 0x'; return; }
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(v)) { $('w-addr').value = ''; m.textContent = 'นี่ดูเหมือน private key! แอปไม่ได้บันทึกไว้ ถ้าเคยให้ใครเห็นให้ย้ายเงินไปกระเป๋าใหม่ทันที ให้ใส่เฉพาะที่อยู่ที่ขึ้นต้นด้วย 0x ยาว 42 ตัว'; return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(v)) { m.textContent = 'ที่อยู่ไม่ถูกต้อง ต้องขึ้นต้นด้วย 0x และยาว 42 ตัวอักษร (กดคัดลอกจาก MetaMask ได้เลย)'; return; }
    const a = v.toLowerCase();
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
    const wv = walletRows.reduce((t, r) => t + (r.value || 0), 0);
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
