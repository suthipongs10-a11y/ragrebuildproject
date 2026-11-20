# Merges translations into a catalog: lines "Thai<TAB>English" from a file (or stdin) into src/lang/<lang>.json.
# A line whose Thai is already there replaces it. Usage: python3 tools/i18n-add.py en < lines.tsv
import json, os, sys
lang = sys.argv[1] if len(sys.argv) > 1 else 'en'
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'lang', lang + '.json')
cat = json.load(open(path, encoding='utf8'))
src = open(sys.argv[2], encoding='utf8') if len(sys.argv) > 2 else sys.stdin
n = 0
for line in src:
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('#'): continue
    if '\t' not in line: print('no tab:', line[:60], file=sys.stderr); continue
    th, en = line.split('\t', 1)
    th = ' '.join(th.split()); cat[th] = en.strip(); n += 1
json.dump(cat, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(n, 'lines merged,', len(cat), 'in', lang + '.json')
