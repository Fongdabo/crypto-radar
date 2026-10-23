// Install and update buttons, offline cache and new-version notice shared by every page.
(function () {
  const APP_VERSION = '5';   // keep in step with VERSION in sw.js
  const btn = document.getElementById('install');
  let prompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; if (btn) btn.hidden = false; });
  window.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; });
  if (btn) btn.onclick = async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice; prompt = null; btn.hidden = true; };

  function toast(text, ms) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = text; document.body.append(t);
    setTimeout(() => t.remove(), ms || 4000);
  }

  let banner = null;
  function showNewVersion() {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'toast new-version';
    banner.append('มีเวอร์ชันใหม่ ');
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = 'กดอัปเดต';
    b.onclick = () => location.reload();
    banner.append(b);
    document.body.append(banner);
  }

  let reg = null, updating = false;
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

  // The update button: fetch a new app version if there is one, then reload so data and wallet balances are read fresh.
  const upBtn = document.getElementById('refresh');
  if (upBtn) upBtn.onclick = async () => {
    if (!navigator.onLine) { toast('ออฟไลน์อยู่ ต่ออินเทอร์เน็ตก่อนแล้วกดอัปเดตอีกครั้ง'); return; }
    updating = true; upBtn.disabled = true; upBtn.textContent = 'กำลังอัปเดต…';
    try {
      if (reg) {
        await reg.update();
        // A new version installs and takes over by itself; controllerchange then reloads.
        if (reg.installing || reg.waiting) { setTimeout(() => location.reload(), 4000); return; }
      }
    } catch (e) {}
    location.reload();
  };

  const up = document.getElementById('updated');
  if (up) fetch('data/meta.json', { cache: 'no-cache' }).then(r => r.json()).then(m => {
    const when = m.updated_at ? new Date(m.updated_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
    up.textContent = 'ข้อมูลล่าสุด ' + when + ' · แอป v' + APP_VERSION;
  }).catch(() => { up.textContent = 'แอป v' + APP_VERSION; });
  window.addEventListener('offline', () => toast('ออฟไลน์อยู่ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด'));
})();
