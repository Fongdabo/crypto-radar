// Temporary: check that coin logo URLs load in a real browser.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
const syms = ['sol', 'eth', 'btc', 'trx', 'xlm', 'matic', 'usdc', 'usdt', 'axs', 'slp', 'link', 'bat'];
await p.setContent('<div id=x></div>');
const res = await p.evaluate(async syms => Promise.all(syms.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(s + ':ok ' + i.naturalWidth); i.onerror = () => r(s + ':FAIL'); i.src = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/' + s + '.svg'; }))), syms);
console.log(res.join(' | '));
const jup = await p.evaluate(async () => { const j = await (await fetch('https://lite-api.jup.ag/tokens/v2/search?query=So11111111111111111111111111111111111111112')).json(); return j[0] && j[0].icon; });
console.log('jup icon', jup);
await b.close();
