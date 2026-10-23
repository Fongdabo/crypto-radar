#!/usr/bin/env python3
"""English copies of the dashboard data for the app's English mode.

Thai strings in data/*.json are looked up in i18n/data-en.json (Thai -> English).
  missing      print the Thai strings that have no English yet (JSON list)
  add FILE     merge a JSON object {thai: english} into i18n/data-en.json
  build        write data/en/<id>.json for every file whose strings are all translated;
               a file with any untranslated string gets no English copy, so the app shows the Thai one
The `kind`, `trend` and `period` fields stay in Thai: the pages pick colours by them, and the app translates them on screen.
"""
import json, os, re, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP = os.path.join(ROOT, 'i18n', 'data-en.json')
THAI = re.compile('[ก-๛]')
KEEP = {'kind', 'trend', 'period'}

def load_map():
    try:
        with open(MAP, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError: return {}

def files():
    return sorted(p for p in glob.glob(os.path.join(ROOT, 'data', '*.json')))

def strings(v, key=None):
    if isinstance(v, str):
        if key not in KEEP and THAI.search(v): yield v
    elif isinstance(v, list):
        for x in v: yield from strings(x, key)
    elif isinstance(v, dict):
        for k, x in v.items(): yield from strings(x, k)

def apply(v, m, key=None):
    if isinstance(v, str): return m[v] if key not in KEEP and THAI.search(v) else v
    if isinstance(v, list): return [apply(x, m, key) for x in v]
    if isinstance(v, dict): return {k: apply(x, m, k) for k, x in v.items()}
    return v

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'missing'
    m = load_map()
    if cmd == 'missing':
        seen = []
        for p in files():
            with open(p, encoding='utf-8') as f: d = json.load(f)
            for s in strings(d):
                if s not in m and s not in seen: seen.append(s)
        print(json.dumps(seen, ensure_ascii=False, indent=0))
    elif cmd == 'add':
        with open(sys.argv[2], encoding='utf-8') as f: add = json.load(f)
        for k, v in add.items():
            if not isinstance(v, str) or not v.strip() or THAI.search(v): raise SystemExit('bad English for: ' + k)
        m.update(add)
        os.makedirs(os.path.dirname(MAP), exist_ok=True)
        with open(MAP, 'w', encoding='utf-8') as f: json.dump(m, f, ensure_ascii=False, indent=0, sort_keys=True)
        print('added', len(add), 'total', len(m))
    elif cmd == 'build':
        out = os.path.join(ROOT, 'data', 'en'); os.makedirs(out, exist_ok=True)
        used, skipped = set(), []
        for p in files():
            with open(p, encoding='utf-8') as f: d = json.load(f)
            ss = list(strings(d)); used.update(ss)
            target = os.path.join(out, os.path.basename(p))
            if all(s in m for s in ss):
                with open(target, 'w', encoding='utf-8') as f: json.dump(apply(d, m), f, ensure_ascii=False)
            else:
                skipped.append(os.path.basename(p))
                if os.path.exists(target): os.remove(target)
        # Forget translations no longer used, so the map stays small.
        m = {k: v for k, v in m.items() if k in used}
        with open(MAP, 'w', encoding='utf-8') as f: json.dump(m, f, ensure_ascii=False, indent=0, sort_keys=True)
        print('built; Thai only (untranslated):', ', '.join(skipped) or 'none')
    else:
        raise SystemExit(__doc__)

main()
