// Shared coin lookups: CoinGecko ids for symbols, cached JSON fetches and live USD prices.
(function () {
  const CG = 'https://api.coingecko.com/api/v3';
  // Common symbols, so most coins need no search call.
  const KNOWN = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', TRX: 'tron', XLM: 'stellar', USDT: 'tether', USDC: 'usd-coin',
    BNB: 'binancecoin', POL: 'polygon-ecosystem-token', MATIC: 'matic-network', ARB: 'arbitrum', OP: 'optimism',
    SAND: 'the-sandbox', AXS: 'axie-infinity', MANA: 'decentraland', GALA: 'gala', IMX: 'immutable-x', ILV: 'illuvium',
    APE: 'apecoin', RON: 'ronin', BEAM: 'beam-2', YGG: 'yield-guild-games', PIXEL: 'pixels', SUPER: 'superfarm',
  };

  async function getJson(u, maxAgeMs) {
    const key = 'cr-cache:' + u, age = maxAgeMs == null ? 5 * 60e3 : maxAgeMs;
    try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.at < age) return c.data; } catch (e) {}
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    if (!r.ok) { const e = new Error(String(r.status)); e.status = r.status; throw e; }
    const data = await r.json();
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch (e) {}
    return data;
  }

  let analysisIds = null;
  function fromAnalysis() {
    if (!analysisIds) analysisIds = fetch('data/analysis.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []).then(j => {
      const m = {};
      for (const x of Array.isArray(j) ? j : []) if (x && x.token && x.coingecko_id) m[String(x.token).toUpperCase()] = x.coingecko_id;
      return m;
    }).catch(() => ({}));
    return analysisIds;
  }

  async function resolveId(sym) {
    const S = String(sym || '').toUpperCase();
    if (!S) return null;
    const a = await fromAnalysis();
    if (a[S]) return a[S];
    if (KNOWN[S]) return KNOWN[S];
    try { const m = JSON.parse(localStorage.getItem('cr-ids') || '{}'); if (m[S]) return m[S]; } catch (e) {}
    const j = await getJson(CG + '/search?query=' + encodeURIComponent(S), 24 * 3600e3);
    const hit = (j.coins || []).filter(c => String(c.symbol).toUpperCase() === S).sort((x, y) => (x.market_cap_rank || 1e9) - (y.market_cap_rank || 1e9))[0];
    if (!hit) return null;
    try { const m = JSON.parse(localStorage.getItem('cr-ids') || '{}'); m[S] = hit.id; localStorage.setItem('cr-ids', JSON.stringify(m)); } catch (e) {}
    return hit.id;
  }

  // {id: usd} for up to ~100 ids in one call; fresh within a minute.
  async function livePrices(ids) {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return {};
    const j = await getJson(CG + '/simple/price?vs_currencies=usd&include_24hr_change=true&ids=' + list.join(','), 60e3);
    const out = {};
    for (const id of list) if (j[id] && j[id].usd != null) out[id] = { usd: Number(j[id].usd), change24: j[id].usd_24h_change };
    return out;
  }

  window.CR = { CG, KNOWN, getJson, resolveId, livePrices };
})();
