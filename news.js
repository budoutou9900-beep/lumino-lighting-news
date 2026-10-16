(function () {
  // 表示カテゴリ（fetch_news.py の to_display_category と対応）
  const CAT_COLORS = {
    Art: "#e9a6c4",
    Architecture: "#f5c560",
    Technology: "#6fc6c0",
  };

  function catColor(cat) {
    return CAT_COLORS[cat] || "#aeb5c6";
  }

  const fetched = window.LUMINO_DATA;
  const DATA = fetched && fetched.articles ? fetched.articles : [];

  const state = { activeCat: "Architecture", query: "" };

  const READ_STORAGE_KEY = "lumino-read-urls";

  function loadReadUrls() {
    try {
      return new Set(JSON.parse(localStorage.getItem(READ_STORAGE_KEY)) || []);
    } catch {
      return new Set();
    }
  }

  const readUrls = loadReadUrls();

  function markRead(url) {
    if (readUrls.has(url)) return;
    readUrls.add(url);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readUrls]));
    } catch {}
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function getFiltered() {
    let base = DATA.filter((d) => d.cat === state.activeCat);
    const q = state.query.trim().toLowerCase();
    if (q) {
      base = base.filter((d) =>
        (d.title + " " + (d.excerpt || "") + " " + d.source).toLowerCase().includes(q)
      );
    }
    return base.slice().sort((a, b) => {
      const aUnread = !readUrls.has(a.url);
      const bUnread = !readUrls.has(b.url);
      return aUnread === bUnread ? 0 : aUnread ? -1 : 1;
    });
  }

  // 画像はリファラを送らずに読み込む（ホットリンク対策で弾かれるのを避ける）。
  // ローカル保存画像 → 配信元の画像 → プレースホルダの順にフォールバックする
  function buildThumb(d, color) {
    const thumb = document.createElement("div");
    thumb.className = "lumino-card-thumb";
    thumb.style.background = `radial-gradient(circle at 32% 38%, ${color}55, transparent 62%), linear-gradient(140deg,#172033,#0c1018)`;
    thumb.innerHTML = `<div class="lumino-card-thumb-hatch"></div><div class="lumino-card-thumb-label">${escapeAttr(d.source)}</div>`;

    const candidates = [d.thumbnailUrl, d.remoteThumbnailUrl].filter(Boolean);
    if (candidates.length) {
      const img = document.createElement("img");
      img.className = "lumino-card-img";
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      let i = 0;
      img.addEventListener("error", () => {
        i += 1;
        if (i < candidates.length) img.src = candidates[i];
        else img.remove();
      });
      img.src = candidates[0];
      thumb.appendChild(img);
    }

    if (!readUrls.has(d.url)) {
      const badge = document.createElement("span");
      badge.className = "lumino-card-unread-badge";
      badge.textContent = "NEW";
      thumb.appendChild(badge);
    }
    return thumb;
  }

  function renderGrid() {
    const grid = document.getElementById("newsGrid");
    const emptyState = document.getElementById("emptyState");
    const filtered = getFiltered();

    if (filtered.length === 0) {
      grid.hidden = true;
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    grid.hidden = false;
    grid.innerHTML = "";
    filtered.forEach((d) => {
      const color = catColor(d.cat);
      const a = document.createElement("a");
      a.className = "lumino-card";
      a.href = d.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.appendChild(buildThumb(d, color));
      const body = document.createElement("div");
      body.className = "lumino-card-body";
      body.innerHTML = `
          <div class="lumino-card-row">
            <span class="lumino-card-cat" style="background:${color}24; color:${color}"><span class="lumino-card-cat-dot" style="background:${color}"></span>${d.cat}</span>
            <span class="lumino-card-date">${d.date}</span>
          </div>
          <h3 class="lumino-card-title">${d.title}</h3>
          ${d.excerpt ? `<p class="lumino-card-excerpt">${d.excerpt}</p>` : ""}
          <div class="lumino-card-footer">
            <span class="lumino-card-source">${d.source}</span>
            <span class="lumino-card-cta">記事を読む<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></span>
          </div>`;
      a.appendChild(body);
      a.addEventListener("click", () => {
        markRead(d.url);
        const badge = a.querySelector(".lumino-card-unread-badge");
        if (badge) badge.remove();
      });
      grid.appendChild(a);
    });
  }

  function renderMeta() {
    const filtered = getFiltered();
    document.getElementById("nArticles").textContent = filtered.length;
    document.getElementById("nSources").textContent = new Set(filtered.map((d) => d.source)).size;
    document.getElementById("nToday").textContent = filtered.filter((d) => d.today).length;
    document.getElementById("fetchedAt").textContent = fetched && fetched.fetchedAt ? fetched.fetchedAt : "—";
  }

  function render() {
    renderGrid();
    renderMeta();
  }

  function setQuery(value) {
    state.query = value;
    document.getElementById("searchInput").value = value;
    document.getElementById("searchClearBtn").hidden = value.length === 0;
    render();
  }

  // app.js のタブ切替から呼ばれる
  window.luminoSetCategory = function (cat) {
    state.activeCat = cat;
    render();
  };

  document.getElementById("searchInput").addEventListener("input", (e) => setQuery(e.target.value));
  document.getElementById("searchClearBtn").addEventListener("click", () => setQuery(""));
  document.getElementById("emptyResetBtn").addEventListener("click", () => setQuery(""));
})();
