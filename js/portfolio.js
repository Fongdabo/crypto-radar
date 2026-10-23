// Personal portfolio kept in this browser only (localStorage). Wallet balances are read-only lookups by public address.
(function () {
  const $ = id => document.getElementById(id);
  const KEY = 'crypto-radar:portfolio:v1';
  const usd = n => {
    if (n == null || !isFinite(n)) return '–';
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    return s + '$' + (a < 1 && a !== 0 ? a.toPrecision(3) : a.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  };
  const short = a => a.slice(0, 6) + '…' + a.slice(-5);
  const MAX_ACCOUNTS = 5, MAX_PER_ACCOUNT = 10;

  // Address kinds, worked out from the address itself.
  const KINDS = {
    evm: { label: 'Ethereum + EVM', icon: 'Ξ' },
    btc: { label: 'Bitcoin', icon: '₿' },
    sol: { label: 'Solana', icon: '◎' },
    tron: { label: 'Tron', icon: 'T' },
    xlm: { label: 'Stellar', icon: '✦' },
  };
  function kindOf(a) {
    if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'evm';
    if (/^bc1[02-9ac-hj-np-z]{11,71}$/i.test(a) || /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) return 'btc';
    if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return 'tron';
    if (/^G[A-Z2-7]{55}$/.test(a)) return 'xlm';
    if (/^[1-9A-HJ-NP-Za-km-z]{36,44}$/.test(a)) return 'sol';
    return null;
  }
  const norm = a => { const k = kindOf(a); return k === 'evm' || (k === 'btc' && /^bc1/i.test(a)) ? a.toLowerCase() : a; };
  const isEvm = a => kindOf(a) === 'evm';
  const isSol = a => kindOf(a) === 'sol';

  let prices = [], walletRows = [], walletState = '';
  let addrState = {};   // address -> 'loading' | 'ok' | 'failed' | 'cached'
  let store = read();
  const allAddrs = () => store.accounts.flatMap(x => x.addresses);
  const accountOf = a => store.accounts.find(x => x.addresses.includes(a));

  function read() {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return clean({}); }
  }
  function clean(s) {
    const holdings = (Array.isArray(s.holdings) ? s.holdings : [])
      .filter(h => h && typeof h.asset === 'string' && /^[A-Z0-9.$_-]{1,20}$/.test(h.asset) && isFinite(h.amount) && isFinite(h.buy_price_usd))
      .map(h => ({ id: String(h.id || Math.random().toString(36).slice(2)), asset: h.asset, amount: Number(h.amount), buy_price_usd: Number(h.buy_price_usd), manual_price_usd: h.manual_price_usd == null ? undefined : Number(h.manual_price_usd), added_at: String(h.added_at || '') }));
    // Older versions kept one flat list of addresses: it becomes "บัญชี 1".
    let accounts = Array.isArray(s.accounts) ? s.accounts : [{ id: 'a1', name: 'บัญชี 1', addresses: Array.isArray(s.addresses) ? s.addresses : [] }];
    const seen = new Set();
    accounts = accounts.filter(x => x && typeof x === 'object').slice(0, MAX_ACCOUNTS).map((x, i) => ({
      id: String(x.id || 'a' + (i + 1)),
      name: String(x.name || 'บัญชี ' + (i + 1)).slice(0, 30),
      addresses: (Array.isArray(x.addresses) ? x.addresses : [])
        .filter(a => typeof a === 'string' && kindOf(a)).map(norm)
        .filter(a => !seen.has(a) && seen.add(a)).slice(0, MAX_PER_ACCOUNT),
    }));
    if (!accounts.length) accounts = [{ id: 'a1', name: 'บัญชี 1', addresses: [] }];
    const connected = (Array.isArray(s.connected) ? s.connected : []).filter(a => seen.has(a));
    const trades = (Array.isArray(s.trades) ? s.trades : []).filter(t => t && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && (t.type === 'buy' || t.type === 'sell')
      && /^[A-Z0-9.$_-]{1,20}$/.test(t.sym) && t.amount > 0 && t.price >= 0 && (t.cur === 'THB' || t.cur === 'USD'))
      .map(t => ({ id: String(t.id || Math.random().toString(36).slice(2)), date: t.date, type: t.type, sym: t.sym, amount: Number(t.amount), price: Number(t.price), cur: t.cur, fee: Number(t.fee) || 0, ex: String(t.ex || '').slice(0, 30), note: String(t.note || '').slice(0, 80) }));
    return { holdings, accounts, connected, trades };
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
  async function firstOk(urls, fn) {
    let last;
    for (const u of urls) { try { return await fn(u); } catch (e) { last = e; if (e.status === 404) throw e; } }
    throw last;
  }

  const CACHE_KEY = 'crypto-radar:wallet-cache:v1';
  function cacheGet() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { return {}; } }
  function cachePut(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {} }

  // USD prices for the native coins of non-EVM chains: CoinGecko, then Binance.
  let coinPx = null;
  function nativePrices() {
    if (coinPx) return coinPx;
    coinPx = (async () => {
      try {
        const j = await retry(() => getJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tron,stellar&vs_currencies=usd'), 2);
        return { BTC: j.bitcoin && j.bitcoin.usd, TRX: j.tron && j.tron.usd, XLM: j.stellar && j.stellar.usd };
      } catch (e) {
        try {
          const syms = encodeURIComponent(JSON.stringify(['BTCUSDT', 'TRXUSDT', 'XLMUSDT']));
          const list = await retry(() => getJson('https://api.binance.com/api/v3/ticker/price?symbols=' + syms), 2);
          const by = Object.fromEntries(list.map(t => [t.symbol.replace('USDT', ''), Number(t.price)]));
          return { BTC: by.BTC, TRX: by.TRX, XLM: by.XLM };
        } catch (e2) { return {}; }
      }
    })();
    return coinPx;
  }
  const row = (sym, chain, amount, price, extra) => Object.assign({ sym, chain, amount, price: price == null ? null : Number(price), value: price == null ? null : amount * price }, extra);

  const EVM_CHAINS = [['eth', 'Ethereum', 'ETH'], ['base', 'Base', 'ETH'], ['polygon', 'Polygon', 'POL'], ['arbitrum', 'Arbitrum', 'ETH'], ['optimism', 'Optimism', 'ETH']];
  async function readEvmChain(a, host, chain, native) {
    const base = `https://${host}.blockscout.com/api/v2/addresses/${a}`;
    const info = await retry(() => getJson(base)).catch(e => { if (e.status === 404) return null; throw e; });
    const toks = await retry(() => getJson(base + '/token-balances')).catch(e => { if (e.status === 404) return []; throw e; });
    const rows = [];
    if (info && info.coin_balance && info.coin_balance !== '0') {
      const amt = units(info.coin_balance, 18);
      if (amt > 0) rows.push(row(native, chain, amt, info.exchange_rate));
    }
    for (const t of Array.isArray(toks) ? toks : []) {
      const tk = t.token || {};
      if (tk.type !== 'ERC-20' || tk.exchange_rate == null || typeof tk.symbol !== 'string') continue;
      const amt = units(t.value, tk.decimals);
      if (amt > 0) rows.push(row(tk.symbol.slice(0, 20), chain, amt, tk.exchange_rate));
    }
    return rows;
  }

  async function readBtc(a) {
    const j = await firstOk(['https://mempool.space/api/address/', 'https://blockstream.info/api/address/'], u => retry(() => getJson(u + a), 2));
    const st = x => (x ? (x.funded_txo_sum || 0) - (x.spent_txo_sum || 0) : 0);
    const btc = (st(j.chain_stats) + st(j.mempool_stats)) / 1e8;
    const px = await nativePrices();
    return btc > 0 ? [row('BTC', 'Bitcoin', btc, px.BTC)] : [];
  }

  // Only well-known stablecoins are counted on Tron and Stellar; other tokens there are mostly spam.
  const TRC20 = { TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: 'USDT', TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8: 'USDC' };
  async function readTron(a) {
    const j = await retry(() => getJson('https://api.trongrid.io/v1/accounts/' + a), 3);
    const acct = j && Array.isArray(j.data) && j.data[0];
    if (!acct) return [];
    const px = await nativePrices();
    const rows = [];
    const trx = (acct.balance || 0) / 1e6;
    if (trx > 0) rows.push(row('TRX', 'Tron', trx, px.TRX));
    for (const t of Array.isArray(acct.trc20) ? acct.trc20 : []) {
      for (const [contract, raw] of Object.entries(t || {})) {
        const sym = TRC20[contract];
        const amt = sym ? units(raw, 6) : 0;
        if (amt > 0) rows.push(row(sym, 'Tron', amt, 1));
      }
    }
    return rows;
  }
  const STELLAR_USDC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  async function readXlm(a) {
    const j = await retry(() => getJson('https://horizon.stellar.org/accounts/' + a), 3).catch(e => { if (e.status === 404) return null; throw e; });
    if (!j) return [];   // never funded
    const px = await nativePrices();
    const rows = [];
    for (const b of Array.isArray(j.balances) ? j.balances : []) {
      const amt = Number(b.balance);
      if (!(amt > 0)) continue;
      if (b.asset_type === 'native') rows.push(row('XLM', 'Stellar', amt, px.XLM));
      else if (b.asset_code === 'USDC' && b.asset_issuer === STELLAR_USDC) rows.push(row('USDC', 'Stellar', amt, 1));
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
    if (sol > 0) rows.push(row('SOL', 'Solana', sol, px[WSOL] ? px[WSOL].price : null));
    for (const t of accts) {
      const p = px[t.mint];
      if (!p || !p.sym) continue;   // no market price: skip, like unpriced EVM tokens
      rows.push(row(p.sym + (p.verified ? '' : ' ⚠'), 'Solana', t.amount, p.price, { unverified: !p.verified }));
    }
    return rows;
  }

  let failedChains = [], fromCache = false;
  async function loadWallets() {
    const addrs = allAddrs();
    walletRows = []; failedChains = []; fromCache = false; coinPx = null;
    addrState = Object.fromEntries(addrs.map(a => [a, 'loading']));
    walletState = addrs.length ? 'loading' : ''; renderWallet();
    if (!addrs.length) { render(); return; }
    const cache = cacheGet(), jobs = [];
    for (const a of addrs) {
      const k = kindOf(a);
      if (k === 'evm') for (const [host, chain, native] of EVM_CHAINS) jobs.push({ a, key: a + '|' + host, label: chain, run: () => readEvmChain(a, host, chain, native) });
      else jobs.push({ a, key: a + '|' + k, label: KINDS[k].label, run: () => ({ btc: readBtc, sol: readSolana, tron: readTron, xlm: readXlm })[k](a) });
    }
    let ok = 0;
    const results = await pool(jobs.map(j => async () => {
      let rows;
      try { rows = await j.run(); ok++; cache[j.key] = { at: Date.now(), rows }; if (addrState[j.a] === 'loading') addrState[j.a] = 'ok'; }
      catch (e) {
        failedChains.push(j.label);
        const c = cache[j.key];
        rows = c && Array.isArray(c.rows) ? c.rows : [];
        if (c) fromCache = true;
        addrState[j.a] = c ? 'cached' : 'failed';
      }
      return rows.map(r => Object.assign({}, r, { addr: j.a }));
    }), 3);
    for (const k of Object.keys(cache)) if (!jobs.some(j => j.key === k)) delete cache[k];
    cachePut(cache);
    walletRows = results.flat().filter(r => r.value == null || r.value >= 0.01).sort((x, y) => (y.value || 0) - (x.value || 0));
    walletState = ok === 0 && !walletRows.length ? 'blocked' : failedChains.length ? 'partial' : 'ok';
    renderWallet(); render();
  }

  // ⚠ tokens are often airdropped scams, so they never count toward a total.
  const sumOf = rows => rows.reduce((t, r) => t + (r.unverified ? 0 : r.value || 0), 0);
  const addrTotal = a => sumOf(walletRows.filter(r => r.addr === a));

  function coinLink(sym) {
    const a = document.createElement('a');
    a.className = 'coinlink'; a.href = 'coin.html?sym=' + encodeURIComponent(sym); a.textContent = sym; a.title = 'ดูกราฟ';
    return a;
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function renderAccounts() {
    const list = $('w-list'); list.textContent = '';
    for (const acct of store.accounts) {
      const box = el('div', 'acct');
      const h = el('div', 'acct-h');
      h.append(el('span', 'nm', acct.name));
      const ren = el('button', 'plain', 'แก้ชื่อ'); ren.type = 'button';
      ren.onclick = () => {
        const n = (prompt('ชื่อบัญชี', acct.name) || '').trim().slice(0, 30);
        if (n) { acct.name = n; save(); renderAccounts(); fillTargets(); }
      };
      h.append(ren);
      if (store.accounts.length > 1) {
        const del = el('button', 'ghost', 'ลบบัญชี'); del.type = 'button';
        del.onclick = () => {
          if (!confirm('ลบ "' + acct.name + '" และที่อยู่ทั้งหมดในบัญชีนี้ออกจากแอป? (เงินในกระเป๋าไม่ได้หายไปไหน)')) return;
          store.accounts = store.accounts.filter(x => x !== acct);
          store.connected = store.connected.filter(a => allAddrs().includes(a));
          save(); fillTargets(); renderConnect(); loadWallets();
        };
        h.append(del);
      }
      const loading = acct.addresses.some(a => addrState[a] === 'loading');
      h.append(el('span', 'tot', acct.addresses.length ? (loading ? '…' : usd(sumOf(walletRows.filter(r => acct.addresses.includes(r.addr))))) : '$0'));
      box.append(h);
      if (!acct.addresses.length) box.append(el('div', 'addr muted', 'ยังไม่มีที่อยู่ในบัญชีนี้ เพิ่มได้จากด้านล่าง'));
      for (const a of acct.addresses) {
        const k = kindOf(a), r = el('div', 'addr');
        r.append(el('span', 'ic ' + k, KINDS[k].icon));
        const ch = el('div', 'ch');
        ch.append(el('b', '', KINDS[k].label));
        const code = el('code', '', short(a));
        const cp = el('button', 'copy', '⧉'); cp.type = 'button'; cp.title = 'คัดลอกที่อยู่';
        cp.onclick = async () => { try { await navigator.clipboard.writeText(a); cp.textContent = '✓'; setTimeout(() => (cp.textContent = '⧉'), 1200); } catch (e) {} };
        ch.append(code, cp);
        r.append(ch);
        const st = addrState[a];
        const bal = el('div', 'bal', st === 'loading' ? '…' : st === 'failed' ? 'อ่านไม่ได้' : usd(addrTotal(a)));
        if (st === 'cached') bal.append(el('small', '', 'ยอดล่าสุดที่อ่านได้'));
        r.append(bal);
        const rm = el('button', 'ghost', 'เอาออก'); rm.type = 'button';
        rm.onclick = () => { acct.addresses = acct.addresses.filter(x => x !== a); store.connected = store.connected.filter(x => x !== a); save(); renderConnect(); loadWallets(); };
        r.append(rm);
        box.append(r);
      }
      list.append(box);
    }
  }

  function renderWallet() {
    renderAccounts();
    const tb = $('w-rows'); tb.textContent = '';
    const note = t => { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 5; td.className = 'muted'; td.textContent = t; tr.append(td); tb.append(tr); };
    if (!allAddrs().length) return note('ยังไม่ได้ใส่ที่อยู่กระเป๋า');
    if (walletState === 'loading') return note('กำลังอ่านยอดจากบล็อกเชน…');
    if (walletState === 'blocked') return note('ตอนนี้เชื่อมต่อบล็อกเชนไม่ได้ ลองกด "อ่านยอดใหม่" อีกครั้งในอีกสักครู่');
    if (!walletRows.length) note('ไม่พบเหรียญที่มีราคาในตลาดในกระเป๋า');
    const many = store.accounts.filter(x => x.addresses.length).length > 1;
    for (const r of walletRows) {
      const tr = document.createElement('tr');
      const where = r.chain + (many && accountOf(r.addr) ? ' · ' + accountOf(r.addr).name : '');
      for (const c of [r.sym, where, r.amount.toLocaleString('en-US', { maximumFractionDigits: 6 }), usd(r.price), usd(r.value)]) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
      if (!r.unverified) tr.cells[0].replaceChildren(coinLink(r.sym));
      tb.append(tr);
    }
    if (walletRows.some(r => r.unverified)) note('⚠ = เหรียญที่ยังไม่ได้รับการยืนยันหรือสภาพคล่องต่ำ ราคาอาจไม่จริง อาจเป็นเหรียญสแกมที่ถูกส่งมาเอง และไม่นับรวมในยอดรวม');
    if (walletState === 'partial') {
      note('อ่านไม่สำเร็จ: ' + [...new Set(failedChains)].join(', ') + (fromCache ? ' (แสดงยอดล่าสุดที่เคยอ่านได้แทน)' : '') + ' มักเกิดจากเว็บสำรวจบล็อกเชนจำกัดจำนวนครั้ง กด "อ่านยอดใหม่" อีกครั้งได้');
    }
  }

  function fillTargets() {
    const sel = $('a-target'), cur = sel.value;
    sel.textContent = '';
    for (const x of store.accounts) { const o = el('option', '', x.name); o.value = x.id; sel.append(o); }
    if (store.accounts.some(x => x.id === cur)) sel.value = cur;
  }
  const target = () => store.accounts.find(x => x.id === $('a-target').value) || store.accounts[0];
  $('a-new').onclick = () => {
    if (store.accounts.length >= MAX_ACCOUNTS) { $('w-msg').textContent = 'สร้างได้สูงสุด ' + MAX_ACCOUNTS + ' บัญชี'; return; }
    const n = (prompt('ตั้งชื่อบัญชีใหม่', 'บัญชี ' + (store.accounts.length + 1)) || '').trim().slice(0, 30);
    if (!n) return;
    const acct = { id: 'a' + Date.now().toString(36), name: n, addresses: [] };
    store.accounts.push(acct); save(); fillTargets(); $('a-target').value = acct.id; renderAccounts();
  };

  // Adds to the chosen account; returns a message when it can't.
  function addAddress(a, connected) {
    const owner = accountOf(a);
    if (owner) { if (connected && !store.connected.includes(a)) store.connected.push(a); return 'ที่อยู่นี้อยู่ใน "' + owner.name + '" แล้ว'; }
    const acct = target();
    if (acct.addresses.length >= MAX_PER_ACCOUNT) return 'บัญชีนี้ใส่ได้สูงสุด ' + MAX_PER_ACCOUNT + ' ที่อยู่';
    acct.addresses.push(a);
    if (connected) store.connected.push(a);
    return '';
  }

  $('w-add').onclick = () => {
    const m = $('w-msg'), v = $('w-addr').value.trim();
    const clear = t => { $('w-addr').value = ''; m.textContent = t; };
    if (v.split(/\s+/).length >= 6) return clear('นี่ดูเหมือน seed phrase! แอปไม่ได้บันทึกไว้ ห้ามให้ใครเห็นคำชุดนี้เด็ดขาด ให้ใส่เฉพาะที่อยู่กระเป๋า');
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(v) || /^\[\s*\d+(\s*,\s*\d+){31,}\s*\]$/.test(v) || /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(v)
        || /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(v) || /^S[A-Z2-7]{55}$/.test(v) || /^xprv/.test(v)) {
      return clear('นี่ดูเหมือน private key! แอปไม่ได้บันทึกไว้ ถ้าเคยให้ใครเห็นให้ย้ายเงินไปกระเป๋าใหม่ทันที ให้ใส่เฉพาะที่อยู่กระเป๋า');
    }
    const k = kindOf(v);
    if (!k) { m.textContent = 'ไม่รู้จักที่อยู่นี้ ใส่ได้: EVM (0x…), Bitcoin (bc1… / 1… / 3…), Solana, Tron (T…), Stellar (G…) กดคัดลอกจากแอปกระเป๋าได้เลย'; return; }
    const err = addAddress(norm(v), false);
    if (err) { m.textContent = err; return; }
    $('w-addr').value = ''; m.textContent = 'เพิ่ม ' + KINDS[k].label + ' เข้า "' + target().name + '" แล้ว';
    save(); loadWallets();
  };
  $('w-refresh').onclick = loadWallets;

  // Wallet connect, read-only: the app asks the wallet for its address and nothing else.
  // Only these methods are ever sent to a wallet; signing, transactions and approvals are never requested.
  const ALLOWED = new Set(['eth_requestAccounts', 'wallet_revokePermissions']);
  const ask = (provider, method, params) => {
    if (!ALLOWED.has(method)) throw new Error('blocked method ' + method);
    return provider.request(params ? { method, params } : { method });
  };
  const announced = [];
  window.addEventListener('eip6963:announceProvider', e => { if (e.detail && e.detail.provider) announced.push(e.detail); });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function evmProvider() {
    const mm = announced.find(d => d.info && d.info.rdns === 'io.metamask');
    if (mm) return { provider: mm.provider, name: 'MetaMask' };
    if (announced[0]) return { provider: announced[0].provider, name: (announced[0].info && announced[0].info.name) || 'กระเป๋า' };
    if (window.ethereum && window.ethereum.request) return { provider: window.ethereum, name: window.ethereum.isMetaMask ? 'MetaMask' : 'กระเป๋า' };
    return null;
  }
  function solProvider() {
    const p = (window.phantom && window.phantom.solana) || window.solana;
    return p && p.connect ? p : null;
  }
  const here = location.href.split('#')[0];
  function noWallet(kind) {
    const m = $('c-msg'); m.textContent = '';
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    m.append(mobile
      ? 'บนมือถือต้องเปิดแอปนี้จากเบราว์เซอร์ในแอป ' + kind + ' หรือวางที่อยู่กระเป๋าเองในช่องด้านล่าง: '
      : 'ไม่พบ ' + kind + ' ในเบราว์เซอร์นี้ ติดตั้งส่วนขยายก่อน หรือวางที่อยู่กระเป๋าเองในช่องด้านล่าง ');
    if (mobile) {
      const a = document.createElement('a');
      a.href = kind === 'MetaMask'
        ? 'https://metamask.app.link/dapp/' + here.replace(/^https?:\/\//, '')
        : 'https://phantom.app/ul/browse/' + encodeURIComponent(here) + '?ref=' + encodeURIComponent(location.origin);
      a.textContent = 'เปิดในแอป ' + kind;
      a.style.color = 'var(--blue)';
      m.append(a);
    }
  }
  function addConnected(list) {
    const errs = list.map(a => addAddress(a, true)).filter(Boolean);
    save(); renderConnect(); loadWallets();
    return errs;
  }
  let evmConn = null, solConn = null;
  $('c-evm').onclick = async () => {
    const w = evmProvider();
    if (!w) return noWallet('MetaMask');
    $('c-msg').textContent = 'กดยืนยันการเชื่อมต่อใน ' + w.name + ' (เป็นการขอดูที่อยู่เท่านั้น)';
    try {
      const accts = await ask(w.provider, 'eth_requestAccounts');
      const list = (Array.isArray(accts) ? accts : []).map(a => String(a).toLowerCase()).filter(isEvm);
      if (!list.length) { $('c-msg').textContent = 'ไม่ได้รับที่อยู่จากกระเป๋า'; return; }
      evmConn = w.provider;
      const errs = addConnected(list);
      $('c-msg').textContent = 'เชื่อม ' + w.name + ' แล้ว (ดูอย่างเดียว)' + (errs.length ? ' · ' + errs[0] : '');
    } catch (e) { $('c-msg').textContent = e && e.code === 4001 ? 'ยกเลิกการเชื่อมต่อแล้ว' : 'เชื่อมต่อไม่สำเร็จ ลองใหม่ หรือวางที่อยู่เองด้านล่าง'; }
  };
  $('c-sol').onclick = async () => {
    const p = solProvider();
    if (!p) return noWallet('Phantom');
    $('c-msg').textContent = 'กดยืนยันการเชื่อมต่อใน Phantom (เป็นการขอดูที่อยู่เท่านั้น)';
    try {
      const r = await p.connect();
      const a = String((r && r.publicKey) || p.publicKey || '');
      if (!isSol(a)) { $('c-msg').textContent = 'ไม่ได้รับที่อยู่จากกระเป๋า'; return; }
      solConn = p;
      const errs = addConnected([a]);
      $('c-msg').textContent = 'เชื่อม Phantom แล้ว (ดูอย่างเดียว)' + (errs.length ? ' · ' + errs[0] : '');
    } catch (e) { $('c-msg').textContent = e && e.code === 4001 ? 'ยกเลิกการเชื่อมต่อแล้ว' : 'เชื่อมต่อไม่สำเร็จ ลองใหม่ หรือวางที่อยู่เองด้านล่าง'; }
  };
  $('c-off').onclick = async () => {
    const w = evmConn || (evmProvider() || {}).provider;
    if (w && store.connected.some(isEvm)) { try { await ask(w, 'wallet_revokePermissions', [{ eth_accounts: {} }]); } catch (e) {} }
    const s = solConn || solProvider();
    if (s && s.disconnect && store.connected.some(isSol)) { try { await s.disconnect(); } catch (e) {} }
    for (const x of store.accounts) x.addresses = x.addresses.filter(a => !store.connected.includes(a));
    store.connected = [];
    evmConn = solConn = null;
    save(); renderConnect(); loadWallets();
    $('c-msg').textContent = 'ตัดการเชื่อมต่อแล้ว และเอาที่อยู่ที่เชื่อมไว้ออกจากรายการ';
  };
  function renderConnect() { $('c-off').hidden = !store.connected.length; }
  renderConnect();
  fillTargets();


  // ---- Price targets (stored by alerts.js under their own key) ----
  const symOk = s => /^[A-Z0-9.$_-]{1,20}$/.test(s);
  function renderTargets() {
    const A = window.CRAlerts; if (!A) return;
    const perm = A.permission();
    $('t-perm').textContent = perm === 'granted' ? 'เปิดแจ้งเตือนแล้ว' : perm === 'denied' ? 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ เปิดได้ในการตั้งค่าเว็บไซต์' : perm === 'unsupported' ? 'เครื่องนี้ไม่รองรับ (iPhone ต้องติดตั้งแอปลงหน้าจอโฮมก่อน)' : '';
    $('t-notify').hidden = perm === 'granted';
    const tb = $('t-rows'); tb.textContent = '';
    const list = A.list();
    if (!list.length) { const tr = el('tr'), td = el('td', 'muted', 'ยังไม่ได้ตั้งราคาเป้าหมาย'); td.colSpan = 7; tr.append(td); tb.append(tr); return; }
    for (const t of list) {
      const tr = el('tr');
      const gap = t.last ? (t.price - t.last) / t.last * 100 : null;
      const cells = [null, t.dir === 'above' ? 'ขึ้นถึง' : 'ลงถึง', usd(t.price), t.last ? usd(t.last) : '…', t.hit_at ? '–' : gap == null ? '–' : (gap >= 0 ? '+' : '') + gap.toFixed(1) + '%',
        t.hit_at ? 'ถึงแล้ว ' + new Date(t.hit_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : 'รอ'];
      for (const c of cells) tr.append(el('td', '', c));
      tr.cells[0].append(coinLink(t.sym)); if (t.note) tr.cells[0].append(el('div', 'muted', t.note));
      if (t.hit_at) tr.cells[5].className = 'pos';
      const td = el('td');
      if (t.hit_at) { const re = el('button', 'plain', 'ตั้งใหม่'); re.type = 'button'; re.style.padding = '5px 10px'; re.onclick = () => A.rearm(t.key); td.append(re, ' '); }
      const rm = el('button', 'ghost', 'ลบ'); rm.type = 'button'; rm.onclick = () => A.remove(t.key);
      td.append(rm); tr.append(td); tb.append(tr);
    }
  }
  $('t-add').onclick = () => {
    const m = $('t-msg'), sym = $('t-sym').value.trim().toUpperCase(), price = Number($('t-price').value);
    if (!symOk(sym)) { m.textContent = 'ใส่ชื่อเหรียญ เช่น SAND หรือ BTC'; return; }
    if (!(price > 0)) { m.textContent = 'ใส่ราคาเป้าหมายเป็นดอลลาร์'; return; }
    if (window.CRAlerts.list().length >= 30) { m.textContent = 'ตั้งได้สูงสุด 30 รายการ'; return; }
    window.CRAlerts.add({ sym, dir: $('t-dir').value, price, note: $('t-note').value.trim().slice(0, 60) });
    $('t-sym').value = ''; $('t-price').value = ''; $('t-note').value = '';
    m.textContent = 'ตั้งเป้า ' + sym + ' แล้ว' + (window.CRAlerts.permission() === 'granted' ? '' : ' · กด "เปิดการแจ้งเตือน" ด้วย เพื่อให้เด้งเตือนบนเครื่อง');
  };
  $('t-notify').onclick = async () => { await window.CRAlerts.enableNotifications(); renderTargets(); };
  if (window.CRAlerts) window.CRAlerts.onChange(renderTargets);

  // ---- Trade log ----
  const money = (n, cur) => n == null || !isFinite(n) ? '–' : (cur === 'THB' ? '฿' : '$') + (Math.abs(n) < 1 && n !== 0 ? n.toPrecision(4) : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const sortedTrades = () => store.trades.slice().sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
  // Average-cost method, per coin and currency.
  function summarize() {
    const by = new Map();
    for (const t of sortedTrades()) {
      const k = t.sym + '|' + t.cur;
      const s = by.get(k) || { sym: t.sym, cur: t.cur, qty: 0, cost: 0, realized: 0, oversold: false };
      if (t.type === 'buy') { s.qty += t.amount; s.cost += t.amount * t.price + (t.fee || 0); }
      else {
        const avg = s.qty > 0 ? s.cost / s.qty : 0, q = Math.min(t.amount, s.qty);
        if (t.amount > s.qty + 1e-12) s.oversold = true;
        s.realized += t.amount * t.price - (t.fee || 0) - avg * q;
        s.cost -= avg * q; s.qty -= q;
      }
      by.set(k, s);
    }
    return [...by.values()];
  }
  function renderTrades() {
    const sb = $('r-sum'); sb.textContent = '';
    const sums = summarize();
    if (!sums.length) { const tr = el('tr'), td = el('td', 'muted', 'ยังไม่มีรายการ'); td.colSpan = 6; tr.append(td); sb.append(tr); }
    for (const s of sums) {
      const tr = el('tr');
      for (const c of [null, s.cur, s.qty.toLocaleString('en-US', { maximumFractionDigits: 8 }), s.qty > 0 ? money(s.cost / s.qty, s.cur) : '–', money(s.cost, s.cur), (s.realized >= 0 ? '+' : '') + money(s.realized, s.cur)]) tr.append(el('td', '', c));
      tr.cells[0].append(coinLink(s.sym));
      if (s.oversold) tr.cells[0].append(el('div', 'muted', 'ขายมากกว่าที่บันทึกว่าซื้อ'));
      tr.cells[5].className = s.realized >= 0 ? 'pos' : 'neg';
      sb.append(tr);
    }
    const tb = $('r-rows'); tb.textContent = '';
    const list = sortedTrades().reverse();
    if (!list.length) { const tr = el('tr'), td = el('td', 'muted', 'ยังไม่มีรายการ'); td.colSpan = 9; tr.append(td); tb.append(tr); }
    for (const t of list) {
      const tr = el('tr');
      const total = t.type === 'buy' ? t.amount * t.price + (t.fee || 0) : t.amount * t.price - (t.fee || 0);
      for (const c of [t.date, t.type === 'buy' ? 'ซื้อ' : 'ขาย', t.sym, t.amount.toLocaleString('en-US', { maximumFractionDigits: 8 }), money(t.price, t.cur), money(t.fee || 0, t.cur), money(total, t.cur), t.ex || '']) tr.append(el('td', '', c));
      tr.cells[1].className = t.type === 'buy' ? 'pos' : 'neg';
      if (t.note) tr.cells[7].append(el('div', 'muted', t.note));
      const td = el('td'), rm = el('button', 'ghost', 'ลบ'); rm.type = 'button';
      rm.onclick = () => { if (!confirm('ลบรายการนี้?')) return; store.trades = store.trades.filter(x => x.id !== t.id); save(); renderTrades(); };
      td.append(rm); tr.append(td); tb.append(tr);
    }
  }
  $('r-date').value = new Date().toISOString().slice(0, 10);
  $('r-add').onclick = () => {
    const m = $('r-msg');
    const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: $('r-date').value, type: $('r-type').value, sym: $('r-sym').value.trim().toUpperCase(),
      amount: Number($('r-amount').value), price: Number($('r-price').value), cur: $('r-cur').value, fee: Number($('r-fee').value || 0), ex: $('r-ex').value, note: $('r-note').value.trim().slice(0, 80) };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) { m.textContent = 'ใส่วันที่'; return; }
    if (!symOk(t.sym)) { m.textContent = 'ใส่ชื่อเหรียญ เช่น BTC'; return; }
    if (!(t.amount > 0) || !(t.price >= 0) || $('r-price').value === '' || !(t.fee >= 0)) { m.textContent = 'ใส่จำนวนเหรียญและราคาให้ถูกต้อง'; return; }
    store.trades.push(t);
    if (save()) { m.textContent = 'บันทึก' + (t.type === 'buy' ? 'การซื้อ' : 'การขาย') + ' ' + t.sym + ' แล้ว'; $('r-amount').value = ''; $('r-price').value = ''; $('r-fee').value = ''; $('r-note').value = ''; }
    renderTrades();
  };
  $('r-csv').onclick = () => {
    const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    // A leading = + - @ would make Excel treat a cell as a formula.
    const safe = v => { const s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) && isNaN(Number(s)) ? "'" + s : s; };
    const head = ['date', 'type', 'coin', 'amount', 'price_per_coin', 'currency', 'fee', 'total', 'exchange', 'note'];
    const lines = [head.join(',')];
    for (const t of sortedTrades()) {
      const total = t.type === 'buy' ? t.amount * t.price + (t.fee || 0) : t.amount * t.price - (t.fee || 0);
      lines.push([t.date, t.type, t.sym, t.amount, t.price, t.cur, t.fee || 0, +total.toFixed(8), t.ex, t.note].map(v => q(safe(v))).join(','));
    }
    lines.push('');
    lines.push(['summary_coin', 'currency', 'holding', 'avg_cost', 'cost_of_holding', 'realized_pl'].join(','));
    for (const s of summarize()) lines.push([s.sym, s.cur, s.qty, s.qty > 0 ? +(s.cost / s.qty).toFixed(8) : '', +s.cost.toFixed(8), +s.realized.toFixed(8)].map(v => q(safe(v))).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'crypto-trades-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $('r-msg').textContent = 'ดาวน์โหลดไฟล์ CSV แล้ว';
  };

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
      tr.cells[0].replaceChildren(coinLink(h.asset));
      const tdp = document.createElement('td');
      if (pl != null) { tdp.textContent = (pl >= 0 ? '+' : '') + usd(pl) + (cost ? ` (${(pl / cost * 100).toFixed(1)}%)` : ''); tdp.className = pl >= 0 ? 'pos' : 'neg'; } else tdp.textContent = '–';
      tr.append(tdp);
      const tdd = document.createElement('td'), b = document.createElement('button');
      b.className = 'ghost'; b.type = 'button'; b.textContent = 'ลบ';
      b.onclick = () => { store.holdings = store.holdings.filter(x => x.id !== h.id); save(); render(); };
      tdd.append(b); tr.append(tdd); tb.append(tr);
    }
    const wv = sumOf(walletRows);
    $('k-wallet').textContent = allAddrs().length ? usd(wv) : '–';
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
    const blob = new Blob([JSON.stringify({ app: 'crypto-radar', version: 3, exported_at: new Date().toISOString(), ...store, targets: window.CRAlerts ? window.CRAlerts.list() : [] }, null, 2)], { type: 'application/json' });
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
      const raw = JSON.parse(await f.text());
      const next = clean(raw);
      if (!confirm(`นำเข้า ${next.holdings.length} เหรียญ และ ${next.accounts.reduce((t, x) => t + x.addresses.length, 0)} ที่อยู่ใน ${next.accounts.length} บัญชี และ ${next.trades.length} รายการซื้อขาย แทนข้อมูลเดิมในเครื่องนี้?`)) return;
      store = next; save(); fillTargets(); renderConnect(); render(); renderTrades(); loadWallets();
      if (Array.isArray(raw.targets)) { try { localStorage.setItem('crypto-radar:targets:v1', JSON.stringify(raw.targets)); } catch (e2) {} renderTargets(); }
      $('b-msg').textContent = 'นำเข้าเรียบร้อย';
    } catch (err) { $('b-msg').textContent = 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปนี้'; }
  };

  // Another tab or window changed the portfolio.
  window.addEventListener('storage', e => { if (e.key === KEY) { store = read(); fillTargets(); renderConnect(); render(); renderTrades(); loadWallets(); } });

  fetch('data/prices.json', { cache: 'no-cache' }).then(r => r.json()).then(j => {
    const rows = Array.isArray(j) ? j : (j && j.rows) || [];
    prices = rows.filter(r => r && typeof r.token === 'string');
    const asOf = prices.map(p => p.as_of).filter(Boolean).sort().pop();
    $('asof').textContent = asOf ? 'ราคาล่าสุด ณ ' + asOf + ' · อัปเดตทุกเช้าประมาณ 06:47 น.' : '';
    fillSelect(); render();
  }).catch(() => { $('asof').textContent = 'โหลดราคาไม่ได้'; fillSelect(); render(); });

  render(); renderTargets(); renderTrades(); loadWallets();
})();
