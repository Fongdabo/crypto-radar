// Per-coin page: price chart, key stats, an automatic numbers-based read, and Claude's daily written analysis when there is one.
(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const usd = n => {
    if (n == null || !isFinite(n)) return '–';
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
    return s + '$' + (a < 1 && a !== 0 ? a.toPrecision(4) : a.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  };
  const num = n => n == null || !isFinite(n) ? '–' : (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  const pct = n => n == null || !isFinite(n) ? '–' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  const { CG, getJson } = window.CR;

  let analysis = [], tracked = [];
  const ready = Promise.all([
    fetch('data/analysis.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(j => { analysis = Array.isArray(j) ? j : []; }).catch(() => {}),
    fetch('data/prices.json', { cache: 'no-cache' }).then(r => r.json()).then(j => { tracked = (Array.isArray(j) ? j : []).filter(r => r && typeof r.token === 'string'); }).catch(() => {}),
  ]);
  function walletSyms() {
    try {
      const c = JSON.parse(localStorage.getItem('crypto-radar:wallet-cache:v1') || '{}');
      const out = new Set();
      for (const v of Object.values(c)) for (const r of (v && v.rows) || []) if (!r.unverified && typeof r.sym === 'string' && (r.value || 0) >= 1) out.add(r.sym);
      return [...out];
    } catch (e) { return []; }
  }

  const resolve = sym => window.CR.resolveId(sym);

  function renderChips(cur) {
    const box = $('chips'); box.textContent = '';
    const group = (title, syms) => {
      if (!syms.length) return;
      box.append(el('div', 'grp', title));
      for (const s of syms) {
        const b = el('button', cur && cur.toUpperCase() === s.toUpperCase() ? 'on' : '', s); b.type = 'button';
        b.onclick = () => open({ sym: s });
        box.append(b);
      }
    };
    group('เหรียญเกมที่ติดตาม', [...new Set(tracked.map(t => t.token))]);
    group('เหรียญในกระเป๋าของฉัน', walletSyms());
    group('เหรียญหลัก', ['BTC', 'ETH', 'SOL', 'BNB']);
  }

  async function search() {
    const q = $('q').value.trim(), box = $('results');
    box.textContent = '';
    if (!q) return;
    box.append(el('div', 'muted', 'กำลังค้นหา…'));
    try {
      const j = await getJson(CG + '/search?query=' + encodeURIComponent(q));
      box.textContent = '';
      const coins = (j.coins || []).slice(0, 8);
      if (!coins.length) box.append(el('div', 'muted', 'ไม่พบเหรียญนี้'));
      for (const c of coins) {
        const b = el('button', '', String(c.symbol).toUpperCase() + ' · ' + c.name + (c.market_cap_rank ? ' (อันดับ ' + c.market_cap_rank + ')' : '')); b.type = 'button';
        b.onclick = () => { box.textContent = ''; $('q').value = ''; open({ id: c.id, sym: String(c.symbol).toUpperCase() }); };
        box.append(b);
      }
    } catch (e) { box.textContent = ''; box.append(el('div', 'muted', 'ค้นหาไม่ได้ตอนนี้ (CoinGecko จำกัดจำนวนครั้ง) ลองใหม่ในอีกสักครู่')); }
  }
  $('q-go').onclick = search;
  $('q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

  // Series as [[ms, price], …]: CoinGecko first, Binance daily/hourly candles as the fallback.
  async function series(id, sym, days) {
    try {
      const j = await getJson(`${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      if (Array.isArray(j.prices) && j.prices.length > 1) return { src: 'CoinGecko', pts: j.prices };
    } catch (e) {}
    if (!sym) throw new Error('no data');
    const [interval, limit] = days <= 7 ? ['1h', 168] : days <= 30 ? ['4h', 180] : ['1d', Math.min(days, 1000)];
    const k = await getJson(`https://api.binance.com/api/v3/klines?symbol=${sym.toUpperCase()}USDT&interval=${interval}&limit=${limit}`);
    return { src: 'Binance', pts: k.map(c => [c[6], Number(c[4])]) };
  }
  function daily(pts) {
    const by = new Map();
    for (const [t, p] of pts) by.set(new Date(t).toISOString().slice(0, 10), p);
    return [...by.values()];
  }

  // A plain-language read of the numbers. Not a forecast.
  function autoRead(closes, md) {
    const n = closes.length, last = closes[n - 1];
    const sma = k => n >= k ? closes.slice(-k).reduce((a, b) => a + b, 0) / k : null;
    const s7 = sma(7), s30 = sma(30);
    let gain = 0, loss = 0;
    for (let i = Math.max(1, n - 14); i < n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
    const rsi = n > 15 ? (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)) : null;
    const rets = closes.slice(-31).map((p, i, a) => i ? Math.log(p / a[i - 1]) : null).filter(x => x != null && isFinite(x));
    const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const vol = rets.length > 5 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) * Math.sqrt(365) * 100 : null;
    const last30 = closes.slice(-30), hi = Math.max(...last30), lo = Math.min(...last30);
    const trend = s30 == null ? 'side' : last > s30 && s7 > s30 ? 'up' : last < s30 && s7 < s30 ? 'down' : 'side';
    const lines = [];
    if (s30 != null) lines.push(`ราคาอยู่${last > s30 ? 'เหนือ' : 'ใต้'}ค่าเฉลี่ย 30 วัน (${usd(s30)}) ${trend === 'up' ? 'แรงซื้อยังนำ' : trend === 'down' ? 'แรงขายยังนำ' : 'ยังไม่มีทิศทางชัด'}`);
    if (rsi != null) lines.push(`RSI 14 วัน = ${rsi.toFixed(0)} ${rsi >= 70 ? '(ร้อนแรง ขึ้นเร็ว มีโอกาสย่อ)' : rsi <= 30 ? '(ถูกขายหนัก อาจเด้งได้ แต่ยังไม่ใช่สัญญาณกลับตัว)' : '(ปกติ)'}`);
    lines.push(`กรอบราคา 30 วัน: ต่ำสุด ${usd(lo)} · สูงสุด ${usd(hi)} (ราคาตอนนี้อยู่ ${hi > lo ? Math.round((last - lo) / (hi - lo) * 100) : 50}% ของกรอบ)`);
    if (vol != null) lines.push(`ความผันผวนต่อปี ≈ ${vol.toFixed(0)}% ${vol > 120 ? '(สูงมาก ขึ้นลงแรง)' : vol > 70 ? '(สูง)' : '(ปานกลาง)'}`);
    const ath = md && md.ath_change_percentage && md.ath_change_percentage.usd;
    if (ath != null) lines.push(`ต่ำกว่าจุดสูงสุดตลอดกาล ${Math.abs(ath).toFixed(0)}%`);
    const sup = md && md.circulating_supply, tot = md && (md.max_supply || md.total_supply);
    if (sup && tot && tot > sup * 1.15) lines.push(`มีเหรียญหมุนเวียนแค่ ${Math.round(sup / tot * 100)}% ของทั้งหมด ยังมีเหรียญรอปลดล็อกออกมาอีก อาจกดดันราคา`);
    return { trend, lines };
  }

  let current = null, range = 30, redraw = null;
  async function open(q) {
    const box = $('coin');
    box.textContent = '';
    box.append(el('div', 'card empty', 'กำลังโหลด…'));
    await ready;
    let id = q.id, sym = q.sym;
    try { if (!id) id = await resolve(sym); } catch (e) {}
    if (!id && !sym) { box.firstChild.textContent = 'ไม่พบเหรียญนี้'; return; }
    current = { id, sym };
    history.replaceState(null, '', 'coin.html?' + (id ? 'id=' + encodeURIComponent(id) + '&' : '') + (sym ? 'sym=' + encodeURIComponent(sym) : ''));
    renderChips(sym);
    let md = null, info = null;
    if (id) {
      try {
        info = await getJson(`${CG}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`);
        md = info.market_data;
        sym = sym || String(info.symbol || '').toUpperCase();
        current.sym = sym;
      } catch (e) {}
    }
    if (!md && sym) {
      try {
        const t = await getJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym.toUpperCase()}USDT`);
        md = { current_price: { usd: Number(t.lastPrice) }, price_change_percentage_24h: Number(t.priceChangePercent), total_volume: { usd: Number(t.quoteVolume) } };
      } catch (e) {}
    }
    if (!md) { box.firstChild.textContent = 'โหลดข้อมูลเหรียญนี้ไม่ได้ตอนนี้ (อาจถูกจำกัดจำนวนครั้ง) ลองกดใหม่ในอีกสักครู่'; return; }
    box.textContent = '';
    renderCoin(box, info, md, sym);
  }

  function renderCoin(box, info, md, sym) {
    const g = (o, k) => o && o[k] && o[k].usd;
    // Header + chart
    const c1 = el('div', 'card');
    const hd = el('div', 'hd');
    if (info && info.image && info.image.small && /^https:\/\//.test(info.image.small)) { const im = el('img'); im.src = info.image.small; im.alt = ''; im.onerror = () => im.remove(); hd.append(im); }
    const nm = el('div'); nm.append(el('h1', '', info ? info.name : sym), el('span', 'muted', (sym || '') + (info && info.market_cap_rank ? ' · อันดับ ' + info.market_cap_rank : '')));
    hd.append(nm);
    const px = el('div', 'px'); px.append(el('b', '', usd(g(md, 'current_price'))));
    const ch = md.price_change_percentage_24h; px.append(el('span', ch >= 0 ? 'pos' : 'neg', pct(ch) + ' (24 ชม.)'));
    hd.append(px); c1.append(hd);
    const rg = el('div', 'ranges');
    for (const [d, t] of [[7, '7 วัน'], [30, '30 วัน'], [90, '90 วัน'], [365, '1 ปี']]) {
      const b = el('button', d === range ? 'on' : '', t); b.type = 'button';
      b.onclick = () => { range = d; rg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); drawChart(); };
      rg.append(b);
    }
    c1.append(rg);
    const chart = el('div'); chart.id = 'chart'; c1.append(chart);
    const src = el('p', 'muted'); c1.append(src);
    box.append(c1);

    // Stats
    const c2 = el('div', 'card'); c2.append(el('h2', '', 'ข้อมูลสำคัญ'));
    const st = el('div', 'stats');
    const stat = (l, v, cls) => { const s = el('div', 'stat'); s.append(el('span', '', l)); s.append(el('b', cls || '', v)); st.append(s); };
    stat('มูลค่าตลาด', usd(g(md, 'market_cap')));
    stat('ปริมาณซื้อขาย 24 ชม.', usd(g(md, 'total_volume')));
    for (const [k, l] of [['price_change_percentage_7d', '7 วัน'], ['price_change_percentage_30d', '30 วัน'], ['price_change_percentage_1y', '1 ปี']]) if (md[k] != null) stat('เปลี่ยนแปลง ' + l, pct(md[k]), md[k] >= 0 ? 'pos' : 'neg');
    if (g(md, 'ath') != null) stat('สูงสุดตลอดกาล', usd(g(md, 'ath')) + ' (' + pct(md.ath_change_percentage && md.ath_change_percentage.usd) + ')');
    if (md.circulating_supply) stat('เหรียญหมุนเวียน', num(md.circulating_supply));
    if (md.max_supply || md.total_supply) stat('เหรียญทั้งหมด', num(md.max_supply || md.total_supply));
    c2.append(st); box.append(c2);

    // Analysis
    const c3 = el('div', 'card an'); c3.append(el('h2', '', 'บทวิเคราะห์'));
    const auto = el('div'); c3.append(auto);
    const claude = analysis.find(x => (current.id && x.coingecko_id === current.id) || (sym && String(x.token).toUpperCase() === sym.toUpperCase()));
    if (claude) {
      const d = el('div'); d.style.marginTop = '14px';
      const tb = { 'ขาขึ้น': 'b-up', 'ขาลง': 'b-down' }[claude.trend] || 'b-side';
      const h = el('div'); h.append(el('b', '', 'จากการค้นคว้าของ Claude ')); h.append(el('span', 'muted', 'ข้อมูล ณ ' + (claude.as_of || '–')));
      d.append(h);
      const line = el('p'); if (claude.trend) line.append(el('span', 'badge ' + tb, claude.trend));
      if (claude.risk_score) { line.append('ความเสี่ยง '); const m = el('span', 'meter'); for (let i = 1; i <= 5; i++) m.append(el('i', i <= claude.risk_score ? 'f' : '')); line.append(m, ' ' + claude.risk_score + '/5'); }
      d.append(line);
      // Claude's research is written in Thai; keep it as written in every language.
      if (window.CR_LANG !== 'th') d.append(el('p', 'muted', 'Research written in Thai.'));
      if (claude.summary_th) { const p = el('p', '', claude.summary_th); p.dataset.noI18n = ''; d.append(p); }
      const list = (t, arr) => { if (!Array.isArray(arr) || !arr.length) return; d.append(el('b', '', t)); const ul = el('ul'); ul.dataset.noI18n = ''; for (const x of arr) ul.append(el('li', '', String(x))); d.append(ul); };
      list('เรื่องที่ต้องจับตา', claude.watch_th); list('ความเสี่ยง', claude.risks_th);
      c3.append(d);
    } else {
      c3.append(el('p', 'muted', 'ยังไม่มีบทวิเคราะห์จาก Claude สำหรับเหรียญนี้ (มีเฉพาะเหรียญที่แดชบอร์ดติดตาม อัปเดตทุกเช้า)'));
    }
    c3.append(el('div', 'note', 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำให้ซื้อหรือขาย ตัวเลขในอดีตบอกอนาคตไม่ได้ ลงเงินเท่าที่เสียได้เท่านั้น'));
    box.append(c3);

    // The automatic read always uses 90 days of daily closes, whatever range the chart shows.
    series(current.id, sym, 90).then(s => {
      const closes = daily(s.pts);
      if (closes.length < 10) { auto.append(el('p', 'muted', 'ข้อมูลยังน้อยเกินไปสำหรับวิเคราะห์')); return; }
      const r = autoRead(closes, md);
      const h = el('div'); h.append(el('b', '', 'อ่านจากตัวเลขอัตโนมัติ ')); h.append(el('span', 'badge ' + { up: 'b-up', down: 'b-down', side: 'b-side' }[r.trend], { up: 'ขาขึ้น', down: 'ขาลง', side: 'ไซด์เวย์' }[r.trend]));
      auto.append(h);
      const ul = el('ul'); for (const t of r.lines) ul.append(el('li', '', t)); auto.append(ul);
    }).catch(() => auto.append(el('p', 'muted', 'ดึงข้อมูลย้อนหลังไม่ได้ตอนนี้')));

    let pts = null;
    function drawChart() {
      chart.textContent = ''; chart.append(el('div', 'empty', 'กำลังโหลดกราฟ…'));
      series(current.id, sym, range).then(s => { pts = s.pts; src.textContent = 'ข้อมูลจาก ' + s.src; paint(); })
        .catch(() => { chart.textContent = ''; chart.append(el('div', 'empty', 'โหลดกราฟไม่ได้ตอนนี้ ลองใหม่ในอีกสักครู่')); });
    }
    function paint() {
      if (!pts) return;
      chart.textContent = '';
      const W = chart.clientWidth || 600, H = Math.max(220, Math.min(340, W * 0.5)), m = { t: 10, r: 10, b: 24, l: 56 };
      const data = pts.map(([t, p]) => ({ t: new Date(t), p }));
      const up = data[data.length - 1].p >= data[0].p, col = up ? '#34d399' : '#f87171';
      const x = d3.scaleTime().domain(d3.extent(data, d => d.t)).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain(d3.extent(data, d => d.p)).nice().range([H - m.b, m.t]);
      const svg = d3.select(chart).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`);
      svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 110))).tickSizeOuter(0))
        .call(g => g.selectAll('text').attr('fill', 'var(--muted)')).call(g => g.selectAll('line,path').attr('stroke', 'var(--line)'));
      svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => usd(v)).tickSizeOuter(0))
        .call(g => g.selectAll('text').attr('fill', 'var(--muted)')).call(g => g.selectAll('line,path').attr('stroke', 'var(--line)'));
      const grad = svg.append('defs').append('linearGradient').attr('id', 'g').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
      grad.append('stop').attr('offset', 0).attr('stop-color', col).attr('stop-opacity', .3);
      grad.append('stop').attr('offset', 1).attr('stop-color', col).attr('stop-opacity', 0);
      svg.append('path').datum(data).attr('fill', 'url(#g)').attr('d', d3.area().x(d => x(d.t)).y0(H - m.b).y1(d => y(d.p)));
      svg.append('path').datum(data).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2).attr('d', d3.line().x(d => x(d.t)).y(d => y(d.p)));
      const dot = svg.append('circle').attr('r', 4).attr('fill', col).style('display', 'none');
      const tip = el('div', 'tip'); tip.style.display = 'none'; chart.append(tip);
      const bis = d3.bisector(d => d.t).center;
      const fmt = new Intl.DateTimeFormat(window.CR_LOCALE || 'th-TH', range <= 7 ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: '2-digit' });
      svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
        .on('pointermove', ev => {
          const [mx] = d3.pointer(ev), d = data[bis(data, x.invert(mx))];
          dot.style('display', null).attr('cx', x(d.t)).attr('cy', y(d.p));
          tip.style.display = 'block'; tip.textContent = fmt.format(d.t) + ' · ' + usd(d.p);
          const px = x(d.t) / W * chart.clientWidth, tw = tip.offsetWidth;
          tip.style.left = Math.min(Math.max(0, px - tw / 2), chart.clientWidth - tw) + 'px';
          tip.style.top = Math.max(0, y(d.p) / H * chart.clientHeight - 40) + 'px';
        })
        .on('pointerleave', () => { dot.style('display', 'none'); tip.style.display = 'none'; });
    }
    redraw = paint;
    drawChart();
  }

  let rw = 0;
  window.addEventListener('resize', () => { if (redraw && document.documentElement.clientWidth !== rw) { rw = document.documentElement.clientWidth; redraw(); } });

  const params = new URLSearchParams(location.search);
  ready.then(() => {
    renderChips(params.get('sym'));
    if (params.get('id') || params.get('sym')) open({ id: params.get('id'), sym: params.get('sym') });
  });
})();
