// Install and update buttons, offline cache and new-version notice shared by every page.
(function () {
  const APP_VERSION = '10';   // keep in step with VERSION in sw.js; add a CHANGELOG entry for every release
  const CHANGELOG = [
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
    updating = true; upBtn.disabled = true; upBtn.textContent = '…';
    try {
      if (reg) {
        await reg.update();
        // A new version installs and takes over by itself; controllerchange then reloads.
        if (reg.installing || reg.waiting) { setTimeout(() => location.reload(), 4000); return; }
      }
    } catch (e) {}
    location.reload();
  };

  // Version chip next to the update button, on every screen size; tap it for what's new.
  if (upBtn) {
    const v = document.createElement('a');
    v.className = 'ver'; v.href = 'guide.html#whatsnew'; v.textContent = 'v' + APP_VERSION; v.title = 'มีอะไรใหม่';
    upBtn.before(v);
  }
  // First open after an update: say so once.
  try {
    const seen = localStorage.getItem('crypto-radar:seen-version');
    if (seen && seen !== APP_VERSION) {
      const t = document.createElement('a');
      t.className = 'toast'; t.href = 'guide.html#whatsnew';
      t.textContent = 'อัปเดตเป็นเวอร์ชัน ' + APP_VERSION + ' แล้ว · ดูมีอะไรใหม่ →';
      document.body.append(t); setTimeout(() => t.remove(), 7000);
    }
    localStorage.setItem('crypto-radar:seen-version', APP_VERSION);
  } catch (e) {}

  const up = document.getElementById('updated');
  if (up) fetch('data/meta.json', { cache: 'no-cache' }).then(r => r.json()).then(m => {
    const when = m.updated_at ? new Date(m.updated_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '–';
    up.textContent = 'ข้อมูลล่าสุด ' + when;
  }).catch(() => {});
  window.addEventListener('offline', () => toast('ออฟไลน์อยู่ กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด'));
})();
