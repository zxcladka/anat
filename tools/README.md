# Інструменти для поповнення атласу

Схеми беруться з Wikimedia Commons (SVG з номерами) та з атласу Sobotta 1909 (American ed., Public domain, файли `Sobo 1909 N.png`).

Конвеєр для пластини Sobotta:
1. `python3 ocr.py "sobo/Sobo 1909 N.png"` — tesseract читає підписи, пише `ocr/N.json` (рядки й блоки з координатами у %).
2. Відкрити `proc.html` через локальний http-сервер (наприклад `python3 -m http.server 8766`) і запустити `python3 upsrv.py` (приймає POST і зберігає у `dl/`).
   У консолі: `await runOcr2(N, 'slug', {})` — стирає підписи (детектор гліфів + OCR, з перевіркою білої рамки), вирівнює білий, зберігає `dl/slug.jpg` і `dl/slug.marks.jpg`.
3. Додати набір у `limb_sets.py` (або аналогічний файл): назва, категорія, список `(ключ_терміна, x%, y%)` — координати центру підпису.
4. `python3 build_data.py` → `atlas/data.js`. Скопіювати jpg у `atlas/`, підняти `?v=` у `index.html`.

`vert_map.py` — приклад для хребців (координати з рядків детектора), `hand_sets.py` — кисть, `limb_sets.py` — лопатка, плечова, передпліччя, таз, стегнова, гомілка, стопа.

## Перевірка інтерфейсу (скріншоти)

`node tools/shots.mjs tasks.json` — запускає headless Chrome через DevTools Protocol, емулює пристрій, виконує JS і робить скріншоти.
Формат tasks.json: `{"width":390,"height":844,"mobile":true,"dark":true,"steps":[{"url":"http://127.0.0.1:8791/index.html#/today","wait":1000,"shot":"today","full":true},{"eval":"document.title"}]}`.
Спершу підняти `python3 -m http.server 8791` у корені проєкту. У кінці скрипт друкує помилки консолі.

## Структура коду

`index.html` — розмітка і стилі ядра; `js/app.js` — ядро (атлас, тренажер, пошук, SRS, «Сьогодні», прогрес); `js/decks.js` — колоди карток; `js/blitz.js` — бліц; `css/modules.css` — стилі модулів. Модуль додає маршрут через `ROUTES.name = parts => …`, блок на «Сьогодні» через `EXT.today.push(fn)`, лічильник у бейдж через `EXT.badge.push(fn)`, асинхронну ініціалізацію через `INIT.push(fn)`. Після правок js/css підняти `?v=` у index.html.

## Програма курсів

`atlas/curriculum.js` — курси → модулі → теми; у кожної теми `sets` — id наборів з `data.js`. Додати схему до теми = дописати id у масив. Новий курс — новий об'єкт у `courses` (для порожнього курсу лишити `modules: []`).

## Перенесення пінів на кістку (пластини Sobotta)

Раніше піни стояли там, де на пластині був текст підпису. `tools/relocate_pins.py` знаходить виносні лінії (Хаф по тонких лініях поза кісткою), веде кожну до краю кістки й далі по пунктиру на кістці, і переносить пін у кінець лінії; без лінії — на найближчий край кості. Запуск: `.venv/bin/python tools/relocate_pins.py [set-id …]` (оверлеї в `tools/overlay/`), потім `--apply` (пише в `atlas/data.js`, резервна копія `data.js.bak`). Ручні виправлення після перевірки за оригіналами — у `tools/pins_fixed.json` (застосовуються поверх). Потрібні `opencv-python-headless` і `numpy` у `.venv`.
