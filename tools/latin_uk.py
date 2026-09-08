"""Латинський анатомічний термін → українська фонетична транскрипція (традиційна «медична» вимова,
як читають на кафедрах: c перед e/i/y/ae/oe → ц, ae/oe → е, ti+голосна → ці, qu → кв, ngu → нгв,
s між голосними → з, l м’яке, j → й, h → г, g → ґ, ph → ф, th → т, ch → х, rh → р, x → кс).
Використовується для генерації озвучки (tools/make_audio.py) і продубльовано в js/app.js (latinToUk)."""
import re

VOW = 'aeiouy'
SOFT = {'a': 'я', 'e': 'е', 'i': 'і', 'o': 'о', 'u': 'ю', 'y': 'і', 'E': 'е'}   # після м’якого l та після j
PLAIN = {'a': 'а', 'e': 'е', 'i': 'і', 'o': 'о', 'u': 'у', 'y': 'і'}

def word_to_uk(w):
    w = w.lower()
    # діграфи спочатку
    w = w.replace('ae', 'E').replace('oe', 'E')            # E = «е» (ае/ое)
    w = w.replace('ph', 'F').replace('th', 'T').replace('rh', 'R').replace('ch', 'X')
    out = []; i = 0; n = len(w)
    def vow(ch): return ch in VOW or ch == 'E'
    while i < n:
        ch = w[i]; nx = w[i + 1] if i + 1 < n else ''; nx2 = w[i + 2] if i + 2 < n else ''; pv = w[i - 1] if i > 0 else ''
        if ch == 'E': out.append('е'); i += 1; continue
        if ch == 'F': out.append('ф'); i += 1; continue
        if ch == 'T': out.append('т'); i += 1; continue
        if ch == 'R': out.append('р'); i += 1; continue
        if ch == 'X': out.append('х'); i += 1; continue
        if ch == 'q' and nx == 'u': out.append('кв'); i += 2; continue
        if ch == 'n' and nx == 'g' and nx2 == 'u' and i + 3 < n and vow(w[i + 3]): out.append('нгв'); i += 3; continue
        if ch == 's' and nx == 'u' and nx2 and vow(nx2) and pv and vow(pv): out.append('зв'); i += 2; continue   # persuadeo (рідко)
        if ch == 'c':
            if nx in ('e', 'i', 'y', 'E'): out.append('ц')
            else: out.append('к')
            i += 1; continue
        if ch == 't' and nx == 'i' and nx2 and vow(nx2) and pv not in ('s', 't', 'x'): out.append('ц'); i += 1; continue
        if ch == 's':
            out.append('з' if (pv and vow(pv) and nx and vow(nx)) else 'с'); i += 1; continue
        if ch == 'x': out.append('кс'); i += 1; continue
        if ch == 'z': out.append('з'); i += 1; continue
        if ch == 'h': out.append('г'); i += 1; continue
        if ch == 'g': out.append('ґ'); i += 1; continue
        if ch == 'j':
            if nx and vow(nx): out.append(SOFT.get(nx, 'й' + PLAIN.get(nx, ''))); i += 2
            else: out.append('й'); i += 1
            continue
        if ch == 'l':
            if nx == 'l': out.append('л'); i += 1
            elif nx and vow(nx): out.append('л' + SOFT[nx]); i += 2
            else: out.append('ль'); i += 1
            continue
        if ch == 'i' and pv in ('a', 'e') and (not nx or not vow(nx)): out.append('й'); i += 1; continue   # clei-do → клейдо; але -oideus → -оідеус
        if ch == 'i' and pv and vow(pv) and pv != 'i' and nx and vow(nx): out.append('й'); i += 1; continue   # ma-ior → майор
        if ch in PLAIN: out.append(PLAIN[ch]); i += 1; continue
        m = {'b': 'б', 'd': 'д', 'f': 'ф', 'k': 'к', 'm': 'м', 'n': 'н', 'p': 'п', 'r': 'р', 't': 'т', 'v': 'в', 'w': 'в'}
        out.append(m.get(ch, ch)); i += 1
    s = ''.join(out)
    s = s.replace('лья', 'ля').replace('льі', 'лі').replace('лью', 'лю')
    s = re.sub(r'іі$', 'ії', s)
    return s

def latin_to_uk(term):
    t = re.sub(r'\(.*?\)', ' ', term)                       # прибрати дужки (Achillis) тощо
    t = t.replace('-', ' ').replace('–', ' ')
    parts = []
    for w in re.findall(r"[A-Za-z]+|[IVXLC]+", t):
        if re.fullmatch(r'[IVXLC]+', w) and len(w) <= 5 and w.upper() == w:     # римські числа → «перший», «другий»…
            parts.append(roman_uk(w)); continue
        parts.append(word_to_uk(w))
    return ' '.join(p for p in parts if p)

ROMAN = {'I': 'перший', 'II': 'другий', 'III': 'третій', 'IV': 'четвертий', 'V': 'п’ятий', 'VI': 'шостий', 'VII': 'сьомий', 'VIII': 'восьмий', 'IX': 'дев’ятий', 'X': 'десятий', 'XI': 'одинадцятий', 'XII': 'дванадцятий'}
def roman_uk(r): return ROMAN.get(r, r)

if __name__ == '__main__':
    import sys
    for t in (sys.argv[1:] or ['Musculus sternocleidomastoideus', 'Processus articularis superior', 'Foramen transversarium', 'Vena cava inferior', 'Ligamentum inguinale', 'Tuberculum majus humeri', 'Fovea costalis processus transversi', 'Cornu coccygeum', 'Lingua', 'Musculus quadratus lumborum', 'Truncus encephali', 'Hiatus adductorius', 'Vertebra cervicalis VII (prominens)', 'Aorta', 'Musculus obliquus externus abdominis', 'Facies auricularis', 'Ossa digitorum', 'Sulcus nervi spinalis', 'Ductus choledochus', 'Glandula thyroidea']):
        print(f'{t:45s} → {latin_to_uk(t)}')

def slug(term):
    return re.sub(r'[^a-z0-9]+', '-', term.lower()).strip('-')[:80]
