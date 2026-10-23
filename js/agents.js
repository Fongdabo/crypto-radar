// One agent per activity (data/agents/<id>.json, written by Claude's scheduled research). The agents do the research, the
// link checks and the bookkeeping: on any page they read the chain (public explorers, read-only) to see what the user already
// did, close steps on their own, and gather what truly needs the user (a signature, a wallet connection on a site, KYC) into
// one short list with ready-made links. They never ask the wallet to sign anything: the user signs in their own wallet.
(function () {
  const KEY = 'crypto-radar:agents:v1';
  const NOTIFIED_KEY = 'crypto-radar:agents-notified:v1';
  const EN = window.CR_LANG === 'en';
  const T = (th, en) => (EN ? en : th);
  const locale = window.CR_LOCALE || 'th-TH';
  // Public Blockscout APIs, read-only.
  const EXPLORERS = {
    base: { api: 'https://base.blockscout.com/api/v2', web: 'https://base.blockscout.com', name: 'Base' },
    ink: { api: 'https://explorer.inkonchain.com/api/v2', web: 'https://explorer.inkonchain.com', name: 'Ink' },
    eth: { api: 'https://eth.blockscout.com/api/v2', web: 'https://eth.blockscout.com', name: 'Ethereum' },
    polygon: { api: 'https://polygon.blockscout.com/api/v2', web: 'https://polygon.blockscout.com', name: 'Polygon' },
    optimism: { api: 'https://optimism.blockscout.com/api/v2', web: 'https://optimism.blockscout.com', name: 'Optimism' },
    arbitrum: { api: 'https://arbitrum.blockscout.com/api/v2', web: 'https://arbitrum.blockscout.com', name: 'Arbitrum' },
  };
  // Chains without a keyless explorer API: plain JSON-RPC (balance and transaction count only).
  const RPC = { abstract: { url: 'https://api.mainnet.abs.xyz', web: 'https://abscan.org', name: 'Abstract' } };

  const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } };
  function load() {
    const s = readJson(KEY, {});
    const ok = a => (/^0x[0-9a-fA-F]{40}$/.test(a || '') ? a : '');
    const obj = o => (o && typeof o === 'object' ? o : {});
    return { addr: ok(s.addr), main: ok(s.main), steps: obj(s.steps), checks: obj(s.checks) };
  }
  let state = load();
  // Up to v20 one transaction could be credited to two steps in a row; drop the second (no tx hash was stored then).
  (function fixDoubleCredit() {
    let changed = false;
    for (const [k, v] of Object.entries(state.steps)) {
      if (!v || !v.proof || v.tx !== undefined || !/:repeat$/.test(k)) continue;
      const ag = k.split(':')[0];
      if (Object.entries(state.steps).some(([k2, v2]) => k2 !== k && k2.startsWith(ag + ':') && v2 && v2.proof === v.proof && v2.tx === undefined && Math.abs(Date.parse(v2.done_at) - Date.parse(v.done_at)) < 30 * 60e3)) { delete state.steps[k]; changed = true; }
    }
    if (changed) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  const st = (a, s) => state.steps[a.id + ':' + s.id] || {};
  // The main wallet: typed on the agents page, else the first other 0x address saved on the portfolio page.
  function mainAddr() {
    if (state.main) return state.main;
    const pf = readJson('crypto-radar:portfolio:v1', {});
    const all = [...(Array.isArray(pf.accounts) ? pf.accounts : []).flatMap(x => (x && Array.isArray(x.addresses) ? x.addresses : [])), ...(Array.isArray(pf.addresses) ? pf.addresses : [])];
    return all.find(a => /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== state.addr.toLowerCase()) || '';
  }
  const walletOf = w => (w === 'main' ? mainAddr() : state.addr);
  const short = a => a.slice(0, 6) + '…' + a.slice(-4);
  const autoAddrs = s => [...new Set((s.auto.wallets || ['main']).map(walletOf).filter(Boolean))];
  function setSt(a, s, patch) { const k = a.id + ':' + s.id; state.steps[k] = Object.assign({}, state.steps[k], patch); save(); }

  const DAY = 864e5;
  const daysTo = iso => Math.round((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / DAY);
  const prevOf = (a, s) => { const mine = (a.steps || []).filter(x => x.who !== 'agent'), i = mine.indexOf(s); return i > 0 ? st(a, mine[i - 1]) : {}; };
  // When a repeating step next opens: repeat_days after it was last done. With first_wait, its first round also waits repeat_days
  // after the step before it (so it never asks again the same day).
  function repeatAt(a, s) {
    const x = st(a, s), t = Date.parse(x.done_at || (s.first_wait ? prevOf(a, s).done_at : '') || '');
    return isNaN(t) ? NaN : t + s.repeat_days * DAY;
  }
  const pastDue = s => !!s.due && daysTo(s.due) < 0;
  // A step is open until done or skipped (or its date has passed); a repeating step opens at repeatAt.
  function isOpen(a, s) {
    if (s.who === 'agent') return false;
    const x = st(a, s);
    if (x.skipped || (pastDue(s) && !s.repeat_days)) return false;
    // A step that only makes sense after another one (`after`) closes when that one was answered "not for me".
    if (s.after) { const p = (a.steps || []).find(t => t.id === s.after); if (p && st(a, p).skipped) return false; }
    if (s.repeat_days) return !(Date.now() < repeatAt(a, s));
    return !x.done_at;
  }
  const nextStep = a => (a.status === 'paused' ? null : (a.steps || []).find(s => isOpen(a, s)) || null);
  // When a step became the user's turn: when it was last done (a repeating step) or the previous step was done, else 7 days back.
  // A transaction signed before pressing "ready" still counts; one already credited to another step does not (see usedTx).
  function stepStart(a, s) {
    const x = st(a, s), t = Date.parse(x.done_at || prevOf(a, s).done_at || '');
    if (!isNaN(t)) return t;
    const ready = Date.parse(x.ready_at || '');
    return isNaN(ready) ? Date.now() - 7 * DAY : ready - 2 * 60e3;
  }
  const usedTx = a => new Set((a.steps || []).map(s => st(a, s).tx).filter(Boolean));
  function progress(a) {
    const mine = (a.steps || []).filter(s => s.who !== 'agent');
    if (!mine.length) return 1;
    return mine.filter(s => !isOpen(a, s)).length / mine.length;
  }

  async function fetchAgents() {
    const idx = await fetch('data/agents/index.json', { cache: 'no-cache' }).then(r => r.json());
    const ids = (Array.isArray(idx.agents) ? idx.agents : []).filter(x => /^[a-z0-9-]{1,30}$/.test(x));
    const list = await Promise.all(ids.map(id => fetch('data/agents/' + id + '.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => null)));
    return list.filter(a => a && a.id && Array.isArray(a.steps));
  }

  // ---- what needs the user now: the next open step of each agent ----
  const NEED = {
    sign: () => T('🖊️ ต้องเซ็นใน MetaMask', '🖊️ Needs your MetaMask signature'),
    connect: () => T('🔌 ต้องเชื่อมกระเป๋าบนเว็บ', '🔌 Needs your wallet connected on the site'),
    kyc: () => T('🪪 ต้องยืนยันตัวตนเอง', '🪪 Needs your own identity check'),
    setting: () => T('⚙️ ตั้งค่าใน MetaMask ของคุณ', '⚙️ A setting in your MetaMask'),
    app: () => T('📱 ทำในแอปของคุณ', '📱 Done in your own app'),
  };
  const needOf = s => (NEED[s.need] ? s.need : s.kind === 'sign' ? 'sign' : 'connect');
  function tasks() {
    const out = [];
    for (const a of agents) {
      if (a.status === 'paused') continue;
      const s = nextStep(a);
      if (s) out.push({ a, s });
      // A later step whose own check found something for the user joins the round too.
      for (const t of a.steps) if (t !== s && t.auto && isOpen(a, t) && (state.checks[a.id + ':' + t.id] || {}).ok === false && !(state.checks[a.id + ':' + t.id] || {}).err) out.push({ a, s: t });
    }
    const rank = t => (t.s.due ? daysTo(t.s.due) : 999);
    return out.sort((x, y) => rank(x) - rank(y));
  }
  const minsOf = list => list.reduce((n, t) => n + (Number(t.s.mins) || 3), 0);

  // One notification for the whole round: when the list changes, every 3 days while it waits, daily when a date is 3 days away.
  function notifyTasks() {
    if (!window.CRAlerts) return;
    const list = tasks();
    if (!list.length) return;
    const sent = readJson(NOTIFIED_KEY, {}), day = new Date().toISOString().slice(0, 10), last = sent.batch || {};
    const keys = list.map(t => t.a.id + ':' + t.s.id).sort().join(',');
    const urgent = list.some(t => t.s.due && daysTo(t.s.due) <= 3);
    if (last.day === day) return;
    if (last.keys === keys && !urgent && Date.now() - Date.parse(last.at || 0) < 3 * DAY) return;
    sent.batch = { day, keys, at: new Date().toISOString() };
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(sent)); } catch (e) {}
    window.CRAlerts.notify(T('เอเจนต์: รอบนี้มี ' + list.length + ' อย่างที่ต้องใช้คุณ', 'Agents: ' + list.length + ' things need you this round'),
      T('ประมาณ ' + minsOf(list) + ' นาที · ', 'About ' + minsOf(list) + ' min · ') + list.slice(0, 2).map(t => t.s.title).join(' · '), { href: 'agents.html', kind: 'agent' });
  }

  // ---- on-chain checks (read-only) ----
  const getJson = u => fetch(u, { headers: { accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const SEL = { '0x095ea7b3': 'approve', '0x39509351': 'increaseAllowance', '0xa22cb465': 'setApprovalForAll' };
  // Read-only checks a step can carry in `auto`: { kind: 'unused', chain, wallets } (never used a chain and holds nothing there),
  // or { kind: 'no-approvals', chains, wallets } (no token permission still standing from an approve transaction).
  async function autoCheck(s) {
    const c = s.auto, addrs = autoAddrs(s);
    if (!addrs.length) return null;
    if (c.kind === 'unused') {
      const net = RPC[c.chain];
      if (!net) return null;
      const rpc = (method, params) => fetch(net.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
        .then(r => r.json()).then(j => { if (j.error || typeof j.result !== 'string') throw new Error('rpc'); return BigInt(j.result); });
      const found = [];
      for (const a of addrs) {
        const [bal, n] = await Promise.all([rpc('eth_getBalance', [a, 'latest']), rpc('eth_getTransactionCount', [a, 'latest'])]);
        if (bal > 0n || n > 0n) found.push(short(a) + ': ' + (Number(bal) / 1e18).toFixed(5) + ' ETH · ' + n + T(' ธุรกรรม', ' transactions'));
      }
      return found.length
        ? { ok: false, text: T('พบการใช้งานบน ', 'Found activity on ') + net.name + ' — ' + found.join(' · '), link: net.web + '/address/' + addrs[0] }
        : { ok: true, text: T('ตรวจกระเป๋า ' + addrs.length + ' ใบแล้ว ไม่เคยใช้ ' + net.name + ' และไม่มียอดค้าง', 'Checked ' + addrs.length + ' wallets: never used ' + net.name + ', nothing left there') };
    }
    if (c.kind === 'no-approvals') {
      const found = [], names = [];
      for (const a of addrs) for (const chain of c.chains || []) {
        const ex = EXPLORERS[chain];
        if (!ex) continue;
        names.includes(ex.name) || names.push(ex.name);
        const seen = new Set();
        let next = null;
        // Newest first, so the first transaction seen for a token and spender is the one that still stands.
        for (let page = 0; page < 5; page++) {
          const j = await getJson(ex.api + '/addresses/' + a + '/transactions?filter=from' + (next ? '&' + new URLSearchParams(next) : '')).catch(e => { if (String(e.message) === '404') return {}; throw e; });
          for (const t of j.items || []) {
            const raw = String(t.raw_input || '').toLowerCase(), m = SEL[raw.slice(0, 10)];
            if (!m || !t.to || !(t.status === 'ok' || t.result === 'success')) continue;
            const k = t.to.hash.toLowerCase() + raw.slice(34, 74);
            if (seen.has(k)) continue;
            seen.add(k);
            if (/[1-9a-f]/.test(raw.slice(74, 138))) found.push(ex.name + ': ' + (t.to.name || short(t.to.hash)) + ' (' + m + ')');
          }
          next = j.next_page_params;
          if (!next) break;
        }
      }
      return found.length
        ? { ok: false, text: T('พบสิทธิ์ที่ยังเปิดอยู่ ' + found.length + ' รายการ: ', found.length + ' permissions still open: ') + found.slice(0, 6).join(' · '), link: 'https://revoke.cash/address/' + addrs[0] }
        : { ok: true, text: T('ตรวจ ' + names.join(', ') + ' แล้ว ไม่มีสิทธิ์ Approve ค้างอยู่', 'Checked ' + names.join(', ') + ': no approvals left open') };
    }
    return null;
  }

  // ---- on-chain check of the user's own transaction for a sign step ----
  async function verify(s, since, used) {
    const ex = s.verify && EXPLORERS[s.verify.chain];
    if (!ex || !state.addr) return null;
    const get = getJson;
    if (s.verify.kind === 'balance') {
      const j = await get(ex.api + '/addresses/' + state.addr).catch(e => { if (String(e.message) === '404') return {}; throw e; });
      const bal = Number(j.coin_balance || 0) / 1e18;
      return { ok: bal > 0, text: bal > 0 ? T('พบยอด ' + bal.toFixed(5) + ' ETH บน ' + ex.name, 'Found ' + bal.toFixed(5) + ' ETH on ' + ex.name) : T('ยังไม่เห็นยอดบน ' + ex.name, 'No balance on ' + ex.name + ' yet'), link: ex.web + '/address/' + state.addr };
    }
    const j = await get(ex.api + '/addresses/' + state.addr + '/transactions?filter=from');
    // Oldest new transaction first, so steps done in a row each get their own.
    const tx = (j.items || []).filter(t => Date.parse(t.timestamp) >= since && !(used && used.has(t.hash))).pop();
    if (!tx) return { ok: false, text: T('ยังไม่เห็นธุรกรรมใหม่จากกระเป๋าฟาร์มบน ' + ex.name + ' (อาจต้องรอ 1–2 นาที)', 'No new transaction from the farm wallet on ' + ex.name + ' yet (may take 1–2 minutes)') };
    const to = tx.to ? (tx.to.name || tx.to.hash.slice(0, 10) + '…') : '?';
    const ok = tx.status === 'ok' || tx.result === 'success';
    return { ok, tx: tx.hash, text: (ok ? T('สำเร็จ: ', 'Success: ') : T('ธุรกรรมล้มเหลว: ', 'Transaction failed: ')) + (tx.method || 'tx') + ' → ' + to, link: ex.web + '/tx/' + tx.hash };
  }

  // The agents' rounds: run the read-only checks, close what is done, and look for the user's transactions without being asked.
  let running = false;
  async function runChecks(force) {
    if (running || !agents.length) return;
    running = true;
    let changed = false;
    const now = () => new Date().toISOString();
    const due = k => force || !state.checks[k] || Date.now() >= Date.parse(state.checks[k].next || 0);
    try {
      for (const a of agents) {
        if (a.status === 'paused') continue;
        for (const s of a.steps) {
          const k = a.id + ':' + s.id;
          if (!s.auto || !isOpen(a, s) || !due(k)) continue;
          let r;
          try { r = await autoCheck(s); } catch (e) { r = { ok: false, err: true, text: T('ตรวจบนเชนไม่ได้ตอนนี้ จะลองใหม่รอบหน้า', 'Could not check the chain now; will try again next round') }; }
          if (!r) continue;
          state.checks[k] = { at: now(), next: new Date(Date.now() + (r.err ? 10 * 60e3 : 6 * 3600e3)).toISOString(), ok: r.ok, err: !!r.err, text: r.text, link: r.link || '' };
          changed = true;
          if (r.ok || (!r.err && s.auto.found_done)) {
            state.steps[k] = { done_at: now(), skipped: false, proof: r.text, by: 'agent' };
            if (r.ok) for (const id of s.auto.skip || []) {
              const t = a.steps.find(x => x.id === id);
              if (t && isOpen(a, t)) state.steps[a.id + ':' + id] = { done_at: now(), skipped: true, proof: s.auto.skip_note || T('ไม่ต้องทำ', 'Not needed'), by: 'agent' };
            }
          }
        }
        // A sign step closes itself once its transaction shows up, several steps in a row if the user did them all.
        for (let i = 0; i < 10; i++) {
          const s = nextStep(a), k = s && a.id + ':' + s.id;
          if (!s || !s.verify || !state.addr || !(force || !state.checks[k] || Date.now() - Date.parse(state.checks[k].at) >= 3 * 60e3)) break;
          let r = null;
          try { r = await verify(s, stepStart(a, s), usedTx(a)); } catch (e) {}
          if (!r) break;
          state.checks[k] = { at: now(), ok: r.ok, text: r.text, link: r.link || '' };
          changed = true;
          if (!r.ok) break;
          state.steps[k] = { done_at: now(), skipped: false, proof: r.text, tx: r.tx || '', by: 'agent' };
        }
      }
    } finally {
      running = false;
      if (changed) { save(); rerender(); }
    }
  }

  // ---- page: a chat per agent, PM style. The agent's messages are built from its queue and this device's progress. ----
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const data = (tag, cls, text) => { const e = h(tag, cls, text); e.dataset.noI18n = ''; return e; };
  const safeUrl = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? u : null);
  const when = iso => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  let agents = [], openId = null;

  function badge(a) {
    if (a.status === 'paused') return h('span', 'pill stop', T('หยุดไว้', 'Paused'));
    const s = nextStep(a);
    if (!s) return h('span', 'pill ok', a.status === 'watch' ? T('เฝ้าดู', 'Watching') : T('ครบแล้ว', 'All done'));
    if (needOf(s) === 'sign') return h('span', 'pill sign', T('รอคุณเซ็น', 'Needs signature'));
    return h('span', 'pill', T('รอคุณ', 'Your turn'));
  }
  const order = a => (a.status === 'paused' ? 3 : !nextStep(a) ? 2 : needOf(nextStep(a)) === 'sign' ? 0 : 1);

  function renderList() {
    const g = document.getElementById('ag-list');
    g.replaceChildren();
    for (const a of agents.slice().sort((x, y) => order(x) - order(y))) {
      const c = h('a', 'row' + (a.id === openId ? ' on' : '')); c.href = '#' + a.id;
      const s = nextStep(a);
      const av = data('span', 'av', a.emoji || '🤖');
      const mid = h('span', 'mid');
      mid.append(data('b', '', a.name), data('span', 'last', s ? s.title : a.status_text || ''));
      c.append(av, mid, badge(a));
      g.append(c);
    }
  }

  // Message bubbles.
  function bot(a, ...kids) { const m = h('div', 'msg bot'); m.append(data('span', 'av', a.emoji || '🤖')); const b = h('div', 'bub'); b.append(...kids); m.append(b); return m; }
  function me(text, at) { const m = h('div', 'msg me'); const b = h('div', 'bub', text); if (at) b.append(h('span', 'tm', when(at))); m.append(b); return m; }
  const btn = (text, cls, fn) => { const b = h('button', 'btn ' + (cls || ''), text); b.type = 'button'; b.onclick = fn; return b; };
  const list = (tag, items, cls) => { const l = h(tag, cls); for (const t of items || []) l.append(data('li', '', t)); return l; };

  function renderChat() {
    const box = document.getElementById('ag-chat'), shell = document.getElementById('ag-shell');
    const a = agents.find(x => x.id === openId);
    shell.classList.toggle('open', !!a);
    if (!a) { box.replaceChildren(h('div', 'empty', T('เลือกเอเจนต์ทางซ้ายเพื่อดูแชท', 'Pick an agent on the left to open its chat'))); return; }
    const back = h('a', 'back', '‹'); back.href = '#';
    const [head, body, form] = chatView(a, back);
    box.replaceChildren(head, body, form);
    body.scrollTop = body.scrollHeight;
  }

  // The conversation with one agent: a header and the message list. `back` is the element that leads back to the list.
  function chatView(a, back) {
    const head = h('div', 'chead');
    back.title = T('กลับ', 'Back');
    const t = h('div', 'ct'); t.append(data('b', '', (a.emoji ? a.emoji + ' ' : '') + T('เอเจนต์ ', 'Agent ') + a.name), data('span', 'meta', [a.type, a.schedule].filter(Boolean).join(' · ')));
    head.append(back, t, badge(a));
    const body = h('div', 'cbody');

    // Intro: status, official links, warning.
    const intro = [data('p', '', a.status_text || '')];
    const links = h('div', 'links');
    for (const l of a.official || []) { const u = safeUrl(l.u); if (!u) continue; const x = data('a', '', '🔗 ' + l.t); x.href = u; x.target = '_blank'; x.rel = 'noopener'; links.append(x); }
    if (links.children.length) intro.push(h('div', 'meta', T('เว็บทางการที่ตรวจแล้ว กดจากตรงนี้เท่านั้น:', 'Checked official sites, open them only from here:')), links);
    if (a.warn) intro.push(data('div', 'danger', '⚠️ ' + a.warn));
    if (a.budget) intro.push(data('div', 'meta', T('งบ: ', 'Budget: ') + a.budget));
    body.append(bot(a, ...intro));

    const cur = nextStep(a);
    for (const s of a.steps) {
      const x = st(a, s);
      if (s.who === 'agent') { body.append(bot(a, data('b', '', (s.kind === 'watch' ? '👀 ' : '🔎 ') + s.title), s.result ? data('p', '', s.result) : '', s.due ? h('div', 'meta', dueText(s.due)) : '')); continue; }
      if (x.done_at && s !== cur) {
        if (x.by === 'agent') {
          body.append(bot(a, data('b', '', (x.skipped ? '⏭️ ' : '✅ ') + s.title), data('p', 'meta', T('เอเจนต์ปิดให้เอง: ', 'Closed by the agent: ') + (x.proof || '')), h('span', 'tm', when(x.done_at))));
        } else {
          body.append(bot(a, data('b', '', (s.kind === 'sign' ? '🖊️ ' : '👤 ') + s.title)));
          body.append(me(x.skipped ? T('ไม่เกี่ยวกับฉัน', 'Not for me') : T('ทำแล้ว ✅', 'Done ✅'), x.done_at));
          if (x.proof) body.append(bot(a, data('p', '', '✅ ' + x.proof)));
        }
        if (s.repeat_days && !x.skipped) body.append(bot(a, h('div', 'meta', T('จะชวนทำอีกครั้ง ', 'I will ask again on ') + new Date(repeatAt(a, s)).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))));
        continue;
      }
      if (s.repeat_days && s.first_wait && !x.done_at && !x.skipped && s !== cur && prevOf(a, s).done_at) {
        body.append(bot(a, data('b', '', '🖊️ ' + s.title), h('div', 'meta', T('จะชวนทำครั้งแรก ', 'I will first ask on ') + new Date(repeatAt(a, s)).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))));
        continue;
      }
      if (!x.done_at && pastDue(s) && !s.repeat_days) { body.append(bot(a, data('b', '', '⌛ ' + s.title), h('div', 'meta', T('เลยกำหนดแล้ว เอเจนต์ปิดไว้', 'Past its date; closed')))); continue; }
      if (s !== cur) continue;
      body.append(bot(a, task(a, s, false)));
    }
    if (!cur) body.append(bot(a, h('p', '', a.status === 'paused' ? T('ตอนนี้หยุดไว้ก่อน ถ้าสถานการณ์เปลี่ยนผมจะทักมาครับ', 'Paused for now. I will message you if things change.') : T('ตอนนี้ไม่มีงานรอคุณ มีข่าวหรือขั้นใหม่เมื่อไรผมจะทักมาครับ', 'Nothing waiting for you. I will message you when there is news or a new step.'))));
    for (const q of asked[a.id] || []) body.append(me(q.q, q.at), bot(a, ...answer(a, q.q)));
    return [head, body, askBox(a)];
  }

  // Typing a question: the app has no AI of its own (it is a static page), so it answers from what the agent already knows
  // (its notes, steps and checks) and hands the question, with that context, to Claude in one tap.
  const asked = {}, drafts = {};
  function askBox(a) {
    const f = h('form', 'askf'), inp = h('input');
    inp.type = 'text'; inp.placeholder = T('ถามเอเจนต์ ' + a.name + '…', 'Ask the ' + a.name + ' agent…'); inp.value = drafts[a.id] || ''; inp.dataset.agent = a.id;
    inp.oninput = () => { drafts[a.id] = inp.value; };
    const go = h('button', 'btn pri', T('ส่ง', 'Send')); go.type = 'submit';
    f.append(inp, go);
    f.onsubmit = e => {
      e.preventDefault();
      const q = inp.value.trim().slice(0, 300);
      if (!q) return;
      (asked[a.id] = asked[a.id] || []).push({ q, at: new Date().toISOString() });
      drafts[a.id] = '';
      rerender();
      const i = document.querySelector('.askf input[data-agent="' + a.id + '"]'); if (i) i.focus();
    };
    return f;
  }
  // Every sentence the agent knows, and the ones that share the most two-letter pieces with the question (works for Thai,
  // which has no spaces between words).
  function answer(a, q) {
    const facts = [a.status_text, a.warn, a.budget && T('งบ: ', 'Budget: ') + a.budget];
    for (const s of a.steps) {
      const c = state.checks[a.id + ':' + s.id];
      facts.push(s.title, s.result, s.note, ...(s.how || []), c && c.text);
      if (s.sign) facts.push(s.sign.action, s.sign.cost, ...(s.sign.expect || []), ...(s.sign.reject_if || []));
    }
    const grams = t => { const g = new Set(), x = String(t).toLowerCase().replace(/[\s"'(),.?!:]+/g, ''); for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2)); return g; };
    const qg = grams(q);
    const scored = [...new Set(facts.filter(Boolean))].map(t => { const g = grams(t); let n = 0; for (const x of qg) if (g.has(x)) n++; return { t, n: n / Math.max(4, qg.size) }; })
      .filter(x => x.n >= 0.25).sort((x, y) => y.n - x.n).slice(0, 3);
    const out = [];
    if (scored.length) out.push(h('p', 'meta', T('จากข้อมูลที่เอเจนต์มีอยู่:', 'From what the agent already knows:')), list('ul', scored.map(x => x.t)));
    else out.push(h('p', '', T('เรื่องนี้ไม่มีในข้อมูลของเอเจนต์ ให้ Claude ตอบดีกว่าครับ', 'That is not in the agent\'s notes. Better let Claude answer.')));
    const cur = nextStep(a);
    const ctx = T('เอเจนต์ ', 'Agent ') + a.name + (cur ? T(' · ขั้นตอนตอนนี้: ', ' · current step: ') + cur.title : '') + '\n' + T('คำถาม: ', 'Question: ') + q;
    const b = btn(T('ถาม Claude (คัดลอกคำถามแล้วเปิด Claude)', 'Ask Claude (copies the question and opens Claude)'), 'ghost', async () => {
      try { await navigator.clipboard.writeText(ctx); b.textContent = T('คัดลอกแล้ว วางในแชทของโปรเจกต์ใน Claude', 'Copied. Paste it in your project chat in Claude'); } catch (e) {}
      window.open('https://claude.ai/', '_blank', 'noopener');
    });
    out.push(replies(b));
    return out;
  }
  const dueText = due => { const d = daysTo(due); return d < 0 ? T('เลยกำหนดแล้ว', 'Past its date') : d === 0 ? T('⏰ วันนี้วันสุดท้าย', '⏰ Today is the last day') : T('⏰ เหลือ ' + d + ' วัน', '⏰ ' + d + ' days left'); };
  const replies = (...b) => { const r = h('div', 'replies'); r.append(...b); return r; };

  // What one step needs from the user, as short as it can be: why it is theirs, a button that opens the right page already
  // filled in, and what to check before confirming (folded away). Steps the agent can see on-chain need no reply.
  const fill = u => { const v = String(u || '').replace(/\{main\}/g, mainAddr()).replace(/\{farm\}/g, state.addr); return /\{|\/address\/(?:$|[?#])/.test(v) ? null : safeUrl(v); };
  function task(a, s, withAgent) {
    const k = a.id + ':' + s.id, chk = state.checks[k] || null, box = h('div', 'task');
    const top = h('div', 'tline');
    if (withAgent) top.append(data('span', 'tav', a.emoji || '🤖'), data('span', 'meta', a.name));
    top.append(h('span', 'pill need', NEED[needOf(s)]()), h('span', 'meta', T('~' + (Number(s.mins) || 3) + ' นาที', '~' + (Number(s.mins) || 3) + ' min')));
    if (s.due) top.append(h('span', 'meta', dueText(s.due)));
    box.append(top, data('b', 'ttl', s.title));
    if (s.auto && !autoAddrs(s).length) box.append(h('p', 'meta', T('ใส่ที่อยู่กระเป๋าด้านบนครั้งเดียว แล้วเอเจนต์จะตรวจขั้นนี้เอง', 'Add your wallet address above once and the agent will check this step itself')));
    if (chk && !chk.ok && (s.auto || !s.verify)) {
      const p = data('p', 'found', '🤖 ' + chk.text + ' ');
      if (safeUrl(chk.link)) { const l = h('a', '', T('ดูรายการ', 'See them')); l.href = chk.link; l.target = '_blank'; l.rel = 'noopener'; p.append(l); }
      box.append(p);
    }
    const rs = [];
    const op = (s.open && fill(s.open.u)) ? s.open : null, u = op ? fill(op.u) : (a.official || []).map(l => safeUrl(l.u)).find(Boolean);
    if (u) { const l = data('a', 'btn pri', (op && op.t ? op.t : T('เปิดหน้าเว็บ', 'Open the site')) + ' ↗'); l.href = u; l.target = '_blank'; l.rel = 'noopener'; rs.push(l); }
    if (s.verify && state.addr) {
      box.append(h('p', 'meta', T('เซ็นเสร็จแล้วไม่ต้องกลับมากดอะไร เอเจนต์จะเห็นธุรกรรมเองภายในไม่กี่นาที', 'Once you sign there is nothing to press here: the agent will see the transaction within minutes')));
      rs.push(btn(T('ตรวจตอนนี้', 'Check now'), 'ghost', e => { e.target.disabled = true; runChecks(true); }));
    } else if (s.auto && autoAddrs(s).length) {
      rs.push(btn(T('ตรวจอีกครั้ง', 'Check again'), 'ghost', e => { e.target.disabled = true; runChecks(true); }));
    } else {
      rs.push(btn(T('เสร็จแล้ว', 'Done'), 'ghost', () => { setSt(a, s, { done_at: new Date().toISOString(), skipped: false }); rerender(); }));
      if (s.kind !== 'sign' || !s.verify) rs.push(btn(T('ไม่เกี่ยวกับฉัน', 'Not for me'), 'ghost', () => { setSt(a, s, { done_at: new Date().toISOString(), skipped: true }); rerender(); }));
    }
    box.append(replies(...rs));
    // The details, folded: how to do it and what the MetaMask window should look like.
    const g = s.sign, more = h('details', 'how');
    more.append(h('summary', '', g ? T('วิธีทำ และสิ่งที่ต้องดูก่อนกดยืนยัน', 'How, and what to check before you confirm') : T('วิธีทำ', 'How')));
    if (s.how && s.how.length) more.append(list('ol', s.how));
    if (s.note) more.append(data('p', 'meta', s.note));
    if (g) {
      const f = h('div', 'facts');
      for (const [kk, v] of [[T('เว็บ', 'Site'), g.site], [T('เครือข่าย', 'Network'), g.network], [T('สิ่งที่จะเซ็น', 'What you sign'), g.action], [T('ค่าใช้จ่าย', 'Cost'), g.cost]]) if (v) { const d = h('div'); d.append(h('b', '', kk + ': '), data('span', '', v)); f.append(d); }
      if (g.expect && g.expect.length) f.append(h('div', 'meta', T('หน้าต่าง MetaMask ควรเป็นแบบนี้:', 'The MetaMask window should show:')), list('ul', g.expect));
      f.append(h('div', 'no', T('กดปฏิเสธ (Reject) ทันทีถ้า:', 'Press Reject at once if:')), list('ul', g.reject_if, 'no'));
      more.append(f);
    }
    if (more.children.length > 1) box.append(more);
    return box;
  }

  // The round: everything that needs the user, across all agents, in one card.
  function roundCard() {
    const list = tasks(), card = h('div', 'round');
    if (!list.length) { card.append(h('b', '', T('✅ ตอนนี้ไม่มีงานรอคุณ', '✅ Nothing needs you right now')), h('p', 'meta', T('เอเจนต์ตรวจบนเชนและติดตามข่าวให้อยู่ มีอะไรต้องใช้คุณจะแจ้งที่กระดิ่ง', 'The agents keep checking the chain and the news. When something needs you, the bell will tell you.'))); return card; }
    card.append(h('b', '', T('รอบนี้มี ' + list.length + ' อย่างที่ต้องใช้คุณ · ประมาณ ' + minsOf(list) + ' นาที', list.length + ' things need you this round · about ' + minsOf(list) + ' min')),
      h('p', 'meta', T('ที่เหลือเอเจนต์ตรวจและปิดให้เอง ข้างล่างคือสิ่งที่ทำแทนไม่ได้ เพราะต้องใช้กระเป๋าหรือบัญชีของคุณ', 'The agents check and close the rest. Below is only what they cannot do, because it needs your wallet or account.')));
    for (const t of list) card.append(task(t.a, t.s, true));
    return card;
  }

  function rerender() {
    const r = document.getElementById('ag-tasks');
    if (r) r.replaceChildren(roundCard());
    if (document.getElementById('ag-list')) { renderList(); renderChat(); }
    renderPop();
  }

  // ---- floating chat (every page except the agents page): a round button bottom-right that opens the agents in a popup ----
  const ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-1.5 2.5-4 2.5h-2"/></svg>';
  const POP_KEY = 'crypto-radar:agents-pop:v1';
  let fab = null, pop = null, popView = 'home', popAgent = null, popQuery = '';
  function initPop() {
    if (document.getElementById('ag-list') || fab) return;
    fab = h('button', 'agfab'); fab.type = 'button'; fab.innerHTML = ICON + '<span class="badge" hidden></span>';
    fab.title = T('คุยกับเอเจนต์', 'Chat with agents'); fab.setAttribute('aria-label', fab.title);
    pop = h('div', 'agpop agc'); pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', fab.title);
    fab.onclick = () => { pop.hidden = !pop.hidden; if (!pop.hidden) { popView = 'home'; renderPop(); } };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) pop.hidden = true; });
    document.body.append(pop, fab);
    renderPop();
  }
  function renderPop() {
    if (!fab) return;
    const n = tasks().length, b = fab.querySelector('.badge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    if (pop.hidden) return;
    const a = popView === 'chat' && agents.find(x => x.id === popAgent);
    if (a) {
      const back = h('button', 'back', '‹'); back.type = 'button'; back.onclick = () => { popView = 'home'; renderPop(); };
      const [head, body, form] = chatView(a, back);
      const close = h('button', 'x', '×'); close.type = 'button'; close.title = T('ปิด', 'Close'); close.onclick = () => { pop.hidden = true; };
      head.append(close);
      pop.replaceChildren(head, body, form);
      body.scrollTop = body.scrollHeight;
      return;
    }
    const top = h('div', 'pophead');
    const close = h('button', 'x', '×'); close.type = 'button'; close.title = T('ปิด', 'Close'); close.onclick = () => { pop.hidden = true; };
    top.append(h('span', 'hi', T('สวัสดีครับ 👋', 'Hello 👋')), h('b', '', T('คุยกับเอเจนต์ของคุณ', 'Chat with your agents')), close);
    const body = h('div', 'popbody');
    // Ask once whether to pop device notifications.
    let dismissed = false; try { dismissed = localStorage.getItem(POP_KEY) === 'no-notify'; } catch (e) {}
    if ('Notification' in window && Notification.permission === 'default' && !dismissed && window.CRAlerts) {
      const ask = h('div', 'ask');
      ask.append(h('span', '', T('🔔 ให้เด้งแจ้งเตือนบนหน้าจอเมื่อเอเจนต์รอคุณไหม', '🔔 Show a notification on screen when an agent is waiting for you?')));
      ask.append(btn(T('เปิด', 'Turn on'), 'pri', async () => { await window.CRAlerts.enableNotifications(); renderPop(); }),
        btn(T('ไม่ตอนนี้', 'Not now'), 'ghost', () => { try { localStorage.setItem(POP_KEY, 'no-notify'); } catch (e) {} renderPop(); }));
      body.append(ask);
    }
    const search = h('input', 'search'); search.type = 'search'; search.placeholder = T('ค้นหาเอเจนต์หรือขั้นตอน', 'Search agents or steps'); search.value = popQuery;
    search.oninput = () => { popQuery = search.value; drawRows(); };
    const rows = h('div', 'rows');
    function drawRows() {
      const q = popQuery.trim().toLowerCase();
      const match = a => !q || [a.name, a.type, a.status_text, ...(a.steps || []).map(s => s.title)].join(' ').toLowerCase().includes(q);
      const list = agents.filter(match).sort((x, y) => order(x) - order(y));
      rows.replaceChildren();
      const sec = (title, items) => {
        if (!items.length) return;
        rows.append(h('div', 'sec', title));
        for (const a of items) {
          const r = h('button', 'row'); r.type = 'button';
          const s = nextStep(a), mid = h('span', 'mid');
          mid.append(data('b', '', a.name), data('span', 'last', s ? s.title : a.status_text || ''));
          r.append(data('span', 'av', a.emoji || '🤖'), mid, badge(a));
          r.onclick = () => { popView = 'chat'; popAgent = a.id; renderPop(); };
          rows.append(r);
        }
      };
      sec(T('เอเจนต์ทั้งหมด', 'All agents'), list);
      if (!rows.children.length) rows.append(h('p', 'meta', T('ไม่พบเอเจนต์', 'No agents found')));
    }
    drawRows();
    const more = h('a', 'more', T('เปิดหน้าเอเจนต์แบบเต็ม →', 'Open the full agents page →')); more.href = 'agents.html';
    body.append(roundCard(), search, rows, more);
    pop.replaceChildren(top, body);
  }


  function initPage() {
    const msg = document.getElementById('farm-msg');
    // Two read-only addresses the agents may look at: the farm wallet and the main wallet.
    for (const [id, field] of [['farm', 'addr'], ['main', 'main']]) {
      const inp = document.getElementById(id);
      if (!inp) continue;
      inp.value = state[field];
      if (field === 'main' && !state.main && mainAddr()) inp.placeholder = T('ใช้จากหน้าพอร์ต: ', 'From the portfolio page: ') + short(mainAddr());
      inp.onchange = () => {
        const v = inp.value.trim();
        // Someone pasting their recovery words gets a loud warning and nothing is kept.
        if (/^[a-z]+(\s+[a-z]+){11,23}$/i.test(v)) { inp.value = ''; msg.textContent = T('⚠️ นี่คือคำกู้คืน ห้ามวางที่ไหนเด็ดขาด แอปไม่ได้บันทึกไว้ ใส่แค่ที่อยู่ 0x...', '⚠️ That is a recovery phrase. Never paste it anywhere. Nothing was saved; enter only the 0x... address.'); return; }
        if (v && !/^0x[0-9a-fA-F]{40}$/.test(v)) { msg.textContent = T('ที่อยู่ไม่ถูกต้อง ต้องเป็น 0x ตามด้วย 40 ตัวอักษร', 'Invalid address: 0x followed by 40 characters'); return; }
        state[field] = v; save();
        msg.textContent = v ? T('บันทึกแล้ว เก็บในเครื่องนี้เท่านั้น เอเจนต์กำลังตรวจ…', 'Saved on this device only. The agents are checking…') : T('ลบแล้ว', 'Removed');
        rerender(); runChecks(true);
      };
    }
    const pick = () => { openId = decodeURIComponent(location.hash.slice(1)) || null; rerender(); };
    window.addEventListener('hashchange', pick);
    openId = decodeURIComponent(location.hash.slice(1)) || null;
    // On a wide screen open the agent that needs the user most.
    if (!openId && matchMedia('(min-width: 760px)').matches && agents.length) openId = agents.slice().sort((x, y) => order(x) - order(y))[0].id;
    rerender();
  }

  window.CRAgents = { nextStep, isOpen };
  window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); rerender(); } });

  fetchAgents().then(list => {
    agents = list;
    if (document.getElementById('ag-list')) initPage();
    initPop();
    // A round of checks now, then every 5 minutes while the app is open, and whenever it comes back to the screen.
    setTimeout(() => runChecks().finally(notifyTasks), 1500);
    setInterval(() => { if (document.visibilityState === 'visible') runChecks(); }, 5 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') runChecks(); });
  }).catch(() => {
    const g = document.getElementById('ag-list');
    if (g) g.replaceChildren(h('p', 'loading', T('โหลดรายการเอเจนต์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'Could not load the agents. Check your connection and try again.')));
  });
})();
