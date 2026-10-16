# archive

News 専用サイトへの仕様変更（2026-10）で画面から外した機能のデータとコードの保管場所です。
`index.html` からは読み込んでいないので、アプリの動作には影響しません。

- Inspiration: `inspiration.js` / `inspiration-data.js` / `fetch_inspiration.py`
- Learn: `learn.js` / `learn-data.js` / `images/learn/`（`learn-data.js` 内の画像パスは元の `images/learn/` のまま）
- Research: `research.js` / `research-data.js` / `fetch_research.py`
- Home: `home.js` / `today-pick.js`

戻すときはファイルを元の場所へ移し、`index.html` にセクションと `<script>` を戻してください（git 履歴の `2172ba1` 時点の `index.html` / `app.js` が参考になります）。
