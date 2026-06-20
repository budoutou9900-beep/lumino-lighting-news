(function () {
  const NEWS = (window.LUMINO_DATA && window.LUMINO_DATA.articles) || [];
  const INSPIRATION = window.LUMINO_INSPIRATION || [];
  const LEARN = window.LUMINO_LEARN || [];
  const RESEARCH = (window.LUMINO_RESEARCH && window.LUMINO_RESEARCH.papers) || [];

  const TODAY_PICK = window.LUMINO_TODAY_PICK || null;
  const SECTION_COLORS = { inspiration: "#f5c560", news: "#6fc6c0", learn: "#e9a6c4", research: "#9aa6f5" };

  function goTab(tab) {
    if (window.luminoGoTab) window.luminoGoTab(tab);
  }

  // ---- 今日のあかり ----
  function renderTodayPick() {
    const wrap = document.getElementById("todayPick");
    if (!wrap || !TODAY_PICK) return;
    const visualBg = TODAY_PICK.imageUrl
      ? `center / cover no-repeat url('${TODAY_PICK.imageUrl}')`
      : "radial-gradient(circle at 40% 40%, rgba(245,181,61,0.32), transparent 60%), linear-gradient(150deg,#241a10,#0c1018)";
    const card = document.createElement(TODAY_PICK.sourceUrl ? "a" : "div");
    card.className = "lumino-todaypick-card";
    if (TODAY_PICK.sourceUrl) {
      card.href = TODAY_PICK.sourceUrl;
      card.target = "_blank";
      card.rel = "noopener";
    }
    card.innerHTML = `
      <div class="lumino-todaypick-visual" style="background:${visualBg}">
        ${TODAY_PICK.imageUrl ? "" : `<div class="lumino-todaypick-hatch"></div><div class="lumino-todaypick-visual-label">VISUAL</div>`}
      </div>
      <div class="lumino-todaypick-body">
        <span class="lumino-todaypick-source">${TODAY_PICK.sourceName || ""}</span>
        <p class="lumino-todaypick-comment">${TODAY_PICK.comment || ""}</p>
        ${TODAY_PICK.sourceUrl ? `<span class="lumino-todaypick-link">出典を見る ↗</span>` : ""}
      </div>`;

    wrap.innerHTML = `
      <div class="lumino-todaypick-head">
        <span class="lumino-dot-sm"></span>
        <span class="lumino-todaypick-label">今日のあかり</span>
      </div>`;
    wrap.appendChild(card);
  }

  // ---- HERO ----
  function pickFeaturedIndices() {
    const todayFirst = [];
    const rest = [];
    NEWS.forEach((d, i) => (d.today ? todayFirst : rest).push(i));
    return todayFirst.concat(rest).slice(0, Math.min(3, NEWS.length));
  }
  const FEATURED_IDX = pickFeaturedIndices();
  let featured = 0;
  let heroTimer = null;

  function renderHero() {
    const track = document.getElementById("heroTrack");
    const dotsWrap = document.getElementById("heroDots");
    if (!track || FEATURED_IDX.length === 0) return;

    track.style.transform = `translateX(-${featured * 100}%)`;
    if (!track.dataset.built) {
      track.innerHTML = "";
      FEATURED_IDX.forEach((idx) => {
        const d = NEWS[idx];
        const a = document.createElement("a");
        a.className = "lumino-hero-slide";
        a.href = d.url;
        a.target = "_blank";
        a.rel = "noopener";
        const hasImage = !!d.thumbnailUrl;
        if (hasImage) a.style.backgroundImage = `url('${d.thumbnailUrl}')`;
        else a.style.background = "radial-gradient(circle at 70% 30%, rgba(245,181,61,0.3), transparent 60%), linear-gradient(120deg,#0f1828,#0a1019)";
        a.innerHTML = `
          ${hasImage ? "" : '<div class="lumino-hero-stripe"></div><div class="lumino-hero-placeholder">メインビジュアル</div>'}
          <div class="lumino-hero-overlay"></div>
          <div class="lumino-hero-content">
            <span class="lumino-home-card-source" style="color:#6fc6c0">${d.source}</span>
            <h2 class="lumino-hero-title">${d.title}</h2>
            ${d.excerpt ? `<p class="lumino-hero-excerpt">${d.excerpt}</p>` : ""}
            <span class="lumino-hero-cta">記事を読む<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></span>
          </div>`;
        track.appendChild(a);
      });
      track.dataset.built = "1";
    }

    dotsWrap.innerHTML = "";
    FEATURED_IDX.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.setAttribute("aria-label", "スライド");
      dot.style.width = i === featured ? "24px" : "7px";
      dot.style.background = i === featured ? "#f5c560" : "rgba(255,255,255,0.3)";
      dot.addEventListener("click", () => goFeatured(i));
      dotsWrap.appendChild(dot);
    });
  }

  function startHeroTimer() {
    if (heroTimer) clearInterval(heroTimer);
    if (FEATURED_IDX.length <= 1) return;
    heroTimer = setInterval(() => {
      featured = (featured + 1) % FEATURED_IDX.length;
      renderHero();
    }, 5000);
  }

  function goFeatured(i) {
    featured = i;
    renderHero();
    startHeroTimer();
  }

  // ---- PREVIEW ROWS ----
  function sectionHeader(key, label) {
    const color = SECTION_COLORS[key];
    const head = document.createElement("div");
    head.className = "lumino-home-head";
    head.innerHTML = `
      <span class="lumino-home-label" style="color:${color}"><span class="lumino-home-label-dot" style="background:${color}"></span>${label}</span>
      <button type="button" class="lumino-home-more" style="color:${color}">もっと見る ↗</button>`;
    head.querySelector(".lumino-home-more").addEventListener("click", () => goTab(key));
    return head;
  }

  function renderInspirationPreview(container) {
    const items = INSPIRATION.slice(0, 3);
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "lumino-home-section";
    section.appendChild(sectionHeader("inspiration", "Inspiration"));
    const row = document.createElement("div");
    row.className = "lumino-home-row";
    items.forEach((item) => {
      const card = document.createElement("a");
      card.className = "lumino-home-card";
      card.href = item.sourceUrl || "#";
      card.target = "_blank";
      card.rel = "noopener";
      const thumbBg = item.imageUrl
        ? `center / cover no-repeat url('${item.imageUrl}')`
        : "linear-gradient(140deg,#2a2110,#0c1018)";
      card.innerHTML = `
        <div class="lumino-home-card-thumb" style="background:${thumbBg}">${item.imageUrl ? "" : `<div class="lumino-home-card-thumb-label">VISUAL</div>`}</div>
        <div class="lumino-home-card-body">
          <span class="lumino-home-card-source" style="color:${SECTION_COLORS.inspiration}">${item.sourceName || ""}</span>
          <p class="lumino-home-card-comment">${item.comment || ""}</p>
        </div>`;
      row.appendChild(card);
    });
    section.appendChild(row);
    container.appendChild(section);
  }

  function renderNewsPreview(container) {
    const items = NEWS.slice().sort((a, b) => (b.today ? 1 : 0) - (a.today ? 1 : 0)).slice(0, 3);
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "lumino-home-section";
    section.appendChild(sectionHeader("news", "News"));
    const row = document.createElement("div");
    row.className = "lumino-home-row";
    items.forEach((d) => {
      const card = document.createElement("a");
      card.className = "lumino-home-card";
      card.href = d.url;
      card.target = "_blank";
      card.rel = "noopener";
      const thumbBg = d.thumbnailUrl
        ? `center / cover no-repeat url('${d.thumbnailUrl}')`
        : "linear-gradient(140deg,#172033,#0c1018)";
      card.innerHTML = `
        <div class="lumino-home-card-thumb" style="background:${thumbBg}">${d.thumbnailUrl ? "" : `<div class="lumino-home-card-thumb-label">記事サムネイル</div>`}</div>
        <div class="lumino-home-card-body">
          <span class="lumino-home-card-source" style="color:${SECTION_COLORS.news}">${d.source}</span>
          <h4 class="lumino-home-card-title">${d.title}</h4>
        </div>`;
      row.appendChild(card);
    });
    section.appendChild(row);
    container.appendChild(section);
  }

  function renderLearnPreview(container) {
    const items = LEARN.slice(0, 3);
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "lumino-home-section";
    section.appendChild(sectionHeader("learn", "Learn"));
    const row = document.createElement("div");
    row.className = "lumino-home-row";
    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lumino-home-card";
      const thumbBg = item.thumbnail
        ? `center / cover no-repeat url('${item.thumbnail}')`
        : "linear-gradient(140deg,#241420,#0c1018)";
      card.innerHTML = `
        <div class="lumino-home-card-thumb" style="background:${thumbBg}"></div>
        <div class="lumino-home-card-body">
          <span class="lumino-home-card-source" style="color:${SECTION_COLORS.learn}">${item.category || ""}</span>
          <h4 class="lumino-home-card-title">${item.title}</h4>
        </div>`;
      card.addEventListener("click", () => goTab("learn"));
      row.appendChild(card);
    });
    section.appendChild(row);
    container.appendChild(section);
  }

  function renderResearchPreview(container) {
    const items = RESEARCH.slice(0, 3);
    if (items.length === 0) return;
    const section = document.createElement("div");
    section.className = "lumino-home-section";
    section.appendChild(sectionHeader("research", "Research"));
    const row = document.createElement("div");
    row.className = "lumino-home-row";
    items.forEach((p) => {
      const card = document.createElement("a");
      card.className = "lumino-home-card";
      card.href = p.doi ? `https://doi.org/${p.doi}` : p.url || "#";
      card.target = "_blank";
      card.rel = "noopener";
      card.innerHTML = `
        <div class="lumino-home-card-body" style="padding-top:14px;">
          <span class="lumino-home-card-source" style="color:${SECTION_COLORS.research}">${p.journal || ""}</span>
          <h4 class="lumino-home-card-title">${p.title || ""}</h4>
        </div>`;
      row.appendChild(card);
    });
    section.appendChild(row);
    container.appendChild(section);
  }

  function render() {
    renderTodayPick();
    renderHero();
    startHeroTimer();
    const container = document.getElementById("homePreviews");
    if (!container) return;
    container.innerHTML = "";
    renderInspirationPreview(container);
    renderNewsPreview(container);
    renderLearnPreview(container);
    renderResearchPreview(container);
  }

  render();
})();
