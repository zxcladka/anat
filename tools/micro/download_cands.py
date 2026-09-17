"""Завантажити прев'ю перших 3 кандидатів на кожну ціль у tools/micro/cands/<id>_<n>.jpg і зібрати контактні аркуші sheet_<k>.jpg"""
import json, os, subprocess, time
import cv2, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); C = os.path.join(H, 'cands'); os.makedirs(C, exist_ok=True)
found = json.load(open(os.path.join(H, 'found.json'), encoding='utf-8'))
UA = 'AnatomiaTrainer/1.0 (educational; contact: pidverbeckijaroslav@gmail.com)'
ids = list(found)
for tid in ids:
    for i, c in enumerate(found[tid]['cands'][:3]):
        out = os.path.join(C, f'{tid}_{i}.jpg')
        if os.path.exists(out): continue
        if c['title'].lower().endswith(('.gif', '.webp', '.svg')): continue
        subprocess.run(['curl', '-s', '-L', '-m', '60', '-A', UA, '-o', out, c['thumb']]); time.sleep(0.8)
        im = cv2.imread(out)
        if im is None: print('bad', tid, i); os.remove(out)
        else: cv2.imwrite(out, im, [cv2.IMWRITE_JPEG_QUALITY, 85])
# аркуші: 4 цілі × 3 кандидати
def fit(im, w, h):
    s = min(w / im.shape[1], h / im.shape[0]); return cv2.resize(im, (max(1, int(im.shape[1] * s)), max(1, int(im.shape[0] * s))))
k = 0
for s in range(0, len(ids), 4):
    grp = ids[s:s + 4]; sheet = np.full((len(grp) * 320, 900, 3), 255, np.uint8)
    for r, tid in enumerate(grp):
        cv2.putText(sheet, tid, (4, r * 320 + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
        for i in range(3):
            p = os.path.join(C, f'{tid}_{i}.jpg')
            if not os.path.exists(p): continue
            im = fit(cv2.imread(p), 296, 280); y0 = r * 320 + 16; x0 = i * 300 + 2
            sheet[y0:y0 + im.shape[0], x0:x0 + im.shape[1]] = im
            cv2.putText(sheet, f'{i}: {found[tid]["cands"][i]["lic"][:18]}', (x0 + 2, r * 320 + 312), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
    cv2.imwrite(os.path.join(H, f'sheet_{k}.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 80]); k += 1
print('sheets', k)
