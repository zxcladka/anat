"""Мікроскоп: пошук і завантаження фото паразитів (яйця, цисти, членистоногі) з Wikimedia Commons.
Для кожного запиту бере перші результати з вільною ліцензією (PD / CC BY / CC BY-SA), зберігає прев'ю 900 px у atlas/micro/<id>.jpg
і метадані у tools/micro/found.json. Запити послідовні з паузами (Commons дає 429 на паралель)."""
import json, os, sys, time, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'atlas', 'micro'); os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'AnatomiaTrainer/1.0 (educational; contact: pidverbeckijaroslav@gmail.com)'}
API = 'https://commons.wikimedia.org/w/api.php'
import subprocess
def get(params):   # через curl: urllib у цій мережі зависає
    url = API + '?' + urllib.parse.urlencode(params)
    for t in range(4):
        try:
            out = subprocess.run(['curl', '-s', '-m', '40', '-A', UA['User-Agent'], url], capture_output=True, text=True, timeout=50).stdout
            if out: return json.loads(out)
        except Exception as e: print('  retry', e)
        time.sleep(4 * (t + 1))
    return None
TARGETS = json.load(open(os.path.join(os.path.dirname(__file__), 'targets.json'), encoding='utf-8'))
found = {}
fp = os.path.join(os.path.dirname(__file__), 'found.json')
if os.path.exists(fp): found = json.load(open(fp, encoding='utf-8'))
OK_LIC = ('public domain', 'pd', 'cc0', 'cc by 2.0', 'cc by 2.5', 'cc by 3.0', 'cc by 4.0', 'cc by-sa 2.0', 'cc by-sa 2.5', 'cc by-sa 3.0', 'cc by-sa 4.0', 'attribution')
for t in TARGETS:
    if t['id'] in found and found[t['id']].get('file'): continue
    print(t['id'], t['q'])
    r = get({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srsearch': t['q'] + ' filetype:bitmap', 'srlimit': 12, 'format': 'json'})
    hits = [h['title'] for h in (r or {}).get('query', {}).get('search', [])]
    time.sleep(1.2)
    if not hits: print('  no hits'); found[t['id']] = {'q': t['q'], 'cands': []}; continue
    r = get({'action': 'query', 'titles': '|'.join(hits[:8]), 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime', 'iiurlwidth': 900, 'format': 'json'})
    cands = []
    for pg in (r or {}).get('query', {}).get('pages', {}).values():
        ii = (pg.get('imageinfo') or [None])[0]
        if not ii or not ii.get('mime', '').startswith('image/'): continue
        m = ii.get('extmetadata', {}); lic = m.get('LicenseShortName', {}).get('value', ''); artist = m.get('Artist', {}).get('value', '')
        import re; artist = re.sub('<[^>]+>', '', artist).strip()[:80]
        if lic.lower() not in OK_LIC and not lic.lower().startswith('cc by'): continue
        cands.append({'title': pg['title'], 'lic': lic, 'licurl': m.get('LicenseUrl', {}).get('value', ''), 'artist': artist, 'thumb': ii.get('thumburl') or ii['url'], 'w': ii.get('width'), 'h': ii.get('height'), 'desc': re.sub('<[^>]+>', '', m.get('ImageDescription', {}).get('value', ''))[:200], 'src': ii['descriptionurl']})
    order = {t2: i for i, t2 in enumerate(hits)}; cands.sort(key=lambda c: order.get(c['title'], 99))
    found[t['id']] = {'q': t['q'], 'cands': cands}
    print('  cands', len(cands), [c['title'][:60] for c in cands[:3]])
    json.dump(found, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    time.sleep(1.5)
print('done')
