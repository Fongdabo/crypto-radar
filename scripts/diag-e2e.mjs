// Temporary: open the real portfolio page in Chromium on a GitHub runner and read two public wallets with live APIs.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(8765);
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', e => console.log('PAGEERROR', e.message));
p.on('requestfailed', r => console.log('REQFAILED', r.url().slice(0, 90), r.failure() && r.failure().errorText));
p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 90)); });
await p.addInitScript(() => localStorage.setItem('crypto-radar:portfolio:v1', JSON.stringify({ holdings: [], trades: [], connected: [],
  accounts: [{ id: 'a1', name: 'Test', addresses: ['vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg', '0xab5801a7d398351b8be11c439e05c5b3259aec9b'] }] })));
await p.goto('http://localhost:8765/portfolio.html');
await p.waitForTimeout(60000);
console.log('LIST', (await p.locator('#w-list').innerText()).replace(/\n+/g, ' / '));
console.log('ROWS', (await p.locator('#w-rows').innerText()).replace(/\n+/g, ' / ').slice(0, 1500));
await b.close(); process.exit(0);
