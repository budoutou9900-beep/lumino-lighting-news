"""
LUMINO Inspirationタブ用のコンテンツ収集スクリプト。
Dezeen / designboom / ArchDaily / IGNANT / Wallpaper* のRSSフィードから、
「光が美しい」事例の候補（タイトル・画像URL・出典）を集め、Geminiで
一般訴求度をスコアリングしつつ日本語の編入コメントを生成し、
inspiration-data.js (window.LUMINO_INSPIRATION) に追記する。

ストック方式: 1回の実行で新規候補を最大MAX_NEW_PER_RUN件まで追加し、
全体は最大MAX_STOCK件（超過分は古い順に削除）に保つ。
表示側（inspiration.js）は日付シードでストックから毎日10件を選んで表示する。

Windowsタスクスケジューラ等で定期実行する想定（fetch_news.py / fetch_research.pyと同様）。
著作権方針: 画像は出典元のURLを直接参照する（保存・再アップロードはしない）。
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

UA = {"User-Agent": "Mozilla/5.0 (LUMINO inspiration aggregator; contact: budoutou9900@gmail.com)"}
HTTP_TIMEOUT = 15
OUTPUT_PATH = Path(__file__).parent / "inspiration-data.js"
GEMINI_CONFIG_PATH = Path(__file__).parent / "gemini_config.json"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_RATE_LIMIT_SLEEP = 20

MAX_STOCK = 300
MAX_NEW_PER_RUN = 15  # 1回の実行で追加する件数の上限
MAX_CANDIDATES_CHECKED_PER_RUN = 20  # 採用件数に関わらず、Gemini呼び出し自体の総数を上限で打ち切り、実行時間を予測可能にする
SCORE_THRESHOLD = 6

FEEDS = [
    ("Dezeen", "https://www.dezeen.com/feed/"),
    ("designboom", "https://www.designboom.com/feed/"),
    ("ArchDaily", "https://www.archdaily.com/rss/"),
    ("IGNANT", "https://www.ignant.com/feed/"),
    ("Wallpaper*", "https://www.wallpaper.com/feed/rss"),
]

CURATION_PROMPT = """あなたはLUMINOという照明メディアのキュレーターです。
LUMINOのミッションは「照明を意識していない一般の人に、日常や非日常の中にある光の美しさに気づいてもらうこと」です。

以下の海外デザイン/建築/アート記事が、このミッションに沿う「光が美しい」事例として
Inspirationタブに掲載する価値があるかを判定してください。

【高スコア（7〜10）の基準】
- 光・影・照明そのものが主題、または写真の印象を強く決定づけている
- 建築・インスタレーション・アート作品における自然光/人工光の使い方が印象的
- 一般の人が見て「美しい」「面白い」と感じられる視覚的なフック

【低スコア（0〜3）の基準】
- 光や照明とほぼ無関係な内容（家具・住宅平面図・経営/受賞ニュースのみ等）
- 製品スペックや業界向け告知が中心

判定したら、以下のJSON形式のみで返答してください（説明文・コードブロック記法は不要、JSON1個のみ）：
{{"score": 0から10の整数, "comment": "編集者の一言コメント。日本語で1〜2文、80字程度。詩的で、何が見えるか・どう感じるかを具体的に描写する。「〜という静かな驚き」のような断定的な気づきで終えるとよい。", "credit": "作品名/作家名や建物名 — 場所、のような短いクレジット文（不明な情報は省略可）"}}

記事タイトル：{title}
記事概要：{description}"""


def safe_get(url, **kwargs):
    try:
        return requests.get(url, **kwargs)
    except requests.exceptions.SSLError:
        return requests.get(url, verify=False, **kwargs)


def load_gemini_api_key():
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key
    if not GEMINI_CONFIG_PATH.exists():
        return None
    try:
        config = json.loads(GEMINI_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None
    key = config.get("api_key", "")
    if not key or "ここに" in key:
        return None
    return key


def collect_feed(source_name, feed_url):
    try:
        req = urllib.request.Request(feed_url, headers=UA)
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
            xml_bytes = res.read()
    except Exception as exc:
        print(f"[warn] {source_name} fetch failed: {exc}")
        return []

    try:
        root = ET.fromstring(xml_bytes.strip())
    except ET.ParseError as exc:
        print(f"[warn] {source_name} feed parse failed: {exc}")
        return []

    ns = {"media": "http://search.yahoo.com/mrss/"}
    items = []
    for item in root.findall("./channel/item"):
        title = unescape(re.sub(r"\s+", " ", (item.findtext("title") or "").strip()))
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        description = unescape(re.sub(r"<[^>]+>", "", item.findtext("description") or "")).strip()
        description = re.sub(r"\s+", " ", description)

        image_url = None
        enclosure = item.find("enclosure")
        if enclosure is not None and enclosure.get("url"):
            image_url = enclosure.get("url")
        if not image_url:
            thumb = item.find("media:thumbnail", ns)
            if thumb is not None and thumb.get("url"):
                image_url = thumb.get("url")
        if not image_url:
            continue
        if image_url.startswith("http://"):
            image_url = "https://" + image_url[len("http://"):]

        items.append({
            "title": title,
            "link": link,
            "description": description[:300],
            "imageUrl": image_url,
            "sourceName": source_name,
        })
    return items


def curate_with_gemini(api_key, title, description):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    prompt = CURATION_PROMPT.format(title=title, description=description or "（概要なし）")
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    for attempt in range(2):
        try:
            res = requests.post(url, json=body, timeout=HTTP_TIMEOUT)
            if res.status_code == 429 and attempt == 0:
                time.sleep(GEMINI_RATE_LIMIT_SLEEP * 2)
                continue
            res.raise_for_status()
            text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
            data = json.loads(text)
            return {
                "score": int(data.get("score", 0)),
                "comment": (data.get("comment") or "").strip(),
                "credit": (data.get("credit") or "").strip(),
            }
        except Exception as exc:
            print(f"[warn] gemini curation failed for '{title[:40]}': {exc}")
            if attempt == 0:
                time.sleep(GEMINI_RATE_LIMIT_SLEEP)
                continue
            return None
    return None


def load_existing_stock():
    if not OUTPUT_PATH.exists():
        return []
    text = OUTPUT_PATH.read_text(encoding="utf-8")
    m = re.search(r"window\.LUMINO_INSPIRATION\s*=\s*(\[.*\]);?\s*$", text, re.DOTALL)
    if not m:
        return []
    array_text = m.group(1)
    # JS識別子キー（id: "..."など）をJSON互換にしてからパースする
    json_text = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', array_text)
    json_text = re.sub(r",\s*([\]}])", r"\1", json_text)  # 末尾カンマ除去
    try:
        return json.loads(json_text)
    except Exception as exc:
        print(f"[warn] 既存ストックの読み込みに失敗しました: {exc}")
        return []


def js_string(s: str) -> str:
    return json.dumps(s or "", ensure_ascii=False)


def write_stock(stock):
    lines = [
        "// Inspirationタブのストックデータ。",
        "// fetch_inspiration.py が定期実行で新規コンテンツを追記します（手動追記も可）。",
        "// imageUrl は出典元の画像URLを直接参照してください（保存・再アップロードはしないこと）。",
        "// inspiration.js が日付シードでこの中から毎日10件を選んで表示します。",
        "window.LUMINO_INSPIRATION = [",
    ]
    for i, item in enumerate(stock):
        comma = "," if i < len(stock) - 1 else ""
        tags_js = "[" + ", ".join(js_string(t) for t in item.get("tags", [])) + "]"
        lines.append("  {")
        lines.append(f"    id: {js_string(item.get('id', ''))},")
        lines.append(f"    imageUrl: {js_string(item.get('imageUrl')) if item.get('imageUrl') else 'null'},")
        lines.append(f"    sourceUrl: {js_string(item.get('sourceUrl', ''))},")
        lines.append(f"    sourceName: {js_string(item.get('sourceName', ''))},")
        lines.append(f"    comment: {js_string(item.get('comment', ''))},")
        lines.append(f"    credit: {js_string(item.get('credit', ''))},")
        lines.append(f"    tags: {tags_js},")
        lines.append(f"    addedDate: {js_string(item.get('addedDate', ''))}")
        lines.append("  }" + comma)
    lines.append("];")
    OUTPUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    stock = load_existing_stock()
    seen_urls = {item.get("sourceUrl") for item in stock}
    next_id = len(stock) + 1

    api_key = load_gemini_api_key()
    if not api_key:
        print("[warn] GEMINI_API_KEY未設定のため、新規コンテンツの収集はスキップします。")
        return

    candidates = []
    for source_name, feed_url in FEEDS:
        for item in collect_feed(source_name, feed_url):
            if item["link"] in seen_urls:
                continue
            candidates.append(item)

    added = 0
    checked = 0
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    candidates = candidates[:MAX_CANDIDATES_CHECKED_PER_RUN]
    for i, cand in enumerate(candidates):
        if added >= MAX_NEW_PER_RUN:
            break
        result = curate_with_gemini(api_key, cand["title"], cand["description"])
        checked += 1
        if i < len(candidates) - 1:
            time.sleep(GEMINI_RATE_LIMIT_SLEEP)
        if not result or result["score"] < SCORE_THRESHOLD or not result["comment"]:
            continue
        stock.append({
            "id": f"{next_id:03d}",
            "imageUrl": cand["imageUrl"],
            "sourceUrl": cand["link"],
            "sourceName": cand["sourceName"],
            "comment": result["comment"],
            "credit": result["credit"] or cand["title"],
            "tags": ["自動収集"],
            "addedDate": today_str,
        })
        seen_urls.add(cand["link"])
        next_id += 1
        added += 1

    if len(stock) > MAX_STOCK:
        stock = stock[-MAX_STOCK:]

    write_stock(stock)
    print(f"[ok] 候補{checked}件を確認し、新規{added}件を追加。ストック計{len(stock)}件を {OUTPUT_PATH} に書き込みました。")


if __name__ == "__main__":
    main()
