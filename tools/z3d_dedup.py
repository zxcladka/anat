"""Прибирає дубльовані грубі оболонки з експортованих 3D-моделей (у Z-Anatomy кожна кістка має точну сітку + низькополігональну копію;
через накладання оболонок точки вважались «прихованими» з більшості ракурсів) і заново притягує піни до поверхні.
Також ставить «Hiatus sacralis» біля крижових рогів (маркер Z-Anatomy стоїть угорі крижової кістки — помилка джерела).
Запуск: .venv/bin/python tools/z3d_dedup.py [set-id …]  (без аргументів — усі набори з model:true). Пише models/*.glb і atlas/data.js."""
import trimesh, numpy as np, json, os, sys, re
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
p = A + 'atlas/data.js'; txt = open(p, encoding='utf-8').read(); head, body = txt.split('window.ATLAS=', 1); data = json.loads(body.rstrip().rstrip(';'))
want = sys.argv[1:]
def proj(v): return [round((v[0] + 0.5) * 100, 2), round((0.5 - v[1]) * 100, 2)]
for s in data['sets']:
    if not s.get('model') or (want and s['id'] not in want): continue
    f = A + s['file']; sc = trimesh.load(f, force='scene')
    nodes = []
    for n in sc.graph.nodes_geometry:
        T, g = sc.graph[n]; m = sc.geometry[g].copy(); m.apply_transform(T); nodes.append((n, m))
    by = {}
    for n, m in nodes: by.setdefault(n.split('#')[0], []).append((n, m))
    keep, dropped = [], []
    for b, lst in by.items():
        lst.sort(key=lambda x: -len(x[1].vertices)); big = lst[0][1]; keep.append(lst[0])
        for n, m in lst[1:]:
            d = trimesh.proximity.closest_point(big, m.vertices[::max(1, len(m.vertices) // 150)])[1].mean()
            inside = np.all(m.bounds[0] >= big.bounds[0] - 0.02) and np.all(m.bounds[1] <= big.bounds[1] + 0.02)
            small = len(m.vertices) < 0.2 * len(big.vertices)   # груба копія частини кістки (кульшова: 148 вершин при 1024)
            if d < 0.04 or inside or (small and d < 0.1): dropped.append(f'{b}:{len(m.vertices)}v d={d:.3f}{" in" if inside else ""}')
            else: keep.append((n, m))
    if not dropped and s['id'] not in ('v3-sacrum', 'v3-pelvis'): print(s['id'], 'без змін'); continue
    whole = trimesh.util.concatenate([m for _, m in keep])
    moved = 0
    for it in s['items']:
        q = np.array(it['p3']); (cp,), (dist,), _ = trimesh.proximity.closest_point(whole, [q])
        if dist > 1e-4: moved += 1; it['p3'] = [round(float(x), 4) for x in cp]; it['pts'] = [proj(cp)]
    if s['id'] in ('v3-sacrum', 'v3-pelvis'):
        cor = next((i for i in s['items'] if i['la'] == 'Cornu sacrale'), None); hi = next((i for i in s['items'] if i['la'] == 'Hiatus sacralis'), None)
        if cor and hi:
            q = np.array([0.0, cor['p3'][1] + 0.04, cor['p3'][2]]); (cp,), _, _ = trimesh.proximity.closest_point(whole, [q]); hi['p3'] = [round(float(x), 4) for x in cp]; hi['pts'] = [proj(cp)]
    out = trimesh.Scene()
    for n, m in keep: out.add_geometry(m, node_name=n, geom_name=n)
    out.export(f)
    print(s['id'], 'меші', len(nodes), '→', len(keep), '| прибрано:', dropped, '| пінів пересунуто:', moved, '|', os.path.getsize(f) // 1024, 'KB')
open(p, 'w', encoding='utf-8').write(head + 'window.ATLAS=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('data.js оновлено')
