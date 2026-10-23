#!/usr/bin/env bash
# Copy the latest dashboard data (and page, if given) into the app, then commit and push.
# Usage: scripts/sync.sh [data_dir] [page_html]
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-/mnt/project-files/crypto-radar/data}"
PAGE="${2:-/mnt/project-files/crypto-radar/page.html}"

for f in "$SRC"/*.json; do
  python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$f"   # refuse broken JSON
  cp "$f" data/
done
if [ -f "$PAGE" ]; then cp "$PAGE" dashboard/page.html; fi
# English copies: files with any untranslated string fall back to Thai until translated (see scripts/translate-data.py).
python3 scripts/translate-data.py build
echo "window.APP_DATA_VERSION = '$(date -u +%Y%m%d%H%M)';" > js/version.js

git add data dashboard i18n js/version.js
if git diff --cached --quiet -- data dashboard i18n; then echo "No data changes"; git reset -q; exit 0; fi
git commit -q -m "Update data $(date -u +%Y-%m-%dT%H:%MZ)"
for i in 1 2 3 4; do git push -q origin HEAD:main && exit 0; sleep $((2 ** i)); done
exit 1
