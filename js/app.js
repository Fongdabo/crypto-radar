// Install button, offline cache and update handling shared by every page.
(function () {
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

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Check for a new version each time the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast('อัปเดตแอปเป็นเวอร์ชันล่าสุดแล้ว');
      setTimeout(() => location.reload(), 800);
    });
  }

  const up = document.getElementById('updated');
  if (up) fetch('data/meta.json', { cache: 'no-cache' }).then(r => r.json()).then(m => {
    if (!m.updated_at) return;
    up.textContent = 'ข้อมูลล่าสุด ' + new Date(m.updated_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }).catch(() => {});
  window.addEventListener('offline', () => toast('ออฟไลน์อยู่ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด'));
})();
