// Morning Telegram digest, run by GitHub Actions: deadlines and key dates in the next 3 days, and big 24h moves of tracked coins.
// Needs repository secrets TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID; without them it does nothing.
import { readFileSync } from 'node:fs';

const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
if (!token || !chat) { console.log('Telegram secrets not set; skipping.'); process.exit(0); }

const read = f => { try { return JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8')); } catch (e) { return []; } };
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }).split(',')[0]);
const iso = d => d.toISOString().slice(0, 10);
const daysTo = s => Math.round((new Date(s + 'T00:00:00Z') - new Date(iso(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))) + 'T00:00:00Z')) / 864e5);
const thDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date());

const soon = [];
for (const r of read('airdrop_deadlines.json')) { const d = daysTo(r.key_date); if (d >= 0 && d <= 3) soon.push([d, `🎁 ${r.project}: ${r.date_text}`]); }
for (const r of read('timeline.json')) { const d = daysTo(r.date); if (d >= 0 && d <= 3) soon.push([d, `📅 ${r.label} (${r.kind})`]); }
soon.sort((a, b) => a[0] - b[0]);

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

const lines = [`☀️ สรุปเช้านี้ · ${thDate}`];
if (soon.length) { lines.push('', '⏰ ภายใน 3 วัน'); for (const [d, t] of soon) lines.push(`• ${d === 0 ? 'วันนี้' : 'อีก ' + d + ' วัน'} · ${t}`); }
if (moves.length) { lines.push('', '⚡ เหรียญที่ติดตามขยับแรง 24 ชม.'); for (const [s, c, p] of moves) lines.push(`• ${s} ${c >= 0 ? '📈 +' : '📉 '}${c.toFixed(1)}% ($${p < 1 ? p.toPrecision(4) : p.toFixed(2)})`); }
if (!soon.length && !moves.length) lines.push('', 'วันนี้ไม่มีวันสำคัญใน 3 วัน และไม่มีเหรียญที่ติดตามขยับเกิน 10%');
lines.push('', 'ดูต่อ: https://fongdabo.github.io/crypto-radar/', 'ข้อมูลเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน');

const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text: lines.join('\n'), disable_web_page_preview: true }),
});
const out = await res.json();
if (!out.ok) { console.log('Telegram error:', out.description); process.exit(1); }
console.log('sent', lines.length, 'lines');
