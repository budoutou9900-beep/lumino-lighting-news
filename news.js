(function () {
  const CATS = ["すべて", "デザイン", "新製品", "賞・コンペ", "技術・LED", "国内情報"];
  const ACCENT = "#6fc6c0";

  const CAT_COLORS = {
    "デザイン": "#e9a6c4",
    "新製品": "#f5c560",
    "賞・コンペ": "#9aa6f5",
    "技術・LED": ACCENT,
    "国内情報": "#aeb5c6",
  };

  function catColor(cat) {
    return CAT_COLORS[cat] || "#aeb5c6";
  }

  const FALLBACK_DATA = [
    { source: "照明学会", cat: "賞・コンペ", date: "2026.06.19", today: true,
      title: "照明デザイン賞2026 受賞作品発表", url: "https://example.com/award2026",
      excerpt: "今年度の最優秀賞には、自然光と人工光をシームレスに統合した商業施設のライティング計画が選出。審査員はその空間体験の質を高く評価した。" },
    { source: "日本照明工業会", cat: "新製品", date: "2026.06.18", today: false,
      title: "Panasonic、新型調光システムを発表", url: "https://example.com/panasonic-dimming",
      excerpt: "時間帯や在室状況に応じて色温度と照度を自動最適化する次世代システム。オフィスや教育施設での導入を見込み、年内の本格出荷を予定する。" },
    { source: "Lux Review", cat: "デザイン", date: "2026.06.19", today: true,
      title: "Human Centric Lightingの最新動向", url: "https://example.com/hcl-trends",
      excerpt: "概日リズムに配慮した照明設計が欧州を中心に拡大。ウェルビーイングを軸とした空間づくりの中核技術として、実装事例が急増している。" },
    { source: "LEDinside", cat: "技術・LED", date: "2026.06.17", today: false,
      title: "Mini LED技術の進化と照明への応用", url: "https://example.com/mini-led",
      excerpt: "高密度実装と精緻なローカルディミングを武器に、ディスプレイ分野で磨かれた技術が一般照明領域へ波及。薄型・高効率モジュールが登場している。" },
    { source: "遠藤照明", cat: "国内情報", date: "2026.06.16", today: false,
      title: "遠藤照明、サステナブルライン新製品群", url: "https://example.com/endo-sustainable",
      excerpt: "再生素材の筐体と長寿命設計を採用した環境配慮型シリーズを拡充。施設・店舗向けに、交換頻度とCO2排出の削減を両立する製品を展開する。" },
  ];

  const fetched = window.LUMINO_DATA;
  const DATA = fetched && fetched.articles && fetched.articles.length ? fetched.articles : FALLBACK_DATA;

  const state = { activeCat: "すべて", query: "", loading: false, showExcerpt: true };

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
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...readUrls]));
  }

  function renderChips() {
    const nav = document.getElementById("categoryTabs");
    nav.innerHTML = "";
    CATS.forEach((c) => {
      const on = c === state.activeCat;
      const color = c === "すべて" ? ACCENT : catColor(c);
      const btn = document.createElement("button");
      btn.className = "lumino-chip" + (on ? " active" : "");
      btn.textContent = c;
      btn.style.borderColor = on ? color : "rgba(255,255,255,0.10)";
      btn.style.background = on ? color : "rgba(255,255,255,0.05)";
      if (on) btn.style.color = "#0a0f1d";
      btn.addEventListener("click", () => {
        state.activeCat = c;
        renderChips();
        renderGrid();
        renderMeta();
      });
      nav.appendChild(btn);
    });
  }

  function getFiltered() {
    let base = state.activeCat === "すべて" ? DATA : DATA.filter((d) => d.cat === state.activeCat);
    const q = state.query.trim().toLowerCase();
    if (q) {
      base = base.filter((d) =>
        (d.title + " " + (d.excerpt || "") + " " + d.source + " " + d.cat).toLowerCase().includes(q)
      );
    }
    return base.slice().sort((a, b) => {
      const aUnread = !readUrls.has(a.url);
      const bUnread = !readUrls.has(b.url);
      return aUnread === bUnread ? 0 : aUnread ? -1 : 1;
    });
  }

  function renderGrid() {
    const grid = document.getElementById("newsGrid");
    const skelGrid = document.getElementById("skeletonGrid");
    const emptyState = document.getElementById("emptyState");

    if (state.loading) {
      grid.hidden = true;
      emptyState.hidden = true;
      skelGrid.hidden = false;
      if (!skelGrid.dataset.built) {
        skelGrid.innerHTML = "";
        for (let i = 0; i < 6; i++) {
          const card = document.createElement("div");
          card.className = "lumino-skel-card";
          card.innerHTML = `
            <div class="lumino-skel-bar lumino-skel-badge"></div>
            <div class="lumino-skel-bar lumino-skel-title1"></div>
            <div class="lumino-skel-bar lumino-skel-title2"></div>
            <div class="lumino-skel-bar lumino-skel-text1"></div>
            <div class="lumino-skel-bar lumino-skel-text2"></div>`;
          skelGrid.appendChild(card);
        }
        skelGrid.dataset.built = "1";
      }
      return;
    }

    skelGrid.hidden = true;
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
      const hasImage = !!d.thumbnailUrl;
      const thumbBg = hasImage
        ? `center / cover no-repeat url('${d.thumbnailUrl}')`
        : `radial-gradient(circle at 32% 38%, ${color}55, transparent 62%), linear-gradient(140deg,#172033,#0c1018)`;
      const isUnread = !readUrls.has(d.url);
      a.innerHTML = `
        <div class="lumino-card-thumb" style="background:${thumbBg}">
          ${hasImage ? "" : `<div class="lumino-card-thumb-hatch"></div><div class="lumino-card-thumb-label">記事サムネイル</div>`}
          ${isUnread ? `<span class="lumino-card-unread-badge">NEW</span>` : ""}
        </div>
        <div class="lumino-card-body">
          <div class="lumino-card-row">
            <span class="lumino-card-cat" style="background:${color}24; color:${color}"><span class="lumino-card-cat-dot" style="background:${color}"></span>${d.cat}</span>
            <span class="lumino-card-date">${d.date}</span>
          </div>
          <h3 class="lumino-card-title">${d.title}</h3>
          ${state.showExcerpt && d.excerpt ? `<p class="lumino-card-excerpt">${d.excerpt}</p>` : ""}
          <div class="lumino-card-footer">
            <span class="lumino-card-source">${d.source}</span>
            <span class="lumino-card-cta">記事を読む<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></span>
          </div>
        </div>`;
      a.addEventListener("click", () => markRead(d.url));
      grid.appendChild(a);
    });
  }

  function renderMeta() {
    const filtered = getFiltered();
    document.getElementById("nArticles").textContent = filtered.length;
    document.getElementById("nSources").textContent = new Set(filtered.map((d) => d.source)).size;
    document.getElementById("nToday").textContent = filtered.filter((d) => d.today).length;
  }

  function setQuery(value) {
    state.query = value;
    document.getElementById("searchInput").value = value;
    document.getElementById("searchClearBtn").hidden = value.length === 0;
    renderGrid();
    renderMeta();
  }

  function resetFilters() {
    state.activeCat = "すべて";
    renderChips();
    setQuery("");
  }

  document.getElementById("searchInput").addEventListener("input", (e) => setQuery(e.target.value));
  document.getElementById("searchClearBtn").addEventListener("click", () => setQuery(""));
  document.getElementById("emptyResetBtn").addEventListener("click", resetFilters);

  renderChips();
  renderGrid();
  renderMeta();
})();
