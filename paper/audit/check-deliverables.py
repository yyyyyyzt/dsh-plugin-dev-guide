from pathlib import Path
import hashlib, json, re
from urllib.parse import unquote

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'input-manifest.json').read_text())
input_checks = []
for item in manifest['inputs']:
    p = Path(item['path'])
    actual = hashlib.sha256(p.read_bytes()).hexdigest()
    input_checks.append({'role': item['role'], 'unchanged': actual == item['sha256'], 'sha256': actual})
required = ['final-review.md', 'revision-plan.md', 'final-response-matrix.md',
            'panel/eic-review.md', 'panel/r1-review.md', 'panel/r2-review.md',
            'panel/r3-review.md', 'panel/da-review.md', 'panel/critical-adjudication.md',
            'panel/panel-provenance.md', 'integrity-checkpoint.md',
            'history-integrity.md', 'code-data-integrity.md', 'references-integrity.md',
            'journal-reference-evidence.md', 'journal-official-requirements.md',
            'originality-screen.md', 'pending-denominator-note.md']
missing = [x for x in required if not (base / x).is_file()]
link_errors = []
files = []
for name in required:
    p = base / name
    if not p.is_file():
        continue
    raw = p.read_bytes()
    files.append({'path': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    text = raw.decode('utf-8')
    targets = re.findall(r'\]\(<?([^\s)>]+)>?\)', text)
    targets += re.findall(r'^\[[^\]]+\]:\s*<?([^\s>]+)>?', text, flags=re.M)
    for target in targets:
        if target.startswith(('https:', 'http:', 'mailto:', '#')):
            continue
        pathpart, _, anchor = target.partition('#')
        dest = Path(unquote(pathpart))
        if not dest.is_absolute():
            dest = p.parent / dest
        if not dest.exists():
            link_errors.append({'source': name, 'target': target, 'error': 'missing_local_target'})
        elif anchor and re.fullmatch(r'L\d+(?:-L?\d+)?', anchor) and dest.suffix.lower() in {'.md','.txt','.tex','.ts','.json','.yaml','.py','.mjs'}:
            try:
                count = len(dest.read_text().splitlines())
                high = max(map(int, re.findall(r'\d+', anchor)))
                if high > count:
                    link_errors.append({'source': name, 'target': target, 'error': 'line_anchor_out_of_range', 'lines': count})
            except (UnicodeError, OSError):
                pass
result = {'input_hash_checks': input_checks, 'required_missing': missing,
          'local_link_errors': link_errors, 'artifact_hashes': files,
          'scope': 'Existence, raw input integrity, local link target/line bounds only. No semantic, scientific, or ARS-contract certification.'}
(base / 'delivery-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({'inputs_unchanged': all(x['unchanged'] for x in input_checks),
                  'required_missing': missing, 'local_link_errors': link_errors,
                  'checked_artifacts': len(files)}, ensure_ascii=False, indent=2))
raise SystemExit(0 if not missing and not link_errors and all(x['unchanged'] for x in input_checks) else 1)
