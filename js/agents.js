// One agent per activity (data/agents/<id>.json, written by Claude's scheduled research). The agent does the research and
// link checks; every wallet step is the user's. On any page this file pings the user (bell and device notification)
// when an agent reaches a step that needs their signature or a deadline is near. On agents.html it also draws the queues.
// It never asks the wallet to sign anything: the user signs in their own wallet, then the agent checks the chain.
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
  };

  const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } };
  function load() {
    const s = readJson(KEY, {});
    return { addr: /^0x[0-9a-fA-F]{40}$/.test(s.addr || '') ? s.addr : '', steps: s.steps && typeof s.steps === 'object' ? s.steps : {} };
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
  // A step is open until done or skipped; a repeating step opens at repeatAt.
  function isOpen(a, s) {
    if (s.who === 'agent') return false;
    const x = st(a, s);
    if (x.skipped) return false;
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

  // ---- notifications (every page) ----
  function checkDue(agents) {
    if (!window.CRAlerts) return;
    const sent = readJson(NOTIFIED_KEY, {}), day = new Date().toISOString().slice(0, 10);
    const ping = (key, title, body, href) => {
      if (sent[key] === day) return;
      sent[key] = day;
      window.CRAlerts.notify(title, body, { href, kind: 'agent' });
    };
    for (const a of agents) {
      const s = nextStep(a);
      if (!s) continue;
      const href = 'agents.html#' + a.id;
      const d = s.due ? daysTo(s.due) : null;
      // A step whose date has passed is not nagged about any more.
      if (d != null && d < 0) continue;
      if (s.kind === 'sign') {
        // Ask once per step, then again every 3 days while it waits (daily in the last 3 days before its date).
        const k = 'sign:' + a.id + ':' + s.id, last = sent[k + ':last'];
        if (!last || Date.now() - Date.parse(last) >= 3 * DAY || (d != null && d <= 3)) {
          if (sent[k] !== day) sent[k + ':last'] = new Date().toISOString();
          ping(k, T('เอเจนต์ ' + a.name + ': ถึงขั้นที่คุณต้องเซ็น', 'Agent ' + a.name + ': your signature is needed'), s.title + (d != null ? T(' · เหลือ ' + d + ' วัน', ' · ' + d + ' days left') : ''), href);
        }
      } else if (d != null && [30, 14, 7, 3, 2, 1, 0].includes(d)) {
        ping('due:' + a.id + ':' + s.id, T('เอเจนต์ ' + a.name + ': ใกล้ถึงกำหนด', 'Agent ' + a.name + ': deadline soon'), s.title + T(' · เหลือ ' + d + ' วัน', ' · ' + d + ' days left'), href);
      }
    }
    try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(sent)); } catch (e) {}
  }

  // ---- on-chain check after the user signs ----
  async function verify(s, since, used) {
    const ex = s.verify && EXPLORERS[s.verify.chain];
    if (!ex || !state.addr) return null;
    const get = u => fetch(u, { headers: { accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
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

  // ---- page: a chat per agent, PM style. The agent's messages are built from its queue and this device's progress. ----
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const data = (tag, cls, text) => { const e = h(tag, cls, text); e.dataset.noI18n = ''; return e; };
  const safeUrl = u => (/^https:\/\/[^\s"'<>]+$/.test(String(u || '')) ? u : null);
  const when = iso => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  let agents = [], openId = null, readyStep = null, lastCheck = null;

  function badge(a) {
    if (a.status === 'paused') return h('span', 'pill stop', T('หยุดไว้', 'Paused'));
    const s = nextStep(a);
    if (!s) return h('span', 'pill ok', a.status === 'watch' ? T('เฝ้าดู', 'Watching') : T('ครบแล้ว', 'All done'));
    if (s.kind === 'sign') return h('span', 'pill sign', T('รอคุณเซ็น', 'Needs signature'));
    return h('span', 'pill', T('รอคุณ', 'Your turn'));
  }
  const order = a => (a.status === 'paused' ? 3 : !nextStep(a) ? 2 : nextStep(a).kind === 'sign' ? 0 : 1);

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
    const [head, body] = chatView(a, back);
    box.replaceChildren(head, body);
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
        body.append(bot(a, data('b', '', (s.kind === 'sign' ? '🖊️ ' : '👤 ') + s.title)));
        body.append(me(x.skipped ? T('ข้าม', 'Skip') : T('ทำแล้ว ✅', 'Done ✅'), x.done_at));
        if (x.proof) body.append(bot(a, data('p', '', '✅ ' + x.proof)));
        if (s.repeat_days && !x.skipped) body.append(bot(a, h('div', 'meta', T('จะชวนทำอีกครั้ง ', 'I will ask again on ') + new Date(repeatAt(a, s)).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))));
        continue;
      }
      if (s.repeat_days && s.first_wait && !x.done_at && !x.skipped && s !== cur && prevOf(a, s).done_at) {
        body.append(bot(a, data('b', '', '🖊️ ' + s.title), h('div', 'meta', T('จะชวนทำครั้งแรก ', 'I will first ask on ') + new Date(repeatAt(a, s)).toLocaleDateString(locale, { day: 'numeric', month: 'short' }))));
        continue;
      }
      if (s !== cur) continue;
      // The current step: what to do, then quick replies.
      const kids = [data('b', '', (s.kind === 'sign' ? '🖊️ ' : '👤 ') + T('ขั้นต่อไป: ', 'Next: ') + s.title)];
      if (s.due) kids.push(h('div', 'meta', dueText(s.due)));
      if (s.how && s.how.length) kids.push(list('ol', s.how));
      if (s.note) kids.push(data('p', 'meta', s.note));
      if (s.kind === 'sign' && s.sign) {
        const g = s.sign, f = h('div', 'facts');
        for (const [k, v] of [[T('เว็บ', 'Site'), g.site], [T('เครือข่าย', 'Network'), g.network], [T('สิ่งที่จะเซ็น', 'What you sign'), g.action], [T('ค่าใช้จ่าย', 'Cost'), g.cost]]) if (v) { const d = h('div'); d.append(h('b', '', k + ': '), data('span', '', v)); f.append(d); }
        kids.push(f, h('p', 'meta', T('ขั้นนี้คุณต้องเซ็นเองใน MetaMask พร้อมเมื่อไรกดปุ่มด้านล่าง', 'You sign this one yourself in MetaMask. Press the button below when you are ready.')));
      }
      body.append(bot(a, ...kids));
      if (s.kind === 'sign' && s.sign) signFlow(a, s, body);
      else body.append(replies(btn(T('ทำแล้ว', 'Done'), 'pri', () => { setSt(a, s, { done_at: new Date().toISOString(), skipped: false }); rerender(); }),
                               btn(T('ข้าม', 'Skip'), 'ghost', () => { setSt(a, s, { done_at: new Date().toISOString(), skipped: true }); rerender(); })));
    }
    if (!cur) body.append(bot(a, h('p', '', a.status === 'paused' ? T('ตอนนี้หยุดไว้ก่อน ถ้าสถานการณ์เปลี่ยนผมจะทักมาครับ', 'Paused for now. I will message you if things change.') : T('ตอนนี้ไม่มีงานรอคุณ มีข่าวหรือขั้นใหม่เมื่อไรผมจะทักมาครับ', 'Nothing waiting for you. I will message you when there is news or a new step.'))));
    return [head, body];
  }
  const dueText = due => { const d = daysTo(due); return d < 0 ? T('เลยกำหนดแล้ว', 'Past its date') : d === 0 ? T('⏰ วันนี้วันสุดท้าย', '⏰ Today is the last day') : T('⏰ เหลือ ' + d + ' วัน', '⏰ ' + d + ' days left'); };
  const replies = (...b) => { const r = h('div', 'replies'); r.append(...b); return r; };

  function signFlow(a, s, body) {
    const key = a.id + ':' + s.id, g = s.sign;
    if (readyStep !== key) {
      body.append(replies(btn(T('ฉันพร้อมเซ็น', "I'm ready to sign"), 'warn', () => { readyStep = key; lastCheck = null; setSt(a, s, { ready_at: new Date().toISOString() }); rerender(); }),
        btn(T('ข้าม', 'Skip'), 'ghost', () => { if (confirm(T('ข้ามขั้นนี้?', 'Skip this step?'))) { setSt(a, s, { done_at: new Date().toISOString(), skipped: true }); rerender(); } })));
      return;
    }
    body.append(me(T('ฉันพร้อมเซ็น', "I'm ready to sign"), st(a, s).ready_at));
    const checks = [], kids = [h('p', '', T('โอเคครับ เปิดเว็บจากลิงก์ทางการด้านบน ทำตามขั้นตอน แล้วก่อนกดยืนยันใน MetaMask ติ๊กว่าตรงทุกข้อ:', 'OK. Open the site from the official link above, follow the steps, and before you confirm in MetaMask tick that each point matches:'))];
    for (const t of g.expect || []) { const l = h('label', 'chk'), c = h('input'); c.type = 'checkbox'; checks.push(c); l.append(c, data('span', '', ' ' + t)); kids.push(l); }
    kids.push(h('div', 'no', T('กดปฏิเสธ (Reject) ทันทีถ้า:', 'Press Reject at once if:')), list('ul', g.reject_if, 'no'));
    body.append(bot(a, ...kids));
    if (lastCheck && lastCheck.key === key) {
      const r = lastCheck.r, p = data('p', '', (r.ok ? '✅ ' : '⏳ ') + r.text + ' ');
      if (r.link) { const l = h('a', '', T('ดูบน explorer', 'View on explorer')); l.href = r.link; l.target = '_blank'; l.rel = 'noopener'; p.append(l); }
      body.append(me(T('เซ็นเสร็จแล้ว', 'Signed'), lastCheck.at), bot(a, p));
    }
    const finish = (proof, tx) => { readyStep = null; lastCheck = null; setSt(a, s, { done_at: new Date().toISOString(), skipped: false, proof: proof || '', tx: tx || '' }); rerender(); };
    const canCheck = state.addr && s.verify && EXPLORERS[s.verify.chain];
    const done = btn(lastCheck && lastCheck.key === key ? T('ตรวจอีกครั้ง', 'Check again') : canCheck ? T('เซ็นเสร็จแล้ว ให้เอเจนต์ตรวจ', 'Signed, check it') : T('เซ็นเสร็จแล้ว', 'Signed'), 'pri', async () => {
      if (!lastCheck && checks.length && checks.some(c => !c.checked) && !confirm(T('ยังติ๊กไม่ครบ ยืนยันว่าตรวจแล้ว?', 'Not every point is ticked. Confirm you checked?'))) return;
      const since = stepStart(a, s);
      done.disabled = true; done.textContent = T('กำลังตรวจบนเชน…', 'Checking the chain…');
      let r = null;
      try { r = await verify(s, since, usedTx(a)); } catch (e) { r = { ok: false, text: T('ตรวจบนเชนไม่ได้ตอนนี้', 'Could not check the chain right now') }; }
      if (!r) return finish();
      lastCheck = { key, r, at: new Date().toISOString() };
      if (r.ok) return finish(r.text, r.tx);
      rerender();
    });
    const rs = [done];
    if (lastCheck && lastCheck.key === key) rs.push(btn(T('ยืนยันเองว่าทำแล้ว', 'Mark done anyway'), 'ghost', () => finish()));
    rs.push(btn(T('ยกเลิก', 'Cancel'), 'ghost', () => { readyStep = null; lastCheck = null; rerender(); }));
    body.append(replies(...rs));
  }

  function rerender() {
    if (document.getElementById('ag-list')) { renderList(); renderChat(); }
    renderPop();
  }

  // ---- floating chat (every page except the agents page): a round button bottom-right that opens the agents in a popup ----
  const ICON = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-1.5 2.5-4 2.5h-2"/></svg>';
  const POP_KEY = 'crypto-radar:agents-pop:v1';
  let fab = null, pop = null, popView = 'home', popAgent = null, popFilter = '', popQuery = '';
  const waiting = a => !!nextStep(a);
  const needsSign = a => { const s = nextStep(a); return !!s && s.kind === 'sign'; };
  function initPop() {
    if (document.getElementById('ag-list') || fab) return;
    fab = h('button', 'agfab'); fab.type = 'button'; fab.innerHTML = ICON + '<span class="badge" hidden></span>';
    fab.title = T('คุยกับเอเจนต์', 'Chat with agents'); fab.setAttribute('aria-label', fab.title);
    pop = h('div', 'agpop agc'); pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', fab.title);
    fab.onclick = () => { pop.hidden = !pop.hidden; if (!pop.hidden) { popView = 'home'; popFilter = ''; renderPop(); } };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) pop.hidden = true; });
    document.body.append(pop, fab);
    renderPop();
  }
  function renderPop() {
    if (!fab) return;
    const n = agents.filter(waiting).length, b = fab.querySelector('.badge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
    if (pop.hidden) return;
    const a = popView === 'chat' && agents.find(x => x.id === popAgent);
    if (a) {
      const back = h('button', 'back', '‹'); back.type = 'button'; back.onclick = () => { popView = 'home'; readyStep = null; lastCheck = null; renderPop(); };
      const [head, body] = chatView(a, back);
      const close = h('button', 'x', '×'); close.type = 'button'; close.title = T('ปิด', 'Close'); close.onclick = () => { pop.hidden = true; };
      head.append(close);
      pop.replaceChildren(head, body);
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
    const tiles = h('div', 'tiles');
    const tile = (icon, title, sub, on, fn) => { const t = h('button', 'tile' + (on ? ' on' : '')); t.type = 'button'; t.append(h('span', 'ti', icon), h('b', '', title), h('span', 'meta', sub)); t.onclick = fn; return t; };
    const signN = agents.filter(needsSign).length;
    const safety = agents.find(x => x.id === 'safety');
    tiles.append(
      tile('🖊️', T('รอคุณเซ็น', 'To sign'), T(signN + ' เอเจนต์', signN + ' agents'), popFilter === 'sign', () => { popFilter = popFilter === 'sign' ? '' : 'sign'; renderPop(); }),
      tile('🤖', T('เอเจนต์ทั้งหมด', 'All agents'), T(agents.length + ' ตัว', agents.length + ' agents'), !popFilter, () => { popFilter = ''; renderPop(); }),
      tile('🛡️', T('ความปลอดภัย', 'Safety'), T('เช็กกระเป๋า', 'Wallet check'), false, () => { if (safety) { popView = 'chat'; popAgent = safety.id; renderPop(); } }));
    const search = h('input', 'search'); search.type = 'search'; search.placeholder = T('ค้นหาเอเจนต์หรือขั้นตอน', 'Search agents or steps'); search.value = popQuery;
    search.oninput = () => { popQuery = search.value; drawRows(); };
    const rows = h('div', 'rows');
    function drawRows() {
      const q = popQuery.trim().toLowerCase();
      const match = a => !q || [a.name, a.type, a.status_text, ...(a.steps || []).map(s => s.title)].join(' ').toLowerCase().includes(q);
      const list = agents.filter(match).filter(a => popFilter !== 'sign' || needsSign(a)).sort((x, y) => order(x) - order(y));
      rows.replaceChildren();
      const sec = (title, items) => {
        if (!items.length) return;
        rows.append(h('div', 'sec', title));
        for (const a of items) {
          const r = h('button', 'row'); r.type = 'button';
          const s = nextStep(a), mid = h('span', 'mid');
          mid.append(data('b', '', a.name), data('span', 'last', s ? s.title : a.status_text || ''));
          r.append(data('span', 'av', a.emoji || '🤖'), mid, badge(a));
          r.onclick = () => { popView = 'chat'; popAgent = a.id; readyStep = null; lastCheck = null; renderPop(); };
          rows.append(r);
        }
      };
      sec(T('รอคุณ', 'Waiting for you'), list.filter(waiting));
      sec(T('เอเจนต์อื่น', 'Other agents'), list.filter(a => !waiting(a)));
      if (!rows.children.length) rows.append(h('p', 'meta', T('ไม่พบเอเจนต์', 'No agents found')));
    }
    drawRows();
    const more = h('a', 'more', T('เปิดหน้าเอเจนต์แบบเต็ม →', 'Open the full agents page →')); more.href = 'agents.html';
    body.append(tiles, search, rows, more);
    pop.replaceChildren(top, body);
  }


  function initPage() {
    const inp = document.getElementById('farm'), msg = document.getElementById('farm-msg');
    inp.value = state.addr;
    document.getElementById('farm-save').onclick = () => {
      const v = inp.value.trim();
      // Someone pasting their recovery words gets a loud warning and nothing is kept.
      if (/^[a-z]+(\s+[a-z]+){11,23}$/i.test(v)) { inp.value = ''; msg.textContent = T('⚠️ นี่คือคำกู้คืน ห้ามวางที่ไหนเด็ดขาด แอปไม่ได้บันทึกไว้ ใส่แค่ที่อยู่ 0x...', '⚠️ That is a recovery phrase. Never paste it anywhere. Nothing was saved; enter only the 0x... address.'); return; }
      if (v && !/^0x[0-9a-fA-F]{40}$/.test(v)) { msg.textContent = T('ที่อยู่ไม่ถูกต้อง ต้องเป็น 0x ตามด้วย 40 ตัวอักษร', 'Invalid address: 0x followed by 40 characters'); return; }
      state.addr = v; save();
      msg.textContent = v ? T('บันทึกแล้ว เก็บในเครื่องนี้เท่านั้น', 'Saved on this device only') : T('ลบแล้ว', 'Removed');
    };
    const pick = () => { openId = decodeURIComponent(location.hash.slice(1)) || null; readyStep = null; lastCheck = null; rerender(); };
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
    setTimeout(() => checkDue(agents), 2500);
  }).catch(() => {
    const g = document.getElementById('ag-list');
    if (g) g.replaceChildren(h('p', 'loading', T('โหลดรายการเอเจนต์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'Could not load the agents. Check your connection and try again.')));
  });
})();
