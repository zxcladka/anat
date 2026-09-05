#!/bin/zsh
# OCR відсканованих буклетів: сторінка → дві колонки → tesseract ukr+eng
export TESSDATA_PREFIX="$PWD/tessdata"
for f in src/onmedu/buklet-Krok-1-Medicina-2021U-1-zmina.pdf src/onmedu/buklet-Krok-1-Medicina-2022U-1-zmina.pdf src/onmedu/Buklet-Krok-1-Medicina-2025U.pdf src/onmedu/Buklet-Krok-1-Medicina-2026-1-den.pdf src/onmedu/Buklet-Krok-1-Medicina-2026-2-den-1.pdf src/onmedu/Buklet-Krok-1-Medicina-2024U-1-den.pdf src/onmedu/buklet-Krok-1-Medicina-2021U-2-zmina_compressed-1.pdf src/onmedu/buklet-Krok-1-Medicina-2022U-2-zmina.pdf src/onmedu/Buklet-Krok-1-Medicina-2025U-2.pdf; do
  b=$(basename "$f" .pdf); d="ocr_pages/$b"; mkdir -p "$d"
  [ -f "raw2/$b.txt" ] && continue
  pdftoppm -r 200 -png "$f" "$d/p" 2>/dev/null
  : > "raw2/$b.txt"
  for p in "$d"/p-*.png; do
    w=$(python3 -c "import struct;f=open('$p','rb');f.read(16);print(struct.unpack('>I',f.read(4))[0])")
    h=$(python3 -c "import struct;f=open('$p','rb');f.read(20);print(struct.unpack('>I',f.read(4))[0])")
    ~/PycharmProjects/anat/.venv/bin/python -c "
import cv2,sys; im=cv2.imread('$p'); H,W=im.shape[:2]; m=W//2
cv2.imwrite('$p.l.png', im[:, :m]); cv2.imwrite('$p.r.png', im[:, m:])"
    tesseract "$p.l.png" - -l ukr+eng --psm 6 2>/dev/null >> "raw2/$b.txt"
    tesseract "$p.r.png" - -l ukr+eng --psm 6 2>/dev/null >> "raw2/$b.txt"
  done
  echo "done $b $(wc -c < raw2/$b.txt)"
done
echo ALL_DONE
