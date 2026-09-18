"""3D-таз (v3-pelvis): обидві кульшові кістки + крижова кістка + куприк із Z-Anatomy, маркери правої кульшової кістки (ключові),
крижової кістки, куприка й «кісткового таза» (погранична лінія, отвори таза, лобкова дуга). Також перезбирає v3-hip без
смужок м'язових прикріплень (.o5r тощо), які раніше давали «нитку» біля гребеня.
Запуск із теки, де лежить SkeletalSystem100.glb: .venv/bin/python tools/z3d_pelvis.py → glb/*.glb, models/*.glb, оновлює atlas/data.js і curriculum."""
import trimesh, numpy as np, json, re, os, shutil, sys
A = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
SC = trimesh.load('SkeletalSystem100.glb', force='scene')
parent = {}
for e in SC.graph.to_edgelist(): parent[e[1]] = e[0]
def path(n):
    p = [n]
    while n in parent: n = parent[n]; p.append(n)
    return list(reversed(p))
base = lambda n: re.sub(r'_[0-9a-f]{6}$', '', n)
# словник кульшової кістки — з tools/z3d_bones.py (текст між 'LA = {' і '\n}')
src = open(A + 'tools/z3d_bones.py', encoding='utf-8').read()
LA = eval(src[src.index('LA = {') + 5: src.index('\n}\n', src.index('LA = {')) + 2])
LA.update({
 'Promontory': ('Promontorium', 'Мис'), 'Ala of sacrum': ('Ala ossis sacri', 'Крило крижової кістки'), 'Base of sacrum': ('Basis ossis sacri', 'Основа крижової кістки'), 'Apex of sacrum': ('Apex ossis sacri', 'Верхівка крижової кістки'),
 'Pelvic surface of sacrum': ('Facies pelvica ossis sacri', 'Тазова поверхня крижової кістки'), 'Dorsal surface of sacrum': ('Facies dorsalis ossis sacri', 'Дорсальна поверхня крижової кістки'), 'Anterior sacral foramina': ('Foramina sacralia anteriora', 'Передні крижові отвори'), 'Posterior sacral foramina': ('Foramina sacralia posteriora', 'Задні крижові отвори'),
 'Median sacral crest': ('Crista sacralis mediana', 'Серединний крижовий гребінь'), 'Intermediate sacral crest': ('Crista sacralis medialis', 'Присередній крижовий гребінь'), 'Lateral sacral crest': ('Crista sacralis lateralis', 'Бічний крижовий гребінь'), 'Auricular surface of sacrum': ('Facies auricularis ossis sacri', 'Вушкоподібна поверхня крижової кістки'),
 'Sacral tuberosity': ('Tuberositas ossis sacri', 'Крижова горбистість'), 'Sacral canal': ('Canalis sacralis', 'Крижовий канал'), 'Sacral hiatus': ('Hiatus sacralis', 'Крижовий розтвір'), 'Sacral horn': ('Cornu sacrale', 'Крижовий ріг'), 'Superior articular process of sacrum': ('Processus articularis superior ossis sacri', 'Верхній суглобовий відросток крижової кістки'), 'Lateral part of sacrum': ('Pars lateralis ossis sacri', 'Бічна частина крижової кістки'), 'Sacrum': ('Os sacrum', 'Крижова кістка'),
 'Coccyx': ('Os coccygis', 'Куприк'), 'Base of coccyx': ('Basis ossis coccygis', 'Основа куприка'), 'Apex of coccyx': ('Apex ossis coccygis', 'Верхівка куприка'), 'Coccygeal horn': ('Cornu coccygeum', 'Куприковий ріг'),
 'Linea terminalis': ('Linea terminalis', 'Погранична лінія'), 'Pelvic inlet': ('Apertura pelvis superior', 'Верхній отвір таза'), 'Pelvic outlet': ('Apertura pelvis inferior', 'Нижній отвір таза'), 'Pubic arch': ('Arcus pubicus', 'Лобкова дуга'), 'Subpubic angle': ('Angulus subpubicus', 'Підлобковий кут'),
 'Greater pelvis': ('Pelvis major', 'Великий таз'), 'Lesser pelvis': ('Pelvis minor', 'Малий таз'), 'Pelvic cavity': ('Cavitas pelvis', 'Порожнина таза'), 'Pelvic girdle': ('Cingulum pelvicum', 'Тазовий пояс'),
 'Symphysial surface of pubis': ('Symphysis pubica (facies symphysialis)', 'Лобковий симфіз (симфізна поверхня)'), 'Hip bone': ('Os coxae', 'Кульшова кістка'),
})
HIP_KEYS = ['Iliac crest', 'Anterior superior iliac spine', 'Anterior inferior iliac spine', 'Posterior superior iliac spine', 'Iliac fossa', 'Arcuate line of ilium', 'Auricular surface of ilium', 'Acetabulum', 'Obturator foramen', 'Ischial tuberosity', 'Ischial spine', 'Greater sciatic notch', 'Lesser sciatic notch', 'Pubic tubercle', 'Pecten pubis', 'Symphysial surface of pubis', 'Superior pubic ramus', 'Inferior pubic ramus', 'Ramus of ischium', 'Iliopubic eminence', 'Ilium', 'Ischium', 'Pubis', 'Ala of ilium', 'Pubic crest', 'Iliac tubercle']
WHOLE = {'Ilium', 'Ischium', 'Pubis', 'Sacrum', 'Coccyx', 'Hip bone'}
SPACE = {'Pelvic inlet', 'Pelvic outlet', 'Greater pelvis', 'Lesser pelvis', 'Pelvic cavity', 'Pubic arch', 'Subpubic angle', 'Pelvic girdle', 'Obturator foramen', 'Sacral canal'}
def proj(p): return [round((p[0] + 0.5) * 100, 2), round((0.5 - p[1]) * 100, 2)]

def collect(mesh_groups, mesh_re, marker_groups, keys=None):
    meshes, markers = [], []
    for n in SC.graph.nodes_geometry:
        p = [base(x) for x in path(n)]; b = base(n)
        T, gname = SC.graph[n]; g = SC.geometry[gname]
        if n.endswith('.j') or b.endswith('.j'):
            if any(mg in p for mg in marker_groups):
                nm = b[:-2]
                if keys is None or nm in keys: markers.append((nm, trimesh.transform_points(g.vertices, T).mean(axis=0)))
            continue
        if any(mg in p for mg in mesh_groups) and re.fullmatch(mesh_re, b):
            m = g.copy(); m.apply_transform(T); meshes.append((b, m))
    return meshes, markers

def build(S):
    meshes, markers = [], []
    for part in S['parts']:
        ms, mk = collect(part['groups'], part['mesh_re'], part.get('markers', []), part.get('keys'))
        meshes += ms; markers += mk
    allm = trimesh.util.concatenate([m for _, m in meshes]); c = allm.bounds.mean(axis=0); s = 1.0 / np.max(allm.extents)
    scene = trimesh.Scene(); items = []; seen = set()
    for i, (b, m) in enumerate(meshes):
        m.apply_translation(-c); m.apply_scale(s); m.merge_vertices(); m.visual = trimesh.visual.ColorVisuals(m, face_colors=[236, 229, 212, 255])
        scene.add_geometry(m, node_name=f'{b}#{i}', geom_name=f'{b}#{i}')
    R = trimesh.transformations.rotation_matrix(np.pi, [0, 1, 0]) if S.get('rot') else np.eye(4)   # у Z-Anatomy перед = +z, поворот не потрібен (rot лишено як опцію)
    for _, m in meshes: m.apply_transform(R)
    whole = trimesh.util.concatenate([m for _, m in meshes])
    for nm, pt in markers:
        if nm not in LA or nm in seen: continue
        q = trimesh.transform_points([(np.asarray(pt) - c) * s], R)[0]
        (cp,), (dist,), _ = trimesh.proximity.closest_point(whole, [q])
        lim = 0.3 if nm in SPACE else 0.2 if nm in WHOLE else 0.12   # маркери Z-Anatomy стоять поруч зі структурою; для цілих кісток допуск більший
        if dist > lim: print('  drop', nm, round(float(dist), 3)); continue
        seen.add(nm); la, uk = LA[nm]; items.append({'n': len(items) + 1, 'la': la, 'uk': uk, 'pts': [proj(cp)], 'p3': [round(float(x), 4) for x in cp]})
    for nm, fn in S.get('synth', {}).items():   # точки без маркерів у Z-Anatomy — з геометрії
        v = fn(whole.vertices)
        if v is None: continue
        la, uk = LA[nm]; items.append({'n': len(items) + 1, 'la': la, 'uk': uk, 'pts': [proj(v)], 'p3': [round(float(x), 4) for x in v]})
    os.makedirs('glb', exist_ok=True); out = f"glb/{S['id']}.glb"; scene.export(out); shutil.copy(out, A + f"models/{S['id']}.glb")
    print(S['id'], os.path.getsize(out) // 1024, 'KB; meshes', len(meshes), 'items', len(items), '; маркерів без назви:', sorted({nm for nm, _ in markers if nm not in LA})[:12])
    return {'id': S['id'], 'title': S['title'], 'cat': 'Нижня кінцівка', 'file': f"models/{S['id']}.glb", 'model': True, 'w': 1000, 'h': 1000, 'items': items, 'thumb': f"models/{S['id']}.jpg", 'rel2d': S['rel2d'],
        'credit': {'artist': 'Z-Anatomy (Lluís Vinent Juanico), за BodyParts3D', 'license': 'CC BY-SA 4.0', 'licurl': 'https://creativecommons.org/licenses/by-sa/4.0/', 'source': 'https://github.com/LluisV/Z-Anatomy'}}

SETS = [
 dict(id='v3-hip', title='Кульшова кістка — 3D', rel2d='ll-132', parts=[dict(groups=['Hip bone.r'], mesh_re=r'Hip bone\.r', markers=['Hip bone.r'])]),
 dict(id='v3-pelvis', title='Таз (кістковий) — 3D', rel2d='ll-134', parts=[
   dict(groups=['Hip bone.r'], mesh_re=r'Hip bone\.r', markers=['Hip bone.r'], keys=HIP_KEYS),
   dict(groups=['Hip bone.l'], mesh_re=r'Hip bone\.l'),
   dict(groups=['Sacrum'], mesh_re=r'Sacrum', markers=['Sacrum']),
   dict(groups=['Coccyx'], mesh_re=r'Coccyx', markers=['Coccyx']),
   dict(groups=['Bony pelvis.g'], mesh_re=r'(?!)', markers=['Bony pelvis.g', 'Pelvic girdle.g'])],
   synth={
    'Subpubic angle': lambda V: (lambda m: V[m][np.argmin(V[m][:, 1])] if m.any() else None)((np.abs(V[:, 0]) < 0.05) & (V[:, 2] > 0.1)),     # найнижча точка біля симфізу спереду
    'Pubic arch': lambda V: (lambda m: V[m][np.argmin(V[m][:, 1])] if m.any() else None)((V[:, 0] > 0.09) & (V[:, 0] < 0.16) & (V[:, 2] > 0.1)),  # нижній край гілки праворуч від симфізу
   }),
 dict(id='v3-femur', title='Стегнова кістка — 3D', rel2d='ll-137', parts=[dict(groups=['Femur.r'], mesh_re=r'Femur\.r', markers=['Femur.r'])]),
]
new = {S['id']: build(S) for S in SETS}
# встановити в data.js (замінити наявні, вставити нові після v3-hip)
p = A + 'atlas/data.js'; txt = open(p, encoding='utf-8').read(); head, body = txt.split('window.ATLAS=', 1); data = json.loads(body.rstrip().rstrip(';'))
old = {s['id']: s for s in data['sets']}
for sid, s in new.items():
    if sid in old: old[sid].update(s)
for sid, s in new.items():
    if sid not in old: i = next(k for k, x in enumerate(data['sets']) if x['id'] == 'v3-hip'); data['sets'].insert(i + 1, s)
open(p, 'w', encoding='utf-8').write(head + 'window.ATLAS=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
cp = A + 'atlas/curriculum.js'; ct = open(cp, encoding='utf-8').read()
if '"v3-pelvis"' not in ct: ct = ct.replace('"v3-hip"', '"v3-hip",\n        "v3-pelvis"', 1)
open(cp, 'w', encoding='utf-8').write(ct)
print('data.js + curriculum оновлено')
