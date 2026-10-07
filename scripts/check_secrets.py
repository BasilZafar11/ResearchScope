"""Scan intended source files without printing matched secret values."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
excluded = {'.git','.venv','node_modules','dist','__pycache__','.pytest_cache','artifacts','.vercel','live'}
patterns = [
    re.compile(r'(?i)(?:api[_-]?key|SERPAPI_KEY|secret)\s*[:=]\s*[\"\']?[a-f0-9]{32,}'),
    re.compile(r'postgres(?:ql)?(?:\+psycopg)?://[^\s:]+:(?!PASSWORD|YOUR_PASSWORD|\[YOUR-PASSWORD\])[^\s@]+@'),
    re.compile(r'\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}'),
]
failures = []
for path in root.rglob('*'):
    if not path.is_file() or set(path.relative_to(root).parts)&excluded or path.name.startswith('.env'):
        continue
    if path.suffix not in {'.py','.ts','.tsx','.json','.md','.yml','.yaml','.txt','.html','.css'}:
        continue
    content = path.read_text(encoding='utf-8', errors='ignore')
    for pattern in patterns:
        if pattern.search(content):
            failures.append(str(path.relative_to(root)))
print('Potential credentials found in: ' + ', '.join(sorted(set(failures))) if failures else 'Source scan passed: no matching credential patterns.')
sys.exit(bool(failures))
