"""Векторні схеми (Wikimedia SVG з номерами): переносить піни з номерів на кінці виносних ліній,
стирає номери та лінії з растру і зберігає чисту PNG-схему.

python3 tools/svg_clean.py <png-dir> [set-id ...]   — рахує; пише tools/svg_relocated.json, оверлеї в tools/overlay/svg/, чисті PNG в atlas/
python3 tools/svg_clean.py --apply                 — вписує нові файли/координати в atlas/data.js
"""
import json, sys, os, math
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from relocate_pins import merge_segments, drop_chains

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'atlas', 'data.js'); OUT = os.path.join(ROOT, 'tools', 'svg_relocated.json')
OVER = os.path.join(ROOT, 'tools', 'overlay', 'svg'); os.makedirs(OVER, exist_ok=True)
NO_STRAY = {'peritoneum', 'colon', 'nervous-system'}

def load_atlas():
    s = open(DATA, encoding='utf-8').read(); i = s.index('{'); j = s.rindex('}') + 1
    return s, json.loads(s[i:j]), i, j

def find_lines(bgr):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY); H, W = gray.shape; sc = min(W, H)
    nonwhite = (bgr.min(axis=2) < 235).astype(np.uint8)
    k = max(7, int(sc * 0.006) | 1)
    thick = cv2.morphologyEx(nonwhite, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    halo = cv2.dilate(thick, np.ones((5, 5), np.uint8))
    thin = (nonwhite & (1 - halo)).astype(np.uint8)
    segs = cv2.HoughLinesP(thin * 255, 1, np.pi / 360, threshold=max(8, int(sc * 0.008)), minLineLength=int(sc * 0.03), maxLineGap=int(sc * 0.03))
    segs = [tuple(map(int, r)) for r in np.asarray(segs).reshape(-1, 4)] if segs is not None else []
    lines = merge_segments(segs, sc)
    keep = []
    for A, B in lines:
        n = max(2, int(np.linalg.norm(B - A) / 3)); on = 0
        for t in np.linspace(0, 1, n):
            q = A + (B - A) * t; xi, yi = int(round(q[0])), int(round(q[1]))
            if 0 <= xi < W and 0 <= yi < H and thick[yi, xi]: on += 1
        if on / n < 0.7: keep.append((A, B, None))
    keep = drop_chains(keep, sc)
    return keep, thick, thin

def process(set_, png, dbg):
    img = cv2.imread(png); H, W = img.shape[:2]; sc = min(W, H)
    lines, thick, thin = find_lines(img)
    res = {}; erase = np.zeros((H, W), np.uint8); labels = []
    color = img.copy()
    for A, B, _ in lines: cv2.line(color, tuple(A.astype(int)), tuple(B.astype(int)), (0, 200, 255), 1)
    cands = []
    for ii, it in enumerate(set_['items']):
        for pi, (px, py) in enumerate(it['pts']):
            p = np.array([px / 100 * W, py / 100 * H])
            for ci, (A, B, _) in enumerate(lines):
                for near, far in ((A, B), (B, A)):
                    dn = np.linalg.norm(near - p)
                    if dn > sc * 0.05 or np.linalg.norm(far - p) < dn: continue
                    cands.append((dn, ii, pi, ci, near, far))
    cands.sort(key=lambda c: c[0]); assign = {}; used = set()
    for dn, ii, pi, ci, near, far in cands:
        if (ii, pi) in assign or ci in used: continue
        assign[(ii, pi)] = (near, far, ci); used.add(ci)
    for ii, it in enumerate(set_['items']):
        newpts = []
        for pi, (px, py) in enumerate(it['pts']):
            p = np.array([px / 100 * W, py / 100 * H]); labels.append(p)
            if (ii, pi) not in assign: newpts.append([px, py, 'keep']); cv2.circle(color, (int(p[0]), int(p[1])), 8, (255, 0, 200), 2); continue
            near, far, ci = assign[(ii, pi)]
            d = far - near; L = np.linalg.norm(d); d = d / max(L, 1)
            # колір лінії — медіана небілих пікселів уздовж знайденого відрізка
            samp = []
            for t in np.linspace(0.1, 0.9, 25):
                q = near + (far - near) * t; xi, yi = int(round(q[0])), int(round(q[1]))
                if 0 <= xi < W and 0 <= yi < H and img[yi, xi].min() < 235: samp.append(img[yi, xi].astype(int))
            lc = np.median(np.array(samp), axis=0) if samp else np.array([0, 0, 0])
            nrm = np.array([-d[1], d[0]]); target = far.copy(); since = 0; last = far.copy(); gapmax = sc * 0.04; hits = 0
            cur = far.copy(); trail = []
            for step in range(1, int(sc * 0.7)):
                cur = cur + d; xi, yi = int(round(cur[0])), int(round(cur[1]))
                if not (6 <= xi < W - 6 and 6 <= yi < H - 6): break
                best = None
                for o in (0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5):     # шукаємо колір лінії поперек і повертаємось на неї
                    px_ = img[int(round(cur[1] + nrm[1] * o)), int(round(cur[0] + nrm[0] * o))].astype(int)
                    if np.abs(px_ - lc).max() < 60: best = o; break
                if best is not None:
                    cur = cur + nrm * best; last = cur.copy(); since = 0; hits += 1; trail.append(cur.copy())
                    if len(trail) > 40: trail.pop(0)
                    if len(trail) >= 25: dd = trail[-1] - trail[0]; nn = np.linalg.norm(dd); d = dd / nn if nn > 1 else d; nrm = np.array([-d[1], d[0]])
                    cv2.circle(erase, (int(cur[0]), int(cur[1])), max(2, int(sc * 0.003)), 1, -1)
                else:
                    since += 1
                    if since > gapmax: break
            if hits > sc * 0.01: target = last
            far = target.copy()
            newpts.append([round(float(target[0] / W * 100), 2), round(float(target[1] / H * 100), 2), 'ok'])
            cv2.line(erase, tuple(near.astype(int)), tuple(far.astype(int)), 1, max(3, int(sc * 0.006)))
            cv2.circle(color, (int(p[0]), int(p[1])), 8, (0, 0, 255), 1); cv2.circle(color, (int(target[0]), int(target[1])), 9, (0, 160, 0), 2)
            cv2.putText(color, str(it['n']), (int(target[0]) + 10, int(target[1]) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 110, 0), 2, cv2.LINE_AA)
        res[it['n']] = newpts
    clean = img.copy()
    if set_['id'] not in NO_STRAY:                      # для лінійних малюнків стирати «зайве» на полі не можна
        margin = 1 - cv2.dilate(thick, np.ones((int(sc * 0.012) | 1, int(sc * 0.012) | 1), np.uint8))
        stray = ((thin > 0) & (margin > 0)).astype(np.uint8)
        stray = cv2.dilate(stray, np.ones((5, 5), np.uint8))
        erase = np.maximum(erase, stray)
    if erase.any():
        # на білому полі просто зафарбовуємо, поверх рисунка — inpaint
        white = (img.min(axis=2) >= 235)
        near_white = cv2.dilate(white.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        paint = erase.astype(bool) & (cv2.blur(white.astype(np.float32), (25, 25)) > 0.85)
        clean[paint] = 255
        rest = (erase.astype(bool) & ~paint).astype(np.uint8)
        if rest.any(): clean = cv2.inpaint(clean, rest * 255, 4, cv2.INPAINT_TELEA)
    cv2.imwrite(dbg, color)
    return res, clean

def main():
    s, atlas, i, j = load_atlas()
    if '--apply' in sys.argv:
        fixed = json.load(open(OUT, encoding='utf-8')); n = 0
        for st in atlas['sets']:
            f = fixed.get(st['id'])
            if not f: continue
            png = os.path.join(ROOT, 'atlas', st['id'] + '.png')
            if not os.path.exists(png): continue
            im = cv2.imread(png); st['file'] = 'atlas/' + st['id'] + '.png'; st['h'], st['w'] = im.shape[:2]
            for it in st['items']:
                pts = f.get(str(it['n']))
                if pts: it['pts'] = [[x, y] for x, y, t in pts]; n += 1
        open(DATA, 'w', encoding='utf-8').write(s[:i] + json.dumps(atlas, ensure_ascii=False) + s[j:]); print('applied', n); return
    pngdir = sys.argv[1]; ids = sys.argv[2:]
    prev = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    for st in atlas['sets']:
        if ids: 
            if st['id'] not in ids: continue
        elif not st['file'].endswith('.svg'): continue
        png = os.path.join(pngdir, st['id'] + '.png')
        if not os.path.exists(png): print('no png', st['id']); continue
        res, clean = process(st, png, os.path.join(OVER, st['id'] + '.png'))
        cv2.imwrite(os.path.join(ROOT, 'atlas', st['id'] + '.png'), clean, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        prev[st['id']] = {str(k): v for k, v in res.items()}
        tags = [t for v in res.values() for _, _, t in v]
        print(f"{st['id']:18s} перенесено {tags.count('ok'):3d}  лишилось {tags.count('keep'):3d}")
    json.dump(prev, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

if __name__ == '__main__': main()
