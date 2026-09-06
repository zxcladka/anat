#!/usr/bin/env python3
"""Telegram-бот Anatomia: відкриває тренажер як Mini App і нагадує повторювати.

Без залежностей (тільки стандартна бібліотека), long polling через Bot API.
Токен — у bot_token.txt поруч зі скриптом. Дані користувачів — users.json.

  python3 bot.py            — запустити
  python3 bot.py --setup    — один раз: команди бота, кнопка меню з Mini App, опис

Команди в чаті:
  /start   — привітання і кнопка «Відкрити тренажер»
  /app     — те саме, коротко
  /today   — відкрити «Сьогодні» (повторення)
  /blitz   — бліц на 5 хвилин
  /theory  — картки теорії
  /krok    — питання Крок 1
  /remind 20:30 — щоденне нагадування о 20:30 (за Києвом); /remind off — вимкнути
  /help    — список команд
"""
import json
import ssl
import sys
import time
import threading
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
TOKEN = (HERE / "bot_token.txt").read_text().strip()
USERS = HERE / "users.json"
LOG = HERE / "bot.log"
APP_URL = (HERE / "app_url.txt").read_text().strip() if (HERE / "app_url.txt").exists() else "https://zxcladka.github.io/anat/"
KYIV = timezone(timedelta(hours=3))          # Київ: UTC+3 (літо) — для нагадувань достатньо
API = f"https://api.telegram.org/bot{TOKEN}/"
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def api(method, **params):
    data = json.dumps(params).encode()
    req = urllib.request.Request(API + method, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=70, context=SSL_CTX) as r:
        return json.load(r)


def load_users():
    try:
        return json.loads(USERS.read_text())
    except Exception:
        return {}


def save_users(u):
    USERS.write_text(json.dumps(u, ensure_ascii=False, indent=1))


def app_button(text, path=""):
    """Кнопка, що відкриває тренажер як Mini App. path — маршрут без «#/», напр. today, blitz, facts."""
    url = APP_URL + (f"#/{path}" if path else "")
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": url}}]]}


def send(chat_id, text, markup=None):
    params = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if markup:
        params["reply_markup"] = markup
    try:
        api("sendMessage", **params)
    except Exception as e:
        log(f"send error {chat_id}: {e}")


HELP = (
    "Anatomia — тренажер анатомії: 93 схеми з точками, латина й українська, повторення за FSRS, "
    "картки теорії (м’язи, суглоби, нерви), бліц і Крок 1.\n\n"
    "Команди:\n"
    "/app — відкрити тренажер\n"
    "/today — що повторити сьогодні\n"
    "/blitz — бліц на 5 хвилин\n"
    "/theory — картки теорії\n"
    "/krok — питання Крок 1\n"
    "/remind 20:30 — щоденне нагадування; /remind off — вимкнути\n\n"
    "Прогрес зберігається на пристрої, де відкрито тренажер. Резервна копія — на сторінці «Прогрес»."
)


def handle(msg, users):
    chat = msg["chat"]["id"]
    uid = str(msg["from"]["id"])
    text = (msg.get("text") or "").strip()
    u = users.setdefault(uid, {"chat": chat, "name": msg["from"].get("first_name", ""), "remind": "", "since": datetime.now(KYIV).isoformat()})
    u["chat"] = chat
    cmd = text.split()[0].lower().split("@")[0] if text.startswith("/") else ""
    if cmd == "/start":
        send(chat, "Тренажер анатомії:", app_button("Відкрити тренажер"))
    elif cmd in ("/app", "/atlas"):
        send(chat, "Тренажер:", app_button("Відкрити тренажер"))
    elif cmd == "/today":
        send(chat, "Повторення на сьогодні:", app_button("Сьогодні →", "today"))
    elif cmd == "/blitz":
        send(chat, "Бліц на 5 хвилин:", app_button("Грати →", "blitz"))
    elif cmd == "/theory":
        send(chat, "Картки теорії: м’язи, суглоби, нерви, кістки черепа, органи, провідні шляхи.", app_button("Теорія →", "facts"))
    elif cmd == "/krok":
        send(chat, "Питання з буклетів Крок 1 (анатомія):", app_button("Крок 1 →", "krok"))
    elif cmd == "/remind":
        arg = text.split(maxsplit=1)[1].strip() if len(text.split()) > 1 else ""
        if arg.lower() in ("off", "вимк", "0"):
            u["remind"] = ""
            send(chat, "Нагадування вимкнено.")
        else:
            try:
                hh, mm = arg.split(":")
                t = f"{int(hh):02d}:{int(mm):02d}"
                assert 0 <= int(hh) < 24 and 0 <= int(mm) < 60
                u["remind"] = t
                send(chat, f"Щодня о {t} нагадаю повторити.")
            except Exception:
                send(chat, f"Зараз нагадування: {u.get('remind') or 'вимкнено'}. Формат: /remind 20:30 або /remind off")
    elif cmd == "/help":
        send(chat, HELP, app_button("Відкрити тренажер"))
    elif cmd:
        send(chat, "Не знаю такої команди. /help — список.", app_button("Відкрити тренажер"))
    else:
        send(chat, "Відкрий тренажер кнопкою нижче або напиши /help.", app_button("Відкрити тренажер"))
    save_users(users)


def reminders():
    """Щохвилини: кому настав час нагадування — надіслати (раз на день)."""
    while True:
        try:
            now = datetime.now(KYIV)
            hm = now.strftime("%H:%M")
            today = now.strftime("%Y-%m-%d")
            users = load_users()
            changed = False
            for uid, u in users.items():
                if u.get("remind") == hm and u.get("reminded") != today:
                    send(u["chat"], "Час повторити анатомію: 10 хвилин сьогодні — і структури не забудуться.",
                         app_button("Повторити →", "today"))
                    u["reminded"] = today
                    changed = True
            if changed:
                save_users(users)
        except Exception as e:
            log(f"reminder error: {e}")
        time.sleep(30)


def setup():
    api("setMyCommands", commands=[
        {"command": "app", "description": "Відкрити тренажер"},
        {"command": "today", "description": "Повторення на сьогодні"},
        {"command": "blitz", "description": "Бліц на 5 хвилин"},
        {"command": "theory", "description": "Картки теорії"},
        {"command": "krok", "description": "Питання Крок 1"},
        {"command": "remind", "description": "Час нагадування, напр. /remind 20:30"},
        {"command": "help", "description": "Довідка"},
    ])
    api("setChatMenuButton", menu_button={"type": "web_app", "text": "Тренажер", "web_app": {"url": APP_URL}})
    api("setMyDescription", description="Тренажер анатомії: схеми з точками, латина й українська, повторення за FSRS, теорія, бліц, Крок 1. Натисни «Тренажер» внизу.")
    api("setMyShortDescription", short_description="Тренажер анатомії для студентів-медиків")
    log(f"setup done, app url: {APP_URL}")


def main():
    if "--setup" in sys.argv:
        setup()
        return
    threading.Thread(target=reminders, daemon=True).start()
    offset = 0
    log("bot started")
    while True:
        try:
            r = api("getUpdates", offset=offset, timeout=60, allowed_updates=["message"])
            for upd in r.get("result", []):
                offset = upd["update_id"] + 1
                msg = upd.get("message")
                if msg and msg.get("from") and not msg["from"].get("is_bot"):
                    try:
                        handle(msg, load_users())
                    except Exception as e:
                        log(f"handle error: {e}")
        except Exception as e:
            log(f"poll error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    main()
