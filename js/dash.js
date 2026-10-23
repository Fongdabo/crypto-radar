// Stand-in for the claude.ai dashboard runtime, so dashboard/page.html runs unchanged.
// Each dataset is read from data/<id>.json (an array of rows, or one under rows/data/results).
(function () {
  const VERSION = window.APP_DATA_VERSION || '';
  const sets = {};      // id -> {status, data, message}
  const calcs = {};     // id -> {inputs, fn, title, description}
  const listeners = [];
  let queued = false;

  function notify() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      for (const fn of listeners) {
        try { fn(); } catch (e) { console.error(e); }
      }
    });
  }

  function rowsOf(json) {
    if (Array.isArray(json)) return json;
    if (json && typeof json === 'object') {
      for (const k of ['rows', 'data', 'results']) if (Array.isArray(json[k])) return json[k];
    }
    return json;
  }

  function load(id) {
    sets[id] = { status: 'loading', data: [], message: '' };
    (window.crFetchData ? window.crFetchData(id, VERSION ? '?v=' + VERSION : '') : fetch('data/' + encodeURIComponent(id) + '.json' + (VERSION ? '?v=' + VERSION : ''), { cache: 'no-cache' }))
      .then(r => {
        if (r.status === 404) { sets[id] = { status: 'missing', data: [], message: 'ยังไม่มีข้อมูล' }; return; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(j => { sets[id] = { status: 'ok', data: rowsOf(j), message: '' }; });
      })
      .catch(e => { sets[id] = { status: 'error', data: [], message: String(e.message || e) }; })
      .then(notify);
  }

  function result(s) {
    const data = s.data;
    const columns = Array.isArray(data) && data.length && typeof data[0] === 'object' ? Object.keys(data[0]) : [];
    return { status: s.status, data, rows: data, columns, value: data, message: s.message, refreshing: false, meta: [] };
  }

  function data(id) {
    const c = calcs[id];
    if (c) {
      const ins = c.inputs.map(data);
      const bad = ins.find(r => r.status !== 'ok');
      if (bad) return result({ status: bad.status === 'missing' ? 'error' : bad.status, data: [], message: bad.message });
      try { return result({ status: 'ok', data: c.fn(...ins.map(r => r.data)) }); }
      catch (e) { console.error(e); return result({ status: 'error', data: [], message: String(e.message || e) }); }
    }
    if (!sets[id]) load(id);
    return result(sets[id]);
  }

  let lastW = 0;
  window.addEventListener('resize', () => {
    const w = document.documentElement.clientWidth;
    if (w !== lastW) { lastW = w; notify(); }
  });

  window.dash = {
    data,
    onData(fn) { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    calc(id, def) { calcs[id] = def; },
    loader() {},
    refresh(id) { if (sets[id]) load(id); },
    setLink(name) { history.replaceState(null, '', '#' + encodeURIComponent(name)); },
    params() { return {}; },
    setParams() {},
    resetParams() {},
    colors: ['#2dd4bf', '#60a5fa', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#f87171', '#94a3b8'],
  };
})();
