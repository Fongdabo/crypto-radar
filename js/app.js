// Shared by every page: the top-right toolbar (status, bell, theme, help, language, menu), install and update, offline cache and new-version notice.
(function () {
  const APP_VERSION = '19';   // keep in step with VERSION in sw.js; add a CHANGELOG entry for every release
  const CHANGELOG = [
    ['19', '23 ต.ค. 2569', ['ปุ่มแชทลอยมุมขวาล่างทุกหน้าแบบแอป PM: กดเพื่อคุยกับเอเจนต์ได้ทันที มีตัวเลขบอกจำนวนเอเจนต์ที่รอคุณ', 'ในหน้าต่างแชท: ปุ่มลัด รอคุณเซ็น / เอเจนต์ทั้งหมด / ความปลอดภัย ช่องค้นหา และรายการเอเจนต์ที่รอคุณ', 'ถามครั้งเดียวว่าจะให้เด้งแจ้งเตือนบนหน้าจอไหม']],
    ['18', '23 ต.ค. 2569', ['แผงกระเป๋ากะทัดรัดขึ้นแบบ MetaMask อยู่ใต้แถบเมนู ลากขอบซ้ายเพื่อปรับความกว้างได้', 'แสดงโลโก้เหรียญจริง พร้อมป้ายเครือข่ายที่มุม', 'ปุ่มอัปเดตบอกผลทุกครั้ง: อัปเดตเป็นเวอร์ชันใหม่แล้ว หรือเป็นเวอร์ชันล่าสุดอยู่แล้ว', 'แก้ปุ่มอัปเดตที่บางครั้งยังโหลดเวอร์ชันเก่าค้างอยู่ประมาณ 10 นาทีหลังมีเวอร์ชันใหม่']],
    ['17', '23 ต.ค. 2569', ['แก้ "อ่านไม่ได้": Solana และ EVM ใช้ผู้ให้บริการสำรองเมื่อตัวหลักบล็อก และเครือข่ายเดียวพังจะไม่ทำให้ทั้งกระเป๋าอ่านไม่ได้อีก', 'บอกเหตุผลจริงเมื่ออ่านยอดไม่ได้', 'ปุ่มวางที่อยู่กระเป๋าเป็นทางหลัก ปุ่มเชื่อมกระเป๋าย้ายไปเป็นตัวเลือกเสริม']],
    ['16', '23 ต.ค. 2569', ['แท็บเอเจนต์: แชทแบบแอป PM เอเจนต์ 1 ตัวต่อ 1 กิจกรรม (Base, Ink, Abstract, เคลม, ความปลอดภัย, ปลดล็อก, Polymarket) บอกขั้นต่อไปพร้อมปุ่ม ทำแล้ว / ข้าม / ฉันพร้อมเซ็น', 'ขั้นที่ต้องเซ็นบอกว่าหน้าต่าง MetaMask ควรเป็นแบบไหน และเมื่อไรต้องกดปฏิเสธ เซ็นเสร็จเอเจนต์ตรวจบนเชนให้ (คุณเซ็นเอง แอปไม่เซ็นแทน)', 'กระดิ่งแจ้งเมื่อเอเจนต์รอให้คุณเซ็น หรือใกล้ถึงกำหนด']],
    ['15', '23 ต.ค. 2569', ['ปิดการแจ้งเตือน Telegram ไว้ก่อน', 'กดเชื่อมกระเป๋าแล้วถามก่อนว่ากระเป๋าอยู่ในเบราว์เซอร์ไหน (เบราว์เซอร์นี้ / Chrome / Edge / Brave) ถ้าอยู่อีกเบราว์เซอร์ แอปพาไปเปิดที่นั่นให้', 'ปุ่มเดียว "วางที่อยู่กระเป๋าที่คัดลอกไว้" ไม่ต้องเชื่อมต่อ', 'เตือนตอนกดเชื่อม: ถ้ากระเป๋าขึ้นหน้าสร้างกระเป๋าใหม่ ให้ปิด อย่ากรอกคำกู้คืนในเบราว์เซอร์ที่สอง']],
    ['14', '23 ต.ค. 2569', ['กระเป๋าแบบแท็บ: แสดงเฉพาะกระเป๋าที่คุณเพิ่มไว้ สลับได้ทั้งในหน้าพอร์ตและแผงด้านขวา กด + เพื่อเพิ่ม', 'เชื่อม Ronin Wallet และกระเป๋าอื่นที่ติดตั้งในเบราว์เซอร์ได้ (ดูอย่างเดียว)', 'อ่านยอดบนเครือข่าย Ronin: RON, AXS, SLP, WETH และ USDC']],
    ['13', '23 ต.ค. 2569', ['แผงกระเป๋าฝังขวาแบบ MetaMask: บัญชี ยอดรวม เหรียญแยกเครือข่าย (ดูอย่างเดียว)', 'แท็บกิจกรรม: เว็บทางการที่ตรวจแล้ว ตัวตรวจลิงก์ก่อนเชื่อมกระเป๋า และสิ่งที่กดได้/ห้ามกด', 'ฟอนต์ภาษาไทยใหม่ (Noto Sans Thai Looped) อ่านง่ายขึ้น ใช้ได้แม้ออฟไลน์', 'การ์ดนับถอยหลังกดไปเว็บทางการได้']],
    ['12', '23 ต.ค. 2569', ['แดชบอร์ดเป็นภาษาอังกฤษทั้งหน้าเมื่อเลือก English รวมบทวิจัยและบทวิเคราะห์รายเหรียญ (แปลใหม่ทุกเช้า)', 'ธงภาษาแสดงถูกต้องบน Windows']],
    ['11', '23 ต.ค. 2569', ['แถบเครื่องมือมุมขวาบนแบบแอป PM: สถานะออนไลน์, กระดิ่งแจ้งเตือน, ธีมมืด/สว่าง, คู่มือ, ภาษา และเมนู', 'เปลี่ยนภาษาเป็นอังกฤษได้ (เนื้อหาวิจัยในแดชบอร์ดยังเป็นภาษาไทย)', 'แก้นับถอยหลังที่แสดงรายการซ้ำ']],
    ['10', '23 ต.ค. 2569', ['แดชบอร์ดขยายเต็มจอบนจอใหญ่ ไม่มีขอบว่างสองข้าง', 'หน้าพอร์ตและหน้ากราฟกว้างขึ้น']],
    ['9', '23 ต.ค. 2569', ['แจ้งเตือนเข้า Telegram: ราคาถึงเป้า และเหรียญที่ถือขยับแรงเกิน 10% ใน 24 ชม.', 'เตือนบนเครื่องเมื่อเหรียญที่ถือขยับแรง (วันละครั้งต่อเหรียญ)', 'สรุปทุกเช้า 07:35 น. เข้า Telegram แม้ปิดแอป (ต้องตั้งค่าใน GitHub ตามคู่มือ)']],
    ['8', '23 ต.ค. 2569', ['ตั้งราคาเป้าหมาย: เตือนเมื่อเหรียญขึ้นถึงหรือลงถึงราคาที่ตั้ง (เด้งแจ้งเตือนบนเครื่องได้)', 'บันทึกซื้อขาย: สรุปจำนวนที่ถือ ต้นทุนเฉลี่ย กำไรที่ขายแล้ว และส่งออกไฟล์ CSV', 'ไฟล์สำรองข้อมูลรวมราคาเป้าหมายและรายการซื้อขายด้วย']],
    ['7', '23 ต.ค. 2569', ['แท็บกราฟ: ดูกราฟราคาแต่ละเหรียญ 7 วัน / 30 วัน / 90 วัน / 1 ปี พร้อมข้อมูลสำคัญ', 'บทวิเคราะห์อัตโนมัติจากตัวเลข (แนวโน้ม, RSI, กรอบราคา, ความผันผวน) และบทวิเคราะห์รายวันจาก Claude สำหรับเหรียญที่ติดตาม', 'กดชื่อเหรียญในตารางราคาหรือในกระเป๋า เพื่อเปิดกราฟได้ทันที']],
    ['6', '23 ต.ค. 2569', ['กระเป๋าแบบบัญชีเหมือน MetaMask: รวมหลายที่อยู่ไว้ในบัญชีเดียว พร้อมยอดรวมของบัญชีและของแต่ละที่อยู่', 'อ่านยอด Bitcoin, Tron และ Stellar ได้แล้ว (แอปรู้เองว่าที่อยู่เป็นเครือข่ายไหน)', 'ปุ่มคัดลอกที่อยู่ แก้ชื่อบัญชี และสร้างได้หลายบัญชี', 'แสดงเลขเวอร์ชันทุกหน้าและหน้า "มีอะไรใหม่" นี้']],
    ['5', '23 ต.ค. 2569', ['ปุ่มเชื่อม MetaMask และ Phantom แบบดูอย่างเดียว ไม่ขอเซ็นหรืออนุมัติอะไร']],
    ['4', '23 ต.ค. 2569', ['เพิ่มแท็บคู่มือภาษาไทยสำหรับมือใหม่']],
    ['3', '23 ต.ค. 2569', ['เพิ่มปุ่มอัปเดต และแถบแจ้งเมื่อมีเวอร์ชันใหม่']],
    ['2', '23 ต.ค. 2569', ['อ่านยอดกระเป๋า Solana', 'อ่านยอด EVM ได้เสถียรขึ้น ลองใหม่เองเมื่อพลาด และบอกชื่อเครือข่ายที่อ่านไม่ได้']],
    ['1', '23 ต.ค. 2569', ['เปิดตัวแอป: แดชบอร์ด พอร์ตส่วนตัว ติดตั้งได้ ใช้ออฟไลน์ได้']],
  ];
  window.APP_VERSION = APP_VERSION; window.APP_CHANGELOG = CHANGELOG;
  const EN = window.CR_LANG === 'en';
  const T = (th, en) => (EN ? en : th);
  const locale = window.CR_LOCALE || 'th-TH';
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // Coin logos: the token's own icon from a trusted source (Blockscout, Jupiter verified list), else the
  // cryptocurrency-icons set by symbol, else a coloured letter. A small network badge sits on tokens that are not the chain's own coin.
  const ICON_CDN = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/';
  const CHAINS = {
    Ethereum: ['#627eea', 'ETH', 'eth'], Base: ['#0052ff', 'ETH', null], Polygon: ['#8247e5', 'POL', 'matic'], Arbitrum: ['#28a0f0', 'ETH', null],
    Optimism: ['#ff0420', 'ETH', null], Bitcoin: ['#f7931a', 'BTC', 'btc'], Solana: ['#14f195', 'SOL', 'sol'], Tron: ['#eb0029', 'TRX', 'trx'],
    Stellar: ['#7d7d7d', 'XLM', 'xlm'], Ronin: ['#1273ea', 'RON', null],
  };
  const imgOr = (srcs, fallback) => {
    if (!srcs.length) return fallback();
    const im = h('img'); im.alt = ''; im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer';
    let i = 0; im.onerror = () => { if (i < srcs.length) im.src = srcs[i++]; else im.replaceWith(fallback()); };
    im.src = srcs[i++]; return im;
  };
  window.CRLogo = function (sym, chain, url, opts) {
    const s = String(sym || '').replace(/\s*⚠$/, '').trim(), c = CHAINS[chain] || null, trusted = !(opts && opts.unverified);
    const wrap = h('span', 'clogo'); wrap.setAttribute('aria-hidden', 'true');
    const letter = () => { const d = h('span', 'clogo-l', (s[0] || '?').toUpperCase()); d.style.background = c ? c[0] : '#64748b'; return d; };
    const srcs = [];
    if (trusted && typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url)) srcs.push(url);
    if (trusted && /^[A-Za-z0-9]{1,10}$/.test(s)) srcs.push(ICON_CDN + s.toLowerCase() + '.svg');
    wrap.append(imgOr(srcs, letter));
    if (c && s.toUpperCase() !== c[1]) {
      const b = h('span', 'clogo-b'); b.title = chain;
      b.append(imgOr(c[2] ? [ICON_CDN + c[2] + '.svg'] : [], () => { const d = h('span', 'clogo-l', chain[0]); d.style.background = c[0]; return d; }));
      wrap.append(b);
    }
    return wrap;
  };
  const icon = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICONS = {
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.2h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };

  function toast(text, ms) {
    document.querySelectorAll('.toast:not(.new-version)').forEach(x => x.remove());
    const t = h('div', 'toast', text); document.body.append(t);
    setTimeout(() => t.remove(), ms || 4000);
  }

  // ---- toolbar ----
  const bar = document.querySelector('.app-bar');
  const tools = h('div', 'tools');
  if (bar) bar.append(tools);
  let openDd = null;
  function closeDd() { if (openDd) { openDd.panel.hidden = true; openDd.btn.setAttribute('aria-expanded', 'false'); openDd = null; } }
  // A toolbar button with a dropdown panel; onOpen fills the panel each time it opens.
  function dropdown(cls, html, title, onOpen) {
    const wrap = h('div', 'dd ' + cls), btn = h('button', 'tb');
    btn.type = 'button'; btn.innerHTML = html; btn.title = title; btn.setAttribute('aria-label', title); btn.setAttribute('aria-expanded', 'false');
    const panel = h('div', 'dd-panel'); panel.hidden = true;
    btn.onclick = e => {
      e.stopPropagation();
      const was = openDd && openDd.btn === btn; closeDd();
      if (was) return;
      if (onOpen) onOpen(panel);
      panel.style.setProperty('--top', Math.round(btn.getBoundingClientRect().bottom + 6) + 'px');
      panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); openDd = { btn, panel };
    };
    panel.addEventListener('click', e => e.stopPropagation());
    wrap.append(btn, panel); tools.append(wrap);
    return { wrap, btn, panel };
  }
  document.addEventListener('click', closeDd);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDd(); });

  // 1. Online status and data time.
  let dataTime = '';
  const status = dropdown('status', icon(ICONS.cloud) + '<i class="dot"></i>', T('สถานะ', 'Status'), p => {
    p.replaceChildren(h('b', '', navigator.onLine ? T('ออนไลน์', 'Online') : T('ออฟไลน์ · แสดงข้อมูลที่บันทึกไว้', 'Offline · showing saved data')),
      h('div', 'muted', T('ข้อมูลล่าสุด ', 'Data updated ') + (dataTime || '–')),
      h('div', 'muted', T('ข้อมูลอัปเดตเองทุกเช้า', 'Data refreshes every morning')));
  });
  const setOnline = () => { status.wrap.classList.toggle('off', !navigator.onLine); status.btn.title = navigator.onLine ? T('ออนไลน์', 'Online') : T('ออฟไลน์', 'Offline'); };
  setOnline();
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', () => { setOnline(); toast(T('ออฟไลน์อยู่ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด', 'You are offline. Showing the last saved data.')); });
  fetch('data/meta.json', { cache: 'no-cache' }).then(r => r.json()).then(m => {
    dataTime = m.updated_at ? new Date(m.updated_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }).catch(() => {});

  // 2. Notifications: key dates in the next 7 days, plus price and big-move alerts this device has shown.
  const READ_KEY = 'crypto-radar:bell-read:v1', LOG_KEY = 'crypto-radar:bell-log:v1';
  const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } };
  let dates = [];
  function bellItems() {
    const week = Date.now() - 7 * 864e5;
    const log = readJson(LOG_KEY, []).filter(x => x && Date.parse(x.at) > week)
      .map(x => ({ id: 'a:' + x.at + x.title, kind: x.kind === 'agent' ? 'agent' : 'alert', title: x.title, sub: x.body, href: /^[a-z]+\.html(#[\w-]*)?$/.test(x.href || '') ? x.href : 'portfolio.html#targets', when: Date.parse(x.at) }));
    return log.reverse().concat(dates);
  }
  const bell = dropdown('bell', icon(ICONS.bell) + '<span class="badge" hidden></span>', T('การแจ้งเตือน', 'Notifications'), p => {
    const items = bellItems(), read = new Set(readJson(READ_KEY, []));
    p.replaceChildren(h('div', 'dd-head', T('การแจ้งเตือน', 'Notifications')));
    if (!items.length) p.append(h('div', 'muted dd-empty', T('ไม่มีการแจ้งเตือน', 'No notifications')));
    const sec = (title, list) => {
      if (!list.length) return;
      p.append(h('div', 'dd-sec', title));
      for (const it of list) {
        const a = h('a', 'dd-item' + (read.has(it.id) ? '' : ' new')); a.href = it.href;
        const t = h('span', 't', it.title), s = h('span', 's', it.sub);
        a.append(t, s); p.append(a);
      }
    };
    sec(T('เอเจนต์รอคุณ', 'Agents waiting for you'), items.filter(x => x.kind === 'agent'));
    sec(T('แจ้งเตือนราคา', 'Price alerts'), items.filter(x => x.kind === 'alert'));
    sec(T('วันสำคัญใน 7 วัน', 'Key dates in the next 7 days'), items.filter(x => x.kind === 'date'));
    // Opening the list marks everything as read.
    try { localStorage.setItem(READ_KEY, JSON.stringify(items.map(x => x.id).slice(0, 200))); } catch (e) {}
    setBadge();
  });
  function setBadge() {
    const read = new Set(readJson(READ_KEY, []));
    const n = bellItems().filter(x => !read.has(x.id)).length;
    const b = bell.btn.querySelector('.badge');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
  }
  (window.crFetchData ? window.crFetchData('timeline') : fetch('data/timeline.json', { cache: 'no-cache' })).then(r => r.json()).then(list => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    dates = (Array.isArray(list) ? list : []).map(x => {
      const d = new Date(String(x.date) + 'T00:00:00'), days = Math.round((d - today) / 864e5);
      return { x, d, days };
    }).filter(o => o.days >= 0 && o.days <= 7).sort((a, b) => a.d - b.d).map(({ x, d, days }) => ({
      id: 'd:' + x.date + ':' + x.label, kind: 'date', title: String(x.label || ''), href: './',
      sub: (days === 0 ? T('วันนี้', 'Today') : T('อีก ' + days + ' วัน', 'In ' + days + (days === 1 ? ' day' : ' days'))) + ' · ' + d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) + (x.approx ? ' (~)' : ''),
    }));
    setBadge();
  }).catch(() => {});
  window.addEventListener('cr-bell', setBadge);
  window.addEventListener('storage', e => { if (e.key === LOG_KEY || e.key === READ_KEY) setBadge(); });

  // 3. Theme.
  const theme = h('button', 'tb'); theme.type = 'button';
  const setThemeIcon = () => {
    const light = document.documentElement.dataset.theme === 'light';
    theme.innerHTML = icon(light ? ICONS.sun : ICONS.moon);
    theme.title = T('สลับธีมมืด/สว่าง', 'Switch dark/light theme'); theme.setAttribute('aria-label', theme.title);
  };
  theme.onclick = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    if (window.CRTheme) window.CRTheme.set(next);
    setThemeIcon();
  };
  setThemeIcon(); tools.append(theme);

  // 4. Help.
  const help = h('a', 'tb'); help.href = 'guide.html'; help.innerHTML = icon(ICONS.help);
  help.title = T('คู่มือ', 'Guide'); help.setAttribute('aria-label', help.title); tools.append(help);

  // 5. Language.
  const I = window.CRI18n || { lang: 'th', LANGS: { th: { name: 'ภาษาไทย', flag: '' } }, set() {} };
  const cur = I.LANGS[I.lang];
  const lang = dropdown('lang', '<span class="flag">' + cur.flag + '</span><span class="lbl">' + cur.name + '</span><span class="caret">▾</span>', T('เปลี่ยนภาษา', 'Change language'), p => {
    p.replaceChildren();
    for (const [code, L] of Object.entries(I.LANGS)) {
      const b = h('button', 'dd-item row' + (code === I.lang ? ' on' : '')); b.type = 'button';
      const f = h('span', 'flag'); f.innerHTML = L.flag;
      b.append(f, h('span', '', L.name), h('span', 'chk', code === I.lang ? '✓' : ''));
      b.onclick = () => I.set(code);
      p.append(b);
    }
  });
  lang.wrap.dataset.noI18n = '';

  // 6. Menu: update, what's new, backup, alerts, Telegram, install.
  let prompt = null, reg = null, updating = false;
  // Update: ask the server for the newest version number (skipping every cache), install it, then reload.
  // The result is shown after the reload, so pressing the button always says what happened.
  const UPD_KEY = 'crypto-radar:update-msg';
  async function latestVersion() {
    try { const t = await (await fetch('js/app.js?t=' + Date.now(), { cache: 'no-store' })).text(); const m = t.match(/APP_VERSION = '(\d+)'/); return m ? m[1] : null; }
    catch (e) { return null; }
  }
  async function update() {
    if (!navigator.onLine) { toast(T('ออฟไลน์อยู่ ต่ออินเทอร์เน็ตก่อนแล้วกดอัปเดตอีกครั้ง', 'You are offline. Connect to the internet and press update again.')); return; }
    updating = true; closeDd(); toast(T('กำลังตรวจหาเวอร์ชันใหม่…', 'Checking for a new version…'));
    const latest = await latestVersion();
    const newer = latest && Number(latest) > Number(APP_VERSION);
    if (newer) toast(T('พบเวอร์ชัน ', 'Found version ') + latest + T(' กำลังอัปเดต…', ', updating…'));
    try {
      if (reg) {
        await reg.update();
        const w = reg.installing || reg.waiting;
        if (w) await new Promise(res => { const t = setTimeout(res, 8000); w.addEventListener('statechange', () => { if (w.state === 'activated') { clearTimeout(t); res(); } }); });
      }
      // Drop the saved copies so the reload fetches every file again.
      if (newer && window.caches) for (const k of await caches.keys()) if (k.startsWith('crypto-radar-')) await caches.delete(k);
    } catch (e) {}
    try { sessionStorage.setItem(UPD_KEY, newer ? 'new:' + latest : latest ? 'same:' + latest : 'data'); } catch (e) {}
    location.reload();
  }
  (function updateResult() {
    let m = null; try { m = sessionStorage.getItem(UPD_KEY); sessionStorage.removeItem(UPD_KEY); } catch (e) {}
    if (!m) return;
    const [kind, v] = m.split(':');
    if (kind === 'new' && Number(APP_VERSION) < Number(v)) toast(T('ยังโหลดเวอร์ชันใหม่ไม่ครบ ปิดแอปทุกหน้าต่างแล้วเปิดใหม่ หรือกด Ctrl+Shift+R', 'The new version did not fully load. Close every app window and reopen it, or press Ctrl+Shift+R.'));
    else if (kind === 'new') toast(T('อัปเดตเป็น v', 'Updated to v') + APP_VERSION + T(' แล้ว', ''));
    else toast(T('เป็นเวอร์ชันล่าสุดแล้ว (v', 'You have the latest version (v') + APP_VERSION + T(') · อัปเดตข้อมูลแล้ว', ') · data refreshed'));
  })();
  dropdown('menu', icon(ICONS.menu) + '<span class="lbl">' + T('เมนู', 'Menu') + '</span><span class="caret">▾</span>', T('เมนู', 'Menu'), p => {
    p.replaceChildren();
    const item = (ico, text, href, onclick) => {
      const a = h(href ? 'a' : 'button', 'dd-item row'); if (href) a.href = href; else { a.type = 'button'; a.onclick = onclick; }
      a.append(h('span', 'ico', ico), h('span', '', text)); p.append(a); return a;
    };
    item('↻', T('อัปเดตแอปและข้อมูล', 'Update app and data'), null, update);
    item('✨', T('มีอะไรใหม่', "What's new") + ' · v' + APP_VERSION, 'guide.html#whatsnew');
    p.append(h('div', 'dd-sep'));
    item('🎯', T('แจ้งเตือนราคา', 'Price alerts'), 'portfolio.html#targets');
    // Telegram is switched off for now at the user's request; js/telegram.js stays in the repo for later.
    item('💾', T('สำรองข้อมูล / นำเข้า', 'Backup / import'), 'portfolio.html#backup');
    if (prompt) item('📲', T('ติดตั้งเป็นแอป', 'Install as app'), null, install);
    p.append(h('div', 'dd-sep'));
    item('📖', T('คู่มือ', 'Guide'), 'guide.html');
    p.append(h('div', 'muted dd-note', T('เวอร์ชัน ', 'Version ') + APP_VERSION + (dataTime ? ' · ' + T('ข้อมูลล่าสุด ', 'data ') + dataTime : '')));
  });

  // Install: offered in the menu, and as a button in the bar until installed.
  const installBtn = h('button', 'install', T('ติดตั้งแอป', 'Install app')); installBtn.type = 'button'; installBtn.hidden = true;
  if (bar) bar.insertBefore(installBtn, tools);
  async function install() { closeDd(); if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; installBtn.hidden = true; }
  installBtn.onclick = install;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; installBtn.hidden = false; });
  window.addEventListener('appinstalled', () => { prompt = null; installBtn.hidden = true; });

  // Version in the footer of every page.
  const foot = document.querySelector('.app-foot');
  if (foot) { const v = h('a', 'foot-ver', 'v' + APP_VERSION); v.href = 'guide.html#whatsnew'; foot.append(' · ', v); }

  // ---- service worker and updates ----
  let banner = null;
  function showNewVersion() {
    if (banner) return;
    banner = h('div', 'toast new-version', T('มีเวอร์ชันใหม่ ', 'New version available '));
    const b = h('button', '', T('กดอัปเดต', 'Update now')); b.type = 'button';
    b.onclick = () => location.reload();
    banner.append(b); document.body.append(banner);
  }
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(r => {
      reg = r;
      // Check for a new version each time the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      if (updating) location.reload(); else showNewVersion();
    });
  }

  // First open after an update: say so once.
  try {
    const seen = localStorage.getItem('crypto-radar:seen-version');
    if (seen && seen !== APP_VERSION) {
      const t = h('a', 'toast', T('อัปเดตเป็นเวอร์ชัน ' + APP_VERSION + ' แล้ว · ดูมีอะไรใหม่ →', 'Updated to version ' + APP_VERSION + " · see what's new →"));
      t.href = 'guide.html#whatsnew';
      document.body.append(t); setTimeout(() => t.remove(), 7000);
    }
    localStorage.setItem('crypto-radar:seen-version', APP_VERSION);
  } catch (e) {}
})();
