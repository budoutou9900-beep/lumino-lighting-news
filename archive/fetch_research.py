"""
LUMINO Researchタブ用の学術論文取得スクリプト。
CrossRef API（無料・APIキー不要）とLEUKOSの公式RSSから照明関連の論文メタデータを集約し、
research-data.js (window.LUMINO_RESEARCH) を生成する。

抄録はOpenAlex API（無料・APIキー不要、DOIから検索可能）から取得し、
Gemini APIで一般読者向けの日本語要約（AI要約欄）を生成する。

著作権方針: 論文本文や画像は取得・保存しない。タイトル・DOI・出典URL・抄録などの
メタデータのみを扱う（抄録は要約生成にのみ用い、そのまま保存・転載はしない）。
"""
import json
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

UA = {"User-Agent": "Mozilla/5.0 (LUMINO research aggregator; contact: budoutou9900@gmail.com)"}
HTTP_TIMEOUT = 15
OUTPUT_PATH = Path(__file__).parent / "research-data.js"
GEMINI_CONFIG_PATH = Path(__file__).parent / "gemini_config.json"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_RATE_LIMIT_SLEEP = 20

# CrossRefでは container-title の文字列一致で検索する（ISSN指定より取りこぼしが少ない）
CROSSREF_JOURNALS = ["LEUKOS", "Lighting Research & Technology"]
CROSSREF_ROWS = 8
MAX_PAPERS_PER_SOURCE = 8
MAX_AI_SUMMARIES = 15  # 新しい順に最大15件のみ要約（OpenAlex+Gemini呼び出しの所要時間を抑える）


def safe_get(url, **kwargs):
    try:
        return requests.get(url, **kwargs)
    except requests.exceptions.SSLError:
        return requests.get(url, verify=False, **kwargs)


def collect_crossref(container_title: str):
    # sort=publishedを指定するとquery.container-titleの関連度フィルタが効かず
    # 無関係な雑誌が混入するため、デフォルトの関連度順で多めに取得してから絞り込む。
    params = {
        "query.container-title": container_title,
        "filter": "type:journal-article",
        "rows": str(CROSSREF_ROWS * 4),
    }
    url = "https://api.crossref.org/works?" + urllib.parse.urlencode(params)
    try:
        res = safe_get(url, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
        items = res.json().get("message", {}).get("items", [])
    except Exception as exc:
        print(f"[warn] crossref fetch failed for '{container_title}': {exc}")
        return []

    papers = []
    for item in items:
        titles = item.get("title") or []
        if not titles:
            continue
        journal_names = item.get("container-title") or []
        # query.container-titleは関連度検索のため、実際の掲載誌名が一致しないものは除外する
        # （CrossRef側はHTMLエンティティ表記の場合があるためunescapeして比較する）
        if not any(container_title.lower() == unescape(name).lower() for name in journal_names):
            continue
        date_parts = (
            item.get("published-print", {}).get("date-parts")
            or item.get("published-online", {}).get("date-parts")
            or item.get("published", {}).get("date-parts")
            or [[]]
        )[0]
        date_str = "-".join(f"{p:02d}" if i else str(p) for i, p in enumerate(date_parts)) if date_parts else ""
        authors = ", ".join(
            f"{a.get('given', '')} {a.get('family', '')}".strip()
            for a in (item.get("author") or [])
            if a.get("family")
        )
        papers.append({
            "title": unescape(titles[0]).strip(),
            "journal": unescape(journal_names[0]),
            "doi": item.get("DOI", ""),
            "url": item.get("URL", ""),
            "date": date_str,
            "authors": authors,
            "ai": "",
            "_sort": "".join(f"{p:04d}" for p in date_parts) if date_parts else "0",
        })
    papers.sort(key=lambda p: p["_sort"], reverse=True)
    return papers[:CROSSREF_ROWS]


def collect_leukos_rss():
    feed_url = "https://www.tandfonline.com/action/showFeed?type=etoc&feed=rss&jc=ulks20"
    try:
        req = urllib.request.Request(feed_url, headers=UA)
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
            xml_text = res.read().decode("utf-8")
    except Exception as exc:
        print(f"[warn] LEUKOS RSS fetch failed: {exc}")
        return []

    ns = {
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "dc": "http://purl.org/dc/elements/1.1/",
        "prism": "http://prismstandard.org/namespaces/basic/2.0/",
    }
    root = ET.fromstring(xml_text)
    papers = []
    for item in root.findall("{http://purl.org/rss/1.0/}item"):
        title = unescape((item.findtext("{http://purl.org/rss/1.0/}title") or "").strip())
        link = (item.findtext("{http://purl.org/rss/1.0/}link") or "").strip()
        doi = (item.findtext("dc:identifier", default="", namespaces=ns) or "").replace("doi:", "").strip()
        cover_date = item.findtext("prism:coverDate", default="", namespaces=ns) or ""
        date_m = re.match(r"(\d{4}-\d{2}-\d{2})", cover_date)
        date_str = date_m.group(1) if date_m else ""
        if not title or not link:
            continue
        papers.append({
            "title": title,
            "journal": "LEUKOS",
            "doi": doi,
            "url": link,
            "date": date_str,
            "authors": "",
            "ai": "",
            "_sort": date_str.replace("-", "") or "0",
        })
    return papers


def fetch_abstract_via_openalex(doi: str):
    if not doi:
        return None
    url = f"https://api.openalex.org/works/https://doi.org/{urllib.parse.quote(doi)}"
    try:
        res = requests.get(url, headers=UA, timeout=HTTP_TIMEOUT,
                            params={"mailto": "budoutou9900@gmail.com"})
        if res.status_code != 200:
            return None
        inv = res.json().get("abstract_inverted_index")
        if not inv:
            return None
        positions = sorted((pos, word) for word, idxs in inv.items() for pos in idxs)
        return " ".join(word for _, word in positions)
    except Exception as exc:
        print(f"[warn] openalex abstract fetch failed for {doi}: {exc}")
        return None


def load_gemini_api_key():
    import os
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


SUMMARY_PROMPT = """あなたはLUMINOという照明メディアの編集者です。
以下の学術論文の抄録を、照明に詳しくない一般読者にも分かりやすい日本語で2文・150字程度に要約してください。
研究で分かったこと（結果）とその意義を中心にし、専門用語は最小限にしてください。
要約文のみを返してください（前置きや「要約：」等のラベルは不要です）。

論文タイトル：{title}
抄録：{abstract}"""


def summarize_with_gemini(api_key, title, abstract):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    prompt = SUMMARY_PROMPT.format(title=title, abstract=abstract)
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    for attempt in range(2):
        try:
            res = requests.post(url, json=body, timeout=HTTP_TIMEOUT)
            if res.status_code == 429 and attempt == 0:
                time.sleep(GEMINI_RATE_LIMIT_SLEEP * 2)
                continue
            res.raise_for_status()
            return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as exc:
            print(f"[warn] gemini summarize failed for '{title[:40]}': {exc}")
            if attempt == 0:
                time.sleep(GEMINI_RATE_LIMIT_SLEEP)
                continue
            return None
    return None


def attach_ai_summaries(papers):
    api_key = load_gemini_api_key()
    if not api_key:
        print("[warn] GEMINI_API_KEY未設定のため、AI要約は生成しません（近日公開のまま）。")
        return papers

    candidates = [p for p in papers if p.get("doi")]
    for i, p in enumerate(candidates):
        abstract = fetch_abstract_via_openalex(p["doi"])
        if abstract:
            summary = summarize_with_gemini(api_key, p["title"], abstract)
            if summary:
                p["ai"] = summary
        if i < len(candidates) - 1:
            time.sleep(GEMINI_RATE_LIMIT_SLEEP)
    return papers


def main():
    all_papers = []
    seen_titles = set()

    for journal in CROSSREF_JOURNALS:
        for p in collect_crossref(journal):
            if p["title"] in seen_titles:
                continue
            seen_titles.add(p["title"])
            all_papers.append(p)

    for p in collect_leukos_rss():
        if p["title"] in seen_titles:
            continue
        seen_titles.add(p["title"])
        all_papers.append(p)

    all_papers.sort(key=lambda p: p["_sort"], reverse=True)
    for p in all_papers:
        del p["_sort"]
    all_papers = all_papers[:30]

    attach_ai_summaries(all_papers[:MAX_AI_SUMMARIES])

    payload = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y.%m.%d  %H:%M"),
        "papers": all_papers,
    }
    js_content = "window.LUMINO_RESEARCH = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUTPUT_PATH.write_text(js_content, encoding="utf-8")
    print(f"[ok] {len(all_papers)} 件の論文情報を {OUTPUT_PATH} に書き込みました。")


if __name__ == "__main__":
    main()
