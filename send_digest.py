"""
LUMINO 週次ニュースダイジェストをメール送信するスクリプト。
data.js（fetch_news.pyが定期生成）から直近7日分の記事を抽出し、
HTMLメールとしてGmail経由で送信する。Windowsタスクスケジューラで毎週実行する想定。
"""
import json
import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data.js"
CONFIG_PATH = BASE_DIR / "mail_config.json"
DIGEST_DAYS = 7


def load_config():
    # GitHub Actions等のCI環境では環境変数（Secrets）を優先的に使う
    env_password = os.environ.get("MAIL_APP_PASSWORD")
    if env_password:
        sender = os.environ.get("MAIL_SENDER")
        recipient = os.environ.get("MAIL_RECIPIENT")
        if not sender or not recipient:
            raise RuntimeError("MAIL_SENDER / MAIL_RECIPIENT 環境変数(Secrets)が未設定です。")
        return {
            "sender_email": sender,
            "app_password": env_password,
            "recipient_email": recipient,
        }

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if "ここに" in config.get("app_password", ""):
        raise RuntimeError(
            f"{CONFIG_PATH} の app_password が未設定です。"
            "Googleアプリパスワードを発行して書き込んでください。"
        )
    return config


def load_recent_articles():
    content = DATA_PATH.read_text(encoding="utf-8")
    payload = json.loads(content.split("=", 1)[1].rstrip(";\n "))
    cutoff = datetime.now() - timedelta(days=DIGEST_DAYS)
    recent = []
    for a in payload["articles"]:
        try:
            d = datetime.strptime(a["date"], "%Y.%m.%d")
        except ValueError:
            continue
        if d >= cutoff:
            recent.append(a)
    recent.sort(key=lambda a: a["date"], reverse=True)
    return recent, payload.get("sourceColors", {})


def build_html(articles, source_colors):
    today_str = datetime.now().strftime("%Y年%m月%d日")
    period_str = (datetime.now() - timedelta(days=DIGEST_DAYS)).strftime("%m/%d") + " 〜 " + datetime.now().strftime("%m/%d")

    if not articles:
        body_rows = '<p style="color:#888;">今週は新着記事がありませんでした。</p>'
    else:
        rows = []
        for a in articles:
            col = source_colors.get(a["source"], {"bg": "#f0f0f0", "fg": "#555"})
            thumb = a.get("thumbnailUrl")
            thumb_html = (
                f'<img src="{thumb}" width="120" height="80" style="border-radius:8px;object-fit:cover;" />'
                if thumb
                else '<div style="width:120px;height:80px;border-radius:8px;background:#1a2233;"></div>'
            )
            rows.append(f"""
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #2a3247;" valign="top">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-right:16px;">{thumb_html}</td>
                  <td valign="top">
                    <span style="display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:{col['bg']};color:{col['fg']};">{a['source']}</span>
                    <span style="font-size:11px;color:#8b94aa;margin-left:8px;">{a['date']}</span>
                    <div style="margin-top:6px;font-size:15px;font-weight:700;color:#f3eee2;">
                      <a href="{a['url']}" style="color:#f3eee2;text-decoration:none;" target="_blank">{a['title']}</a>
                    </div>
                  </td>
                </tr></table>
              </td>
            </tr>""")
        body_rows = "<table cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">" + "".join(rows) + "</table>"

    return f"""
    <div style="background:#0a0f1d;padding:32px;font-family:'Segoe UI',sans-serif;">
      <div style="max-width:640px;margin:0 auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
          <span style="font-family:'Segoe UI',sans-serif;font-weight:800;font-size:22px;letter-spacing:0.15em;color:#f7f2e7;">LUMINO</span>
        </div>
        <p style="color:#8b94aa;font-size:13px;margin:0 0 24px;">照明業界ニュース 週刊ダイジェスト　{period_str}（{today_str}送信）</p>
        <div style="background:#111829;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:8px 20px;">
          {body_rows}
        </div>
        <p style="color:#5d6478;font-size:11px;margin-top:24px;">このメールはLUMINOダッシュボードの自動配信です。</p>
      </div>
    </div>
    """


def send_mail(config, subject, html_body):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config["sender_email"]
    msg["To"] = config["recipient_email"]
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(config["sender_email"], config["app_password"])
        server.sendmail(config["sender_email"], config["recipient_email"], msg.as_string())


def main():
    config = load_config()
    articles, source_colors = load_recent_articles()
    html_body = build_html(articles, source_colors)
    subject = f"【LUMINO】週刊照明ニュースダイジェスト（{len(articles)}件） - {datetime.now().strftime('%Y/%m/%d')}"
    send_mail(config, subject, html_body)
    print(f"[ok] {len(articles)} 件の記事でダイジェストを {config['recipient_email']} に送信しました。")


if __name__ == "__main__":
    main()
