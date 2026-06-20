"""
LUMINO Researchタブ用の学術論文取得スクリプト。
CrossRef API（無料・APIキー不要）とLEUKOSの公式RSSから照明関連の論文メタデータを集約し、
research-data.js (window.LUMINO_RESEARCH) を生成する。

著作権方針: 論文本文や画像は取得・保存しない。タイトル・DOI・出典URLなどのメタデータのみを扱う。
"""
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests

UA = {"User-Agent": "Mozilla/5.0 (LUMINO research aggregator; contact: budoutou9900@gmail.com)"}
HTTP_TIMEOUT = 15
OUTPUT_PATH = Path(__file__).parent / "research-data.js"

# CrossRefでは container-title の文字列一致で検索する（ISSN指定より取りこぼしが少ない）
CROSSREF_JOURNALS = ["LEUKOS", "Lighting Research & Technology"]
CROSSREF_ROWS = 8
MAX_PAPERS_PER_SOURCE = 8


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

    payload = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y.%m.%d  %H:%M"),
        "papers": all_papers,
    }
    js_content = "window.LUMINO_RESEARCH = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUTPUT_PATH.write_text(js_content, encoding="utf-8")
    print(f"[ok] {len(all_papers)} 件の論文情報を {OUTPUT_PATH} に書き込みました。")


if __name__ == "__main__":
    main()
