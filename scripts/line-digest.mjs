// Morning LINE message to the user's own LINE, run by GitHub Actions: deadlines in the next 3 days, agents with news,
// and big 24h moves of tracked coins. Sent through a LINE Official Account (Messaging API push), one message a day,
// well inside the free plan. Needs repository secrets LINE_CHANNEL_ACCESS_TOKEN and LINE_USER_ID; without them it does nothing.
// Which steps the user has already done lives only on their device, so the approve buttons stay in the app.
import { readFileSync } from 'node:fs';

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN, to = process.env.LINE_USER_ID;
const dry = process.argv.includes('--dry-run');
if (!dry && (!token || !to)) { console.log('LINE secrets not set; skipping.'); process.exit(0); }

const APP = 'https://fongdabo.github.io/crypto-radar/';
const read = f => { try { return JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8')); } catch (e) { return []; } };
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }).split(',')[0]);
const iso = d => d.toISOString().slice(0, 10);
const daysTo = s => Math.round((new Date(s + 'T00:00:00Z') - new Date(iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))) + 'T00:00:00Z')) / 864e5);
const thDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date());
const when = d => (d === 0 ? 'วันนี้' : 'อีก ' + d + ' วัน');

const soon = [];
for (const r of read('airdrop_deadlines.json')) { const d = daysTo(r.key_date); if (d >= 0 && d <= 3) soon.push([d, `🎁 ${r.project}: ${r.date_text}`, r.project]); }
for (const r of read('timeline.json')) { const d = daysTo(r.date); if (d >= 0 && d <= 3) soon.push([d, `📅 ${r.label} (${r.kind})`, r.label]); }

// Agents: steps with a date in the next 3 days, and agents whose queue changed in the last day.
const idx = read('agents/index.json');
const agents = (Array.isArray(idx.agents) ? idx.agents : []).map(id => read('agents/' + id + '.json')).filter(a => a && a.id && Array.isArray(a.steps));
const news = [];
for (const a of agents) {
  if (a.status === 'paused') continue;
  for (const s of a.steps) {
    if (!s.due || s.who === 'agent') continue;
    const d = daysTo(s.due);
    if (d >= 0 && d <= 3) soon.push([d, `${s.kind === 'sign' ? '🖊️' : '🤖'} ${a.name}: ${s.title}`, s.title]);
  }
  if (a.updated_at && Date.now() - Date.parse(a.updated_at) < 26 * 3600e3) {
    const sign = a.steps.find(s => s.kind === 'sign' && s.who !== 'agent');
    news.push(`• ${a.emoji || '🤖'} ${a.name}: ${a.status_text || 'มีขั้นตอนใหม่'}${sign ? ' (มีขั้นที่ต้องเซ็นเอง)' : ''}`);
  }
}
// The same event often sits in several lists (deadline, timeline, agent step): keep the first by its leading word.
const seen = new Set();
const uniq = soon.filter(([d, , name]) => { const k = d + ':' + String(name).split(/[\s:(]/)[0].toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
uniq.sort((a, b) => a[0] - b[0]);

const ids = [...new Set(read('analysis.json').map(x => x.coingecko_id).filter(Boolean))];
const tokenOf = Object.fromEntries(read('analysis.json').map(x => [x.coingecko_id, x.token]));
let moves = [];
if (ids.length) {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_24hr_change=true&ids=' + ids.join(','));
    const j = await r.json();
    moves = ids.map(id => [tokenOf[id], j[id] && j[id].usd_24h_change, j[id] && j[id].usd]).filter(([, c]) => c != null && Math.abs(c) >= 10);
  } catch (e) { console.log('price fetch failed', e.message); }
}

const lines = [`☀️ เรดาร์คริปโต · ${thDate}`];
if (uniq.length) { lines.push('', '⏰ ภายใน 3 วัน'); for (const [d, t] of uniq) lines.push(`• ${when(d)} · ${t}`); }
if (news.length) { lines.push('', '🤖 เอเจนต์มีข่าวใหม่', ...news); }
if (moves.length) { lines.push('', '⚡ เหรียญที่ติดตามขยับแรง 24 ชม.'); for (const [s, c, p] of moves) lines.push(`• ${s} ${c >= 0 ? '📈 +' : '📉 '}${c.toFixed(1)}% ($${p < 1 ? p.toPrecision(4) : p.toFixed(2)})`); }
if (!uniq.length && !news.length && !moves.length) lines.push('', 'วันนี้ไม่มีงานด่วน ไม่มีวันสำคัญใน 3 วัน และไม่มีเหรียญที่ติดตามขยับเกิน 10%');
lines.push('', 'กดยืนยันหรือเซ็นในแอป: ' + APP + 'agents.html', 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน');

// A LINE text message holds at most 5000 characters.
const text = lines.join('\n').slice(0, 4900);
if (process.argv.includes('--dry-run')) { console.log(text); process.exit(0); }
const res = await fetch('https://api.line.me/v2/bot/message/push', {
  method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
  body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
});
if (!res.ok) { console.log('LINE error:', res.status, await res.text()); process.exit(1); }
console.log('sent', lines.length, 'lines');
