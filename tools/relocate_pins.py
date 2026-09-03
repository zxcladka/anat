"""Переносить піни з місця підпису на кінець виносної лінії біля кістки (пластини Sobotta, atlas/*.jpg).

python3 tools/relocate_pins.py [set-id ...]        — порахувати й записати tools/pins_relocated.json + оверлеї в tools/overlay/
python3 tools/relocate_pins.py --apply             — вписати результат у atlas/data.js (резервна копія data.js.bak)
"""
import json, sys, os, math
import numpy as np, cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'atlas', 'data.js')
OUT = os.path.join(ROOT, 'tools', 'pins_relocated.json')
OVER = os.path.join(ROOT, 'tools', 'overlay'); os.makedirs(OVER, exist_ok=True)

def load_atlas():
    s = open(DATA, encoding='utf-8').read(); i = s.index('{'); j = s.rindex('}') + 1
    return s, json.loads(s[i:j]), i, j

def merge_segments(segs, sc):
    """Зливає колінеарні відрізки Хафа в одну лінію. Повертає список (A, B)."""
    out = []
    for x1, y1, x2, y2 in segs:
        a = np.array([x1, y1], float); b = np.array([x2, y2], float)
        d = b - a; L = np.linalg.norm(d)
        if L < 1: continue
        d /= L; nrm = np.array([-d[1], d[0]])
        merged = False
        for m in out:
            md = m['d']
            if abs(md @ d) < math.cos(math.radians(7)): continue
            if abs((a - m['a']) @ m['n']) > sc * 0.007 or abs((b - m['a']) @ m['n']) > sc * 0.007: continue
            ta, tb = (a - m['a']) @ md, (b - m['a']) @ md
            lo, hi = min(ta, tb), max(ta, tb)
            if lo > m['t1'] + sc * 0.06 or hi < m['t0'] - sc * 0.06: continue
            m['t0'] = min(m['t0'], lo); m['t1'] = max(m['t1'], hi); merged = True; break
        if not merged: out.append({'a': a, 'd': d, 'n': nrm, 't0': 0.0, 't1': L})
    return [(m['a'] + m['d'] * m['t0'], m['a'] + m['d'] * m['t1']) for m in out]

def clean_bars(img):
    """Вибілює чорні смуги від скану (довгі, вузькі, дуже темні компоненти)."""
    H, W = img.shape
    very = (img < 70).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(very, 8)
    out = img.copy()
    for k in range(1, n):
        x, y, w, h, a = st[k]
        long, short = max(w, h), min(w, h)
        if long > 0.05 * min(W, H) and short < 0.02 * min(W, H) and a > 0.6 * long * short and long / max(1, short) > 6:
            out[lab == k] = 255            # суцільна вузька смуга (не пунктир: заповнення > 60 %)
    return out

def drop_chains(lines, sc):
    """Прибирає ланцюжки сегментів, що стикуються кінцями під різними кутами (дуги-«дужки» вздовж кістки)."""
    n = len(lines); tol = sc * 0.035
    ends = [(A, B) for A, B, _ in lines]
    deg = [[0, 0] for _ in range(n)]; par = list(range(n))
    def find(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for i in range(n):
        for j in range(i + 1, n):
            for ei in (0, 1):
                for ej in (0, 1):
                    if np.linalg.norm(ends[i][ei] - ends[j][ej]) < tol:
                        deg[i][ei] += 1; deg[j][ej] += 1; par[find(i)] = find(j)
    comp = {}
    for i in range(n): comp.setdefault(find(i), []).append(i)
    bad = set()
    for members in comp.values():
        if len(members) < 3: continue
        both = sum(1 for m in members if deg[m][0] and deg[m][1])
        total = sum(np.linalg.norm(ends[m][1] - ends[m][0]) for m in members)
        # розкид напрямків ланок: пряма пунктирна лінія — майже 0°, дуга чи ламана — багато
        angs = [math.degrees(math.atan2(*(ends[m][1] - ends[m][0])[::-1])) % 180 for m in members]
        spread = max(min(abs(a - b), 180 - abs(a - b)) for a in angs for b in angs)
        if both >= 2 and total > sc * 0.2 and spread > 20: bad.update(members)
    return [l for i, l in enumerate(lines) if i not in bad]

def find_lines(img, sc):
    img = clean_bars(img)
    soft = (img < 235).astype(np.uint8)                      # усе, що не білий папір
    k = max(9, int(sc * 0.009) | 1)
    closed = cv2.morphologyEx(soft, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))          # заліпити дрібні відблиски
    thick = cv2.morphologyEx(closed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))   # кістка: широке
    bone = cv2.dilate(thick, np.ones((3, 3), np.uint8))
    halo = cv2.dilate(thick, np.ones((7, 7), np.uint8))
    thin = (soft & (1 - halo)).astype(np.uint8)              # тонке поза кісткою: виноски (і сплошні, і пунктирні)
    segs = cv2.HoughLinesP(thin * 255, 1, np.pi / 360, threshold=max(8, int(sc * 0.009)), minLineLength=int(sc * 0.022), maxLineGap=int(sc * 0.025))
    segs = [tuple(map(int, r)) for r in np.asarray(segs).reshape(-1, 4)] if segs is not None else []
    lines = merge_segments(segs, sc)
    # лишаємо лінії, що мають помітну частину на білому полі (виноски починаються біля підпису)
    H, W = img.shape; keep = []
    for A, B in lines:
        n = max(2, int(np.linalg.norm(B - A) / 3)); on = 0
        for t in np.linspace(0, 1, n):
            q = A + (B - A) * t; xi, yi = int(round(q[0])), int(round(q[1]))
            if 0 <= xi < W and 0 <= yi < H and bone[yi, xi]: on += 1
        if on / n < 0.75 and np.linalg.norm(B - A) >= sc * 0.022: keep.append((A, B, None))
    keep = drop_chains(keep, sc)
    return keep, bone, img

def relocate_set(set_, img_path, dbg=None):
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None: return None
    H, W = img.shape; sc = min(W, H)
    chains, bone_d, img = find_lines(img, sc)
    ys, xs = np.where(bone_d > 0); centroid = np.array([xs.mean(), ys.mean()]) if len(xs) else np.array([W / 2, H / 2])
    res = {}
    color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR) if dbg is not None else None
    if color is not None:
        for A, B, P in chains: cv2.line(color, tuple(A.astype(int)), tuple(B.astype(int)), (0, 200, 255), 1)
    # 1) усі пари (підпис, лінія) з відстанню; 2) жадібно призначаємо найближчі, кожна лінія — один раз
    cands = []
    for ii, it in enumerate(set_['items']):
        for pi, (px, py) in enumerate(it['pts']):
            p = np.array([px / 100 * W, py / 100 * H])
            for ci, (A, B, P) in enumerate(chains):
                for near, far in ((A, B), (B, A)):
                    dn = np.linalg.norm(near - p)
                    if dn > sc * 0.24 or np.linalg.norm(far - p) < dn: continue
                    toward = np.linalg.norm(far - centroid) < np.linalg.norm(near - centroid)
                    cands.append((dn * (1 if toward else 2.2), ii, pi, ci, near, far))
    cands.sort(key=lambda c: c[0]); assign = {}; usedc = set()
    for dn, ii, pi, ci, near, far in cands:
        if (ii, pi) in assign or ci in usedc: continue
        assign[(ii, pi)] = (near, far); usedc.add(ci)
    for ii, it in enumerate(set_['items']):
        newpts = []
        for pi, (px, py) in enumerate(it['pts']):
            p = np.array([px / 100 * W, py / 100 * H])
            if (ii, pi) not in assign:
                ys, xs = np.where(bone_d > 0)
                if len(xs):
                    k = np.argmin((xs - p[0]) ** 2 + (ys - p[1]) ** 2); q = np.array([xs[k], ys[k]], float)
                    if np.linalg.norm(q - p) < sc * 0.25:
                        newpts.append([round(float(q[0] / W * 100), 2), round(float(q[1] / H * 100), 2), 'near'])
                        if color is not None: cv2.circle(color, (int(p[0]), int(p[1])), 6, (0, 0, 255), 1); cv2.circle(color, (int(q[0]), int(q[1])), 7, (255, 0, 200), 2); cv2.putText(color, str(it['n']), (int(q[0]) + 8, int(q[1]) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 0, 160), 1, cv2.LINE_AA)
                        continue
                newpts.append([px, py, 'keep']); continue
            near, far = assign[(ii, pi)]
            d = far - near; L = np.linalg.norm(d)
            if L < 1: newpts.append([px, py, 'keep']); continue
            d = d / L
            # 1) від далекого кінця вперед до краю кістки (до 25 % кадру)
            target = far.copy(); hit = False
            for step in range(int(sc * 0.25)):
                q = far + d * step; xi, yi = int(round(q[0])), int(round(q[1]))
                if not (0 <= xi < W and 0 <= yi < H): break
                if bone_d[yi, xi]: target = q; hit = True; break
            # 2) якщо лінія веде далі по кістці (темний пунктир на сірому) — йдемо за нею до останнього штриха
            if hit:
                nrm = np.array([-d[1], d[0]]); last = target.copy(); since = 0; gapmax = sc * 0.035; moved = 0; hits = 0
                for step in range(1, int(sc * 0.3)):
                    q = target + d * step; xi, yi = int(round(q[0])), int(round(q[1]))
                    if not (7 <= xi < W - 7 and 7 <= yi < H - 7): break
                    line_px = [int(img[int(round(q[1] + nrm[1] * o)), int(round(q[0] + nrm[0] * o))]) for o in (-1, 0, 1)]
                    ctx = [int(img[int(round(q[1] + nrm[1] * o)), int(round(q[0] + nrm[0] * o))]) for o in (-6, -5, 5, 6)]
                    dash = min(line_px) < 95 and np.mean(ctx) > min(line_px) + 45
                    if dash: last = q.copy(); since = 0; moved = step; hits += 1
                    else:
                        since += 1
                        if since > gapmax: break
                # приймаємо продовження, лише якщо штрихи щільні (пунктир), а не поодинокі тіні
                if moved > sc * 0.012 and hits / max(1, moved) >= 0.3: target = last
            newpts.append([round(float(target[0] / W * 100), 2), round(float(target[1] / H * 100), 2), 'ok' if hit else 'end'])
            if color is not None:
                cv2.circle(color, (int(p[0]), int(p[1])), 6, (0, 0, 255), 1)
                cv2.circle(color, (int(target[0]), int(target[1])), 7, (0, 160, 0), 2)
                cv2.putText(color, str(it['n']), (int(target[0]) + 8, int(target[1]) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 120, 0), 1, cv2.LINE_AA)
        res[it['n']] = newpts
    if color is not None: cv2.imwrite(dbg, color)
    return res

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    s, atlas, i, j = load_atlas()
    if '--apply' in sys.argv:
        fixed = json.load(open(OUT, encoding='utf-8'))
        changed = 0
        for st in atlas['sets']:
            f = fixed.get(st['id']);
            if not f: continue
            for it in st['items']:
                pts = f.get(str(it['n']))
                if not pts: continue
                new = [[x, y] for x, y, tag in pts if tag != 'keep'] or None
                if new and new != it['pts']: it['pts'] = new; changed += 1
        open(DATA + '.bak', 'w', encoding='utf-8').write(s)
        open(DATA, 'w', encoding='utf-8').write(s[:i] + json.dumps(atlas, ensure_ascii=False) + s[j:])
        print('applied, items changed:', changed); return
    prev = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    stats = {}
    for st in atlas['sets']:
        if not st['file'].endswith('.jpg'): continue
        if args and st['id'] not in args: continue
        r = relocate_set(st, os.path.join(ROOT, st['file']), os.path.join(OVER, st['id'] + '.png'))
        if r is None: continue
        prev[st['id']] = {str(k): v for k, v in r.items()}
        tags = [t for v in r.values() for _, _, t in v]
        stats[st['id']] = (tags.count('ok'), tags.count('end'), tags.count('near'), tags.count('keep'))
    json.dump(prev, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    for k, (ok, end, near, keep) in stats.items(): print(f'{k:22s} на кістці {ok:3d}  кінець лінії {end:3d}  найближче {near:3d}  без лінії {keep:3d}')

if __name__ == '__main__': main()
