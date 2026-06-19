(function () {
  const CATS = ["すべて", "デザイン", "新製品", "賞・コンペ", "技術・LED", "国内情報"];

  const FALLBACK_SOURCE_COLORS = {
    "照明学会": { bg: "rgba(247,195,86,0.14)", fg: "#f5c560" },
    "日本照明工業会": { bg: "rgba(79,209,197,0.14)", fg: "#5bd6c9" },
    "Lux Review": { bg: "rgba(167,139,250,0.16)", fg: "#b79cf7" },
    "LEDinside": { bg: "rgba(110,231,168,0.14)", fg: "#74e6a6" },
    "遠藤照明": { bg: "rgba(246,165,176,0.15)", fg: "#f3a3ae" },
  };

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
    { source: "照明学会", cat: "賞・コンペ", date: "2026.06.19", today: true,
      title: "あかりコンペ2026 応募受付開始", url: "https://example.com/akari-compe",
      excerpt: "今年のテーマは「人と街をつなぐあかり」。学生からプロフェッショナルまで幅広い参加を募り、応募作品は秋の展示会で披露される予定だ。" },
    { source: "遠藤照明", cat: "国内情報", date: "2026.06.16", today: false,
      title: "遠藤照明、サステナブルライン新製品群", url: "https://example.com/endo-sustainable",
      excerpt: "再生素材の筐体と長寿命設計を採用した環境配慮型シリーズを拡充。施設・店舗向けに、交換頻度とCO2排出の削減を両立する製品を展開する。" },
  ];

  const fetched = window.LUMINO_DATA;
  const DATA = fetched && fetched.articles && fetched.articles.length ? fetched.articles : FALLBACK_DATA;
  const SOURCE_COLORS = fetched && fetched.sourceColors ? fetched.sourceColors : FALLBACK_SOURCE_COLORS;
  const INITIAL_LAST_UPDATED = fetched && fetched.fetchedAt ? fetched.fetchedAt : "2026.06.19  08:42";

  function pickFeaturedIndices() {
    const todayFirst = [];
    const rest = [];
    DATA.forEach((d, i) => (d.today ? todayFirst : rest).push(i));
    return todayFirst.concat(rest).slice(0, Math.min(3, DATA.length));
  }
  const FEATURED_IDX = pickFeaturedIndices();

  const state = {
    activeCat: "すべて",
    loading: false,
    lastUpdated: INITIAL_LAST_UPDATED,
    featured: 0,
    showExcerpt: true,
  };

  let timer = null;

  function colorOf(src) {
    return SOURCE_COLORS[src] || { bg: "rgba(255,255,255,0.08)", fg: "#cdd3e0" };
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    if (FEATURED_IDX.length <= 1) return;
    timer = setInterval(() => {
      state.featured = (state.featured + 1) % FEATURED_IDX.length;
      renderHero();
    }, 5000);
  }

  function goFeatured(i) {
    state.featured = i;
    renderHero();
    startTimer();
  }

  function renderTabs() {
    const nav = document.getElementById("categoryTabs");
    nav.innerHTML = "";
    CATS.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "lumino-tab" + (c === state.activeCat ? " active" : "");
      btn.textContent = c;
      btn.addEventListener("click", () => {
        state.activeCat = c;
        renderTabs();
        renderGrid();
        renderSummary();
      });
      nav.appendChild(btn);
    });
  }

  function renderHero() {
    const track = document.getElementById("heroTrack");
    track.style.transform = `translateX(-${state.featured * 100}%)`;

    if (!track.dataset.built) {
      track.innerHTML = "";
      FEATURED_IDX.forEach((idx) => {
        const d = DATA[idx];
        const col = colorOf(d.source);
        const a = document.createElement("a");
        a.className = "lumino-hero-slide";
        a.href = d.url;
        a.target = "_blank";
        a.rel = "noopener";
        const hasImage = !!d.thumbnailUrl;
        a.style.background = hasImage
          ? `center / cover no-repeat url('${d.thumbnailUrl}'), linear-gradient(120deg,#0f1828,#0a1019)`
          : `radial-gradient(circle at 78% 26%, ${col.fg}3a, transparent 56%), linear-gradient(120deg,#0f1828,#0a1019)`;
        a.innerHTML = `
          ${hasImage ? "" : '<div class="lumino-hero-stripe"></div><div class="lumino-hero-placeholder" style="color:' + col.fg + '">メインビジュアル</div>'}
          <div class="lumino-hero-overlay"></div>
          <div class="lumino-hero-content">
            <span class="lumino-badge" style="background:${col.bg}; color:${col.fg}"><span class="lumino-badge-dot" style="background:${col.fg}"></span>${d.source}</span>
            <h2 class="lumino-hero-title">${d.title}</h2>
            ${d.excerpt ? `<p class="lumino-hero-excerpt">${d.excerpt}</p>` : ""}
            <span class="lumino-hero-cta">記事を読む<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></span>
          </div>`;
        track.appendChild(a);
      });
      track.dataset.built = "1";
    }

    const dotsWrap = document.getElementById("heroDots");
    dotsWrap.innerHTML = "";
    FEATURED_IDX.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", "スライド");
      dot.style.width = i === state.featured ? "26px" : "7px";
      dot.style.background = i === state.featured ? "#f5c560" : "rgba(255,255,255,0.3)";
      dot.addEventListener("click", () => goFeatured(i));
      dotsWrap.appendChild(dot);
    });
  }

  function getFiltered() {
    return state.activeCat === "すべて" ? DATA : DATA.filter((d) => d.cat === state.activeCat);
  }

  function renderGrid() {
    const grid = document.getElementById("newsGrid");
    const skelGrid = document.getElementById("skeletonGrid");

    if (state.loading) {
      grid.hidden = true;
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
    grid.hidden = false;
    grid.innerHTML = "";
    getFiltered().forEach((d) => {
      const col = colorOf(d.source);
      const a = document.createElement("a");
      a.className = "lumino-card";
      a.href = d.url;
      a.target = "_blank";
      a.rel = "noopener";
      const hasImage = !!d.thumbnailUrl;
      const thumbBg = hasImage
        ? `center / cover no-repeat url('${d.thumbnailUrl}')`
        : `linear-gradient(140deg, ${col.fg}24, #0c1322 72%)`;
      a.innerHTML = `
        <div class="lumino-card-thumb" style="background:${thumbBg}">
          ${hasImage ? "" : `<div class="lumino-card-thumb-stripe"></div><div class="lumino-card-thumb-label" style="color:${col.fg}">記事サムネイル</div>`}
        </div>
        <div class="lumino-card-row">
          <span class="lumino-badge lumino-badge--card" style="background:${col.bg}; color:${col.fg}"><span class="lumino-badge-dot" style="background:${col.fg}"></span>${d.source}</span>
          <span class="lumino-card-date">${d.date}</span>
        </div>
        <h3 class="lumino-card-title">${d.title}</h3>
        ${state.showExcerpt && d.excerpt ? `<p class="lumino-card-excerpt">${d.excerpt}</p>` : ""}
        <div class="lumino-card-footer">記事を読む<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></div>`;
      grid.appendChild(a);
    });
  }

  function renderSummary() {
    document.getElementById("nArticles").textContent = getFiltered().length;
    document.getElementById("nSources").textContent = new Set(DATA.map((d) => d.source)).size;
    document.getElementById("nToday").textContent = DATA.filter((d) => d.today).length;
  }

  function onRefresh() {
    if (state.loading) return;
    const btn = document.getElementById("refreshBtn");
    const icon = document.getElementById("refreshIcon");
    state.loading = true;
    btn.disabled = true;
    icon.classList.add("spinning");
    renderGrid();
    // data.js はバックグラウンドの定期取得スクリプトが更新するため、
    // 再読み込みすることで最新の取得結果を反映する。
    setTimeout(() => {
      location.reload();
    }, 1200);
  }

  document.getElementById("refreshBtn").addEventListener("click", onRefresh);
  document.getElementById("lastUpdated").textContent = state.lastUpdated;

  renderTabs();
  renderHero();
  renderGrid();
  renderSummary();
  startTimer();
})();
