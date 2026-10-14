#!/usr/bin/env python3
"""Construit le HTML autonome à partir des sources maintenables (aucun réseau)."""
import json
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.template.html').read_text()
logo = base64.b64encode((ROOT / 'assets/orange-logo.svg').read_bytes()).decode()
html = html.replace('src="assets/orange-logo.svg"', 'src="data:image/svg+xml;base64,' + logo + '"')
license_text = (ROOT / 'vendor/EXCELJS-LICENSE').read_text()
html = html.replace('<head>', '<head>\n<!-- ExcelJS 4.4.0 — third-party license\n' + license_text + '\n-->')
data = json.loads((ROOT / 'data/recherches-historiques.json').read_text())
html = html.replace('__HISTORICAL_DATA__', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
supplied = json.loads((ROOT / 'data/complements-utilisateur.json').read_text())
html = html.replace('__SUPPLIED_DATA__', json.dumps(supplied, ensure_ascii=False).replace('<', '\\u003c'))
verified = json.loads((ROOT / 'data/recherches-verifiees.json').read_text())
html = html.replace('__VERIFIED_DATA__', json.dumps(verified, ensure_ascii=False).replace('<', '\\u003c'))
html = html.replace('<link rel="stylesheet" href="assets/styles.css">', '<style>\n' + (ROOT / 'assets/styles.css').read_text() + '\n</style>')
for filename in ['vendor/exceljs-4.4.0.min.js', 'assets/core.js', 'assets/app.js']:
    content = (ROOT / filename).read_text().replace('</script', '<\\/script')
    # L’artefact autonome ne dépend pas d’une source map externe.
    content = '\n'.join(line for line in content.splitlines() if not line.startswith('//# sourceMappingURL='))
    html = html.replace(f'<script src="{filename}"></script>', '<script>\n' + content + '\n</script>')
(ROOT / 'analyseurcode.html').write_text(html)
print(f'analyseurcode.html : {len(html.encode()):,} octets, ressources incluses')
