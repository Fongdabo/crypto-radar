// Lists Thai text still showing on the dashboard in English mode, so new labels can be added to i18n/page-en.json.
// Usage: node scripts/page-missing.mjs   (serves the repo itself on port 8766; needs Playwright)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }).end(await readFile(p)); }
  catch { res.writeHead(404).end(); }
}).listen(8766);

const pw = (await import(path.join(execSync('npm root -g').toString().trim(), 'playwright/index.js'))).default;
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => localStorage.setItem('crypto-radar:lang', 'en'));
await p.route(u => !u.href.startsWith('http://localhost:8766'), r => r.abort());
await p.goto('http://localhost:8766/index.html');
await p.waitForTimeout(2500);
const left = new Set();
const n = await p.locator('.nf-nav button').count();
for (let i = 0; i <= n; i++) {
  if (i < n) { await p.locator('.nf-nav button').nth(i).click(); await p.waitForTimeout(400); }
  for (const s of await p.evaluate(() => {
    const out = [], thai = /[ก-๛]/, w = document.createTreeWalker(document.getElementById('dash-root'), NodeFilter.SHOW_TEXT);
    let x; while ((x = w.nextNode())) if (thai.test(x.nodeValue)) out.push(x.nodeValue.trim());
    for (const el of document.querySelectorAll('#dash-root [placeholder], #dash-root [title], #dash-root [aria-label]'))
      for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v && thai.test(v)) out.push(v.trim()); }
    return out;
  })) left.add(s);
}
console.log(JSON.stringify([...left], null, 0));
await b.close(); server.close();
