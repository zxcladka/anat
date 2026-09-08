"""Озвучка латинських термінів: транскрипція (tools/latin_uk.py) → macOS `say -v Lesya` → AAC 32 kbps → audio/<slug>.m4a.
Запуск: python3 tools/make_audio.py [--force]. Пропускає вже готові файли. Слаг такий самий, як audioSlug() у js/app.js."""
import json, re, subprocess, sys, os, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from latin_uk import latin_to_uk, slug
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'audio'); os.makedirs(OUT, exist_ok=True)
def load_js(path, key):
    s = open(path, encoding='utf-8').read(); return json.loads(s.split(key, 1)[1].rstrip().rstrip(';'))
terms = set()
for st in load_js(os.path.join(ROOT, 'atlas/data.js'), 'window.ATLAS=')['sets']:
    for it in st['items']: terms.add(it['la'])
# facts.js — не JSON: витягнути латинські назви регулярним виразом
fs = open(os.path.join(ROOT, 'atlas/facts.js'), encoding='utf-8').read()
for m in re.finditer(r"^(?:M|J|N|B|O|P)\('[^']+',\s*'([^']+)'", fs, re.M): terms.add(m.group(1))
force = '--force' in sys.argv
todo = sorted(terms); done = 0; skipped = 0
tmp = tempfile.mkdtemp()
for t in todo:
    clean = re.sub(r'\(.*?\)', '', t).strip(); sl = slug(clean); out = os.path.join(OUT, sl + '.m4a')
    if not sl: continue
    if os.path.exists(out) and not force: skipped += 1; continue
    uk = latin_to_uk(t)
    aiff = os.path.join(tmp, 'x.aiff')
    subprocess.run(['say', '-v', 'Lesya', '-r', '150', '-o', aiff, uk], check=True)
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '32000', aiff, out], check=True, capture_output=True)
    done += 1
    if done % 50 == 0: print(done, 'done', flush=True)
print('total', len(todo), 'generated', done, 'skipped', skipped)
