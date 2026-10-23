// Temporary diagnostic: which wallet/price endpoints answer a browser request from fongdabo.github.io (CORS + status).
const ORIGIN = 'https://fongdabo.github.io';
const SOL = 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg';
const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const rpc = (method, params) => JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
const solRpcs = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com', 'https://solana.drpc.org', 'https://endpoints.omniatech.io/v1/sol/mainnet/public', 'https://solana.api.onfinality.io/public', 'https://public.rpc.solanavibestation.com', 'https://solana.leorpc.com/?api_key=FREE', 'https://rpc.ankr.com/solana'];
const tests = [];
for (const u of solRpcs) {
  tests.push([u + ' getBalance', u, rpc('getBalance', [SOL])]);
  tests.push([u + ' getTokenAccountsByOwner', u, rpc('getTokenAccountsByOwner', [SOL, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }])]);
}
for (const u of ['https://api.roninchain.com/rpc', 'https://ronin.drpc.org', 'https://ronin.lgns.net/rpc', 'https://ronin-mainnet.public.blastapi.io']) tests.push([u + ' eth_getBalance', u, rpc('eth_getBalance', [EVM, 'latest'])]);
for (const h of ['eth', 'base', 'polygon', 'arbitrum', 'optimism']) {
  tests.push([h + ' blockscout addr', `https://${h}.blockscout.com/api/v2/addresses/${EVM}`]);
  tests.push([h + ' blockscout tokens', `https://${h}.blockscout.com/api/v2/addresses/${EVM}/token-balances`]);
}
tests.push(['eth publicnode rpc', 'https://ethereum-rpc.publicnode.com', rpc('eth_getBalance', [EVM, 'latest'])]);
tests.push(['coingecko', 'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum&vs_currencies=usd']);
tests.push(['binance', 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT']);
tests.push(['jupiter lite', 'https://lite-api.jup.ag/tokens/v2/search?query=So11111111111111111111111111111111111111112']);
tests.push(['jupiter price v3', 'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112']);
tests.push(['dexscreener', 'https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112']);
for (const [name, url, body] of tests) {
  const out = [name];
  try {
    if (body) {
      const pre = await fetch(url, { method: 'OPTIONS', headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, signal: AbortSignal.timeout(15000) });
      out.push('preflight=' + pre.status + ' acao=' + pre.headers.get('access-control-allow-origin') + ' ach=' + pre.headers.get('access-control-allow-headers'));
    }
    const t = Date.now();
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: Object.assign({ Origin: ORIGIN }, body ? { 'content-type': 'application/json' } : {}), body, signal: AbortSignal.timeout(20000) });
    const txt = await r.text();
    out.push('status=' + r.status + ' acao=' + r.headers.get('access-control-allow-origin') + ' ms=' + (Date.now() - t) + ' body=' + txt.slice(0, 160).replace(/\s+/g, ' '));
  } catch (e) { out.push('ERROR ' + e.message); }
  console.log(out.join(' | '));
}
