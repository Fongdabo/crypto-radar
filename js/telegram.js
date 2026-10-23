// Telegram settings live only on this device; the bot token is never put in backups or sent anywhere but api.telegram.org.
(function () {
  const KEY = 'crypto-radar:telegram:v1';
  const get = () => { try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && c.token && c.chat ? c : null; } catch (e) { return null; } };
  const tokenOk = t => /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/.test(t);
  async function call(token, method, params) {
    // Form-encoded POST, so the browser sends it without a CORS preflight.
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: new URLSearchParams(params || {}) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.description || 'HTTP ' + r.status);
    return j.result;
  }
  window.CRTelegram = {
    get, tokenOk,
    set(token, chat) { try { localStorage.setItem(KEY, JSON.stringify({ token, chat: String(chat) })); } catch (e) {} },
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
    async send(text, cfg) { const c = cfg || get(); if (!c) return false; await call(c.token, 'sendMessage', { chat_id: c.chat, text, disable_web_page_preview: 'true' }); return true; },
    // The chat id of whoever last messaged the bot.
    async findChatId(token) {
      const ups = await call(token, 'getUpdates', { limit: '20' });
      for (let i = ups.length - 1; i >= 0; i--) { const m = ups[i].message || ups[i].my_chat_member || ups[i].channel_post; if (m && m.chat) return { id: m.chat.id, name: m.chat.first_name || m.chat.title || m.chat.username || '' }; }
      return null;
    },
  };
})();
