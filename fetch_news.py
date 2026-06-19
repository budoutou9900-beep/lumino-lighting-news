"""
LUMINO 照明業界ニュースダッシュボード用ニュース取得スクリプト。
複数ソース（Googleニュース検索／パナソニック公式RSS／遠藤照明お知らせ／
照明学会お知らせ／LPA・シリウスライティングオフィス公式RSS）から記事を集約し、
data.js (window.LUMINO_DATA) を生成する。Windowsタスクスケジューラ等で定期実行する想定。
"""
import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from googlenewsdecoder import gnewsdecoder


def safe_get(url, **kwargs):
    """一部サイトはサーバー側の証明書チェーン不備でSSL検証に失敗するため、
    その場合のみ検証なしで再試行する（公開ニュースの読み取り専用アクセスのため許容）。"""
    try:
        return requests.get(url, **kwargs)
    except requests.exceptions.SSLError:
        return requests.get(url, verify=False, **kwargs)

OUTPUT_PATH = Path(__file__).parent / "data.js"
UA = {"User-Agent": "Mozilla/5.0"}
HTTP_TIMEOUT = 15

GOOGLE_QUERIES = [
    "照明 LED",
    "照明デザイン",
    "照明 新製品",
    "照明 コンペ OR 照明 賞",
    "照明計画 OR 照明設計",
]

# 「ライト」が人名（フランク・ロイド・ライト等）や無関係な語にマッチして
# 紛れ込むケースを除外するブロックリスト
EXCLUDE_KEYWORDS = [
    "フランク・ロイド・ライト",
    "ロイド・ライト",
    "ライト兄弟",
    "ライトノベル",
    "ブルーライト",
    # 舞台・映像・演劇分野の照明（建築・空間照明とは別分野のため除外）
    "舞台照明",
    "舞台",
    "演劇",
    "ミュージカル",
    "撮影",
    "映画",
    "ドラマ",
    "主演",
    "公演",
    "照明まつり",
    "キャスト",
    # 自動車用照明（建築・空間照明とは別分野のため除外）
    "自動車照明",
    "自動車用照明",
    "車両用照明",
    "ヘッドライト",
    "テールランプ",
    "車載照明",
    "LucidShape",
    "LightTools",
]


def is_excluded(title: str) -> bool:
    return any(kw in title for kw in EXCLUDE_KEYWORDS)

PANASONIC_FEEDS = [
    "https://news.panasonic.com/jp/rss/category/products-solutions/housing.xml",
    "https://news.panasonic.com/jp/rss/category/products-solutions/btob.xml",
]
PANASONIC_KEYWORDS = ["照明", "LED", "ライト", "ダウンライト", "シーリング", "スポットライト", "シンカ", "Synca"]

CATEGORY_RULES = [
    ("賞・コンペ", ["賞", "コンペ", "アワード", "award"]),
    ("新製品", ["新製品", "発売", "新型", "リリース"]),
    ("技術・LED", ["LED", "Mini LED", "技術", "OLED"]),
    ("デザイン", ["デザイン", "design"]),
]
DEFAULT_CATEGORY = "国内情報"

SOURCE_PALETTE = [
    {"bg": "rgba(247,195,86,0.14)", "fg": "#f5c560"},
    {"bg": "rgba(79,209,197,0.14)", "fg": "#5bd6c9"},
    {"bg": "rgba(167,139,250,0.16)", "fg": "#b79cf7"},
    {"bg": "rgba(110,231,168,0.14)", "fg": "#74e6a6"},
    {"bg": "rgba(246,165,176,0.15)", "fg": "#f3a3ae"},
    {"bg": "rgba(140,180,255,0.15)", "fg": "#9cbcff"},
    {"bg": "rgba(255,170,120,0.15)", "fg": "#ffaa78"},
]

MAX_ARTICLES = 110
THUMBNAIL_WORKERS = 8
THUMBNAIL_TIMEOUT = 8

# ソースが偏らないよう、集約前に各ソースの件数上限を設ける
PER_SOURCE_CAP = {
    "collect_google_news": 15,
    "collect_panasonic": 10,
    "collect_endo_lighting": 10,
    "collect_ieij": 10,
    "collect_lpa": 10,
    "collect_sirius": 10,
    "collect_yamagiwa": 10,
    "collect_daiko": 10,
    "collect_mjd": 10,
    "collect_azusa_sekkei": 10,
    "collect_ishimoto": 10,
}


def cap_by_recency(articles, limit):
    return sorted(articles, key=lambda a: a["_pub_date"], reverse=True)[:limit]


def categorize(title: str, default: str = DEFAULT_CATEGORY) -> str:
    for cat, keywords in CATEGORY_RULES:
        if any(kw.lower() in title.lower() for kw in keywords):
            return cat
    return default


def parse_rfc822(text: str) -> datetime:
    try:
        return datetime.strptime(text.strip(), "%a, %d %b %Y %H:%M:%S %z")
    except (ValueError, AttributeError):
        return datetime.now(timezone.utc)


def make_article(source, cat, pub_date, title, url, excerpt="", thumbnail_url=None, is_google_news=False):
    article = {
        "source": source,
        "cat": cat,
        "date": pub_date.strftime("%Y.%m.%d"),
        "_pub_date": pub_date,
        "title": title.strip(),
        "url": url.strip(),
        "excerpt": excerpt,
    }
    if thumbnail_url:
        article["thumbnailUrl"] = thumbnail_url
    if is_google_news:
        article["_isGoogleNews"] = True
    return article


# ---- Googleニュース検索 ----

def split_title_source(raw_title: str):
    m = re.match(r"^(.*)\s+-\s+([^-]+)$", raw_title)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return raw_title.strip(), "Google ニュース"


def collect_google_news():
    articles = []
    for query in GOOGLE_QUERIES:
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(query) + "&hl=ja&gl=JP&ceid=JP:ja"
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
                xml_text = res.read().decode("utf-8")
        except Exception as exc:
            print(f"[warn] google news fetch failed for '{query}': {exc}")
            continue

        root = ET.fromstring(xml_text)
        for item in root.findall("./channel/item"):
            link = (item.findtext("link") or "").strip()
            raw_title = unescape((item.findtext("title") or "").strip())
            pub_date = parse_rfc822(item.findtext("pubDate") or "")
            if not link or not raw_title:
                continue
            title, source = split_title_source(raw_title)
            articles.append(make_article(source, categorize(title), pub_date, title, link, is_google_news=True))
    return articles


# ---- パナソニック公式RSS ----

def collect_panasonic():
    articles = []
    for feed_url in PANASONIC_FEEDS:
        try:
            req = urllib.request.Request(feed_url, headers=UA)
            with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
                xml_text = res.read().decode("utf-8")
        except Exception as exc:
            print(f"[warn] panasonic fetch failed for {feed_url}: {exc}")
            continue

        root = ET.fromstring(xml_text)
        for item in root.findall("./channel/item"):
            title = unescape((item.findtext("title") or "").strip())
            if not any(kw.lower() in title.lower() for kw in PANASONIC_KEYWORDS):
                continue
            link = (item.findtext("link") or "").strip()
            description = item.findtext("description") or ""
            pub_date = parse_rfc822(item.findtext("pubDate") or "")
            img_m = re.search(r'<img[^>]*src="([^"]+)"', description)
            thumbnail = img_m.group(1) if img_m else None
            if not link or not title:
                continue
            articles.append(make_article("パナソニック", categorize(title), pub_date, title, link, thumbnail_url=thumbnail))
    return articles


# ---- 遠藤照明 お知らせ（スクレイピング） ----

def collect_endo_lighting():
    base = "https://www.endo-lighting.co.jp/news/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] endo-lighting fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    seen = set()
    for a in soup.find_all("a", href=re.compile(r"/news/\d{8}-\d+/$")):
        href = a.get("href")
        if href.startswith("/"):
            href = "https://www.endo-lighting.co.jp" + href
        if href in seen:
            continue
        seen.add(href)
        title = a.get_text(strip=True)
        date_m = re.search(r"/news/(\d{4})(\d{2})(\d{2})-\d+/$", href)
        if not title or not date_m:
            continue
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("遠藤照明", categorize(title), pub_date, title, href))
    return articles


# ---- 照明学会 お知らせ（スクレイピング） ----

def collect_ieij():
    base = "https://www.ieij.or.jp/news/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] ieij fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    for li in soup.find_all("li"):
        date_m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", li.get_text())
        a = li.find("a", href=True)
        if not date_m or not a:
            continue
        title = a.get_text(strip=True)
        if not title:
            continue
        href = urllib.parse.urljoin(base, a["href"])
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("照明学会", categorize(title), pub_date, title, href))
    return articles


# ---- LPA / シリウスライティングオフィス（WordPress公式RSS） ----

def collect_wordpress_feed(source_name, feed_url, default_cat="デザイン"):
    try:
        req = urllib.request.Request(feed_url, headers=UA)
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as res:
            xml_text = res.read().decode("utf-8")
    except Exception as exc:
        print(f"[warn] {source_name} fetch failed: {exc}")
        return []

    ns = {"content": "http://purl.org/rss/1.0/modules/content/"}
    root = ET.fromstring(xml_text)
    articles = []
    for item in root.findall("./channel/item"):
        title = unescape((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        pub_date = parse_rfc822(item.findtext("pubDate") or "")
        content_encoded = item.findtext("content:encoded", default="", namespaces=ns) or ""
        img_m = re.search(r'<img[^>]*src="([^"]+)"', content_encoded)
        thumbnail = img_m.group(1) if img_m else None
        articles.append(make_article(source_name, categorize(title, default=default_cat), pub_date, title, link, thumbnail_url=thumbnail))
    return articles


def collect_lpa():
    return collect_wordpress_feed("LPA", "https://www.lighting.co.jp/news/feed/")


def collect_sirius():
    return collect_wordpress_feed("シリウスライティングオフィス", "https://www.sirius-ltg.com/news/feed/")


def collect_yamagiwa():
    return collect_wordpress_feed("YAMAGIWA", "https://www.yamagiwa.co.jp/news/feed/", default_cat="新製品")


# ---- 大光電機（スクレイピング） ----

def collect_daiko():
    base = "https://www2.lighting-daiko.co.jp/topics/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] daiko fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    for dt in soup.find_all("dt"):
        date_m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", dt.get_text())
        dd = dt.find_next_sibling("dd")
        a = dd.find("a", href=True) if dd else None
        if not date_m or not a:
            continue
        title = a.get_text(strip=True)
        if not title:
            continue
        href = urllib.parse.urljoin(base, a["href"])
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("大光電機", categorize(title, default="新製品"), pub_date, title, href))
    return articles


# ---- 三菱地所設計（スクレイピング） ----

def collect_mjd():
    base = "https://www.mjd.co.jp/news/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] mjd fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    for a in soup.find_all("a", href=re.compile(r"/news/\d+/$")):
        date_span = a.find("span", class_="date")
        title_p = a.find("p", class_="layout_list01_txt02")
        if not date_span or not title_p:
            continue
        date_m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", date_span.get_text())
        title = title_p.get_text(strip=True)
        if not date_m or not title:
            continue
        href = urllib.parse.urljoin(base, a["href"])
        img = a.find("img")
        thumbnail = img.get("data-imgsrc") or img.get("src") if img else None
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("三菱地所設計", categorize(title), pub_date, title, href, thumbnail_url=thumbnail))
    return articles


# ---- 佐藤総合計画／AZUSA SEKKEI（スクレイピング） ----

def collect_azusa_sekkei():
    base = "https://www.axscom.jp/topics/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] azusa sekkei fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    for block in soup.find_all("div", class_="topics_block"):
        a = block.find("a", href=True)
        day_span = block.find("span", class_="topics_day")
        title_p = block.find("p")
        if not a or not day_span or not title_p:
            continue
        date_m = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", day_span.get_text())
        title = title_p.get_text(strip=True)
        if not date_m or not title:
            continue
        href = urllib.parse.urljoin(base, a["href"])
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("佐藤総合計画", categorize(title), pub_date, title, href))
    return articles


# ---- 石本建築事務所（スクレイピング） ----

def collect_ishimoto():
    base = "https://www.ishimoto.co.jp/topics/"
    try:
        res = safe_get(base, headers=UA, timeout=HTTP_TIMEOUT)
        res.raise_for_status()
    except Exception as exc:
        print(f"[warn] ishimoto fetch failed: {exc}")
        return []

    soup = BeautifulSoup(res.text, "html.parser")
    articles = []
    for a in soup.find_all("a", class_="articleList-article", href=True):
        time_tag = a.find("time")
        title_p = a.find("div", class_="articleList-article-text")
        title_p = title_p.find("p") if title_p else None
        if not time_tag or not title_p or not time_tag.get("datetime"):
            continue
        date_m = re.match(r"(\d{4})-(\d{2})-(\d{2})", time_tag["datetime"])
        title = title_p.get_text(strip=True)
        if not date_m or not title:
            continue
        href = urllib.parse.urljoin(base, a["href"])
        img = a.find("img")
        thumbnail = img.get("src") if img else None
        pub_date = datetime(int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3)), tzinfo=timezone.utc)
        articles.append(make_article("石本建築事務所", categorize(title), pub_date, title, href, thumbnail_url=thumbnail))
    return articles


# ---- 集約・サムネイル補完 ----

def collect_articles():
    collectors = [
        collect_google_news,
        collect_panasonic,
        collect_endo_lighting,
        collect_ieij,
        collect_lpa,
        collect_sirius,
        collect_yamagiwa,
        collect_daiko,
        collect_mjd,
        collect_azusa_sekkei,
        collect_ishimoto,
    ]
    seen_links = set()
    seen_titles = set()
    articles = []
    for collector in collectors:
        try:
            raw = [a for a in collector() if not is_excluded(a["title"])]
            collected = cap_by_recency(raw, PER_SOURCE_CAP[collector.__name__])
            for article in collected:
                if article["url"] in seen_links or article["title"] in seen_titles:
                    continue
                seen_links.add(article["url"])
                seen_titles.add(article["title"])
                articles.append(article)
        except Exception as exc:
            print(f"[warn] collector {collector.__name__} failed: {exc}")

    articles.sort(key=lambda a: a["_pub_date"], reverse=True)
    return articles[:MAX_ARTICLES]


def resolve_real_url(google_url: str):
    try:
        result = gnewsdecoder(google_url, interval=0)
        if result.get("status"):
            return result.get("decoded_url")
    except Exception as exc:
        print(f"[warn] decode failed: {exc}")
    return None


IMG_EXCLUDE_PATTERNS = ["logo", "icon", "btn_", "btn-", "sprite", "placeholder", "spacer", "pixel.gif"]


def pick_fallback_content_image(soup: BeautifulSoup, base_url: str):
    candidates = []
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
        if any(p in src.lower() for p in IMG_EXCLUDE_PATTERNS):
            continue
        candidates.append(src)
    if not candidates:
        return None
    # WordPress系（遠藤照明/LPA/シリウス）はアップロード画像が本文に直接埋め込まれているため優先
    for src in candidates:
        if "wp-content/uploads" in src:
            return urllib.parse.urljoin(base_url, src)
    return urllib.parse.urljoin(base_url, candidates[0])


def fetch_og_image(real_url: str):
    try:
        res = safe_get(real_url, headers=UA, timeout=THUMBNAIL_TIMEOUT)
        soup = BeautifulSoup(res.text, "html.parser")
        for prop in ("og:image", "twitter:image"):
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            if tag and tag.get("content"):
                return tag["content"]
        return pick_fallback_content_image(soup, real_url)
    except Exception as exc:
        print(f"[warn] og:image fetch failed for {real_url}: {exc}")
    return None


def attach_thumbnails(articles):
    def worker(article):
        if article.get("thumbnailUrl"):
            return
        if article.pop("_isGoogleNews", False):
            real_url = resolve_real_url(article["url"])
            if not real_url:
                return
            article["url"] = real_url
            thumb = fetch_og_image(real_url)
        else:
            thumb = fetch_og_image(article["url"])
        if thumb:
            article["thumbnailUrl"] = thumb

    with ThreadPoolExecutor(max_workers=THUMBNAIL_WORKERS) as pool:
        list(pool.map(worker, articles))
    for article in articles:
        article.pop("_isGoogleNews", None)
    return articles


def assign_today_flag(articles):
    today_str = datetime.now().strftime("%Y.%m.%d")
    for a in articles:
        a["today"] = a["date"] == today_str
        del a["_pub_date"]
    return articles


def build_source_colors(articles):
    colors = {}
    palette_idx = 0
    for a in articles:
        src = a["source"]
        if src not in colors:
            colors[src] = SOURCE_PALETTE[palette_idx % len(SOURCE_PALETTE)]
            palette_idx += 1
    return colors


def main():
    articles = collect_articles()
    if not articles:
        print("[warn] 記事が0件のため data.js を更新しませんでした。")
        return

    articles = attach_thumbnails(articles)
    articles = assign_today_flag(articles)
    source_colors = build_source_colors(articles)

    payload = {
        "fetchedAt": datetime.now().strftime("%Y.%m.%d  %H:%M"),
        "sourceColors": source_colors,
        "articles": articles,
    }

    js_content = "window.LUMINO_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    OUTPUT_PATH.write_text(js_content, encoding="utf-8")
    print(f"[ok] {len(articles)} 件の記事を {OUTPUT_PATH} に書き込みました。")

    publish_to_github()


def publish_to_github():
    """data.js の更新をGitHub Pagesに反映するため、変更があればpushする。
    GitHub Actions上ではワークフロー側でcommit/pushするため、ここではスキップする。"""
    import subprocess

    if os.environ.get("GITHUB_ACTIONS"):
        return

    repo_dir = str(OUTPUT_PATH.parent)
    try:
        diff = subprocess.run(
            ["git", "status", "--porcelain", "data.js"],
            cwd=repo_dir, capture_output=True, text=True, check=True,
        )
        if not diff.stdout.strip():
            print("[info] data.js に変更なし。pushはスキップします。")
            return
        subprocess.run(["git", "add", "data.js"], cwd=repo_dir, check=True)
        subprocess.run(
            ["git", "commit", "-m", f"data.js update {datetime.now().strftime('%Y-%m-%d %H:%M')}"],
            cwd=repo_dir, check=True,
        )
        subprocess.run(["git", "push"], cwd=repo_dir, check=True)
        print("[ok] GitHubにpushしました。")
    except Exception as exc:
        print(f"[warn] GitHubへのpushに失敗しました: {exc}")


if __name__ == "__main__":
    main()
