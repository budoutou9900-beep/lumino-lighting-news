(function () {
  const ALL_ITEMS = window.LUMINO_INSPIRATION || [];
  const DAILY_COUNT = 10;
  const HEIGHTS = ["384px", "286px", "430px", "300px", "350px", "408px"];
  const ACCENT = "#f5c560";

  // 日付（UTC日数）をシードにした決定論的な疑似乱数。同じ日は何回見ても同じ並びになり、
  // 日が変わるとストックの中から別の10件が選ばれる。サーバー不要の静的サイトでの「毎日ローテーション」実装。
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickDailyItems(all) {
    if (all.length <= DAILY_COUNT) return all;
    const daySeed = Math.floor(Date.now() / 86400000);
    const rand = mulberry32(daySeed);
    const shuffled = all.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, DAILY_COUNT);
  }

  const items = pickDailyItems(ALL_ITEMS);

  function renderCard(item, i) {
    const article = document.createElement("article");
    article.className = "lumino-insp-card";

    if (!item.imageUrl) {
      article.innerHTML = `
        <div class="lumino-insp-textcard">
          <span class="lumino-insp-source" style="position:static; display:inline-flex;">${item.sourceName || ""}</span>
          <p class="lumino-insp-comment" style="margin-top:14px;">${item.comment || ""}</p>
        </div>`;
      const card = article.querySelector(".lumino-insp-textcard");
      if (item.sourceUrl) {
        const link = document.createElement("a");
        link.href = item.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.className = "lumino-insp-credit";
        link.style.display = "block";
        link.style.marginTop = "14px";
        link.textContent = "出典を見る ↗";
        card.appendChild(link);
      }
      return article;
    }

    const visual = document.createElement("a");
    visual.className = "lumino-insp-visual";
    visual.style.height = HEIGHTS[i % HEIGHTS.length];
    visual.style.backgroundImage = `url('${item.imageUrl}')`;
    visual.href = item.sourceUrl || item.imageUrl;
    visual.target = "_blank";
    visual.rel = "noopener";
    visual.innerHTML = `
      <span class="lumino-insp-source">${item.sourceName || ""}</span>
      <span class="lumino-insp-source-link">出典へ<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M7 7h10v10"></path></svg></span>`;

    const img = new Image();
    img.onerror = () => {
      visual.style.backgroundImage = "none";
      visual.style.background = "linear-gradient(140deg,#1c2740,#0c1322)";
      const hatch = document.createElement("div");
      hatch.className = "lumino-insp-hatch";
      const label = document.createElement("div");
      label.className = "lumino-insp-visual-label";
      label.textContent = "VISUAL";
      visual.prepend(label);
      visual.prepend(hatch);
    };
    img.src = item.imageUrl;

    const body = document.createElement("div");
    body.className = "lumino-insp-body";
    body.innerHTML = `
      <p class="lumino-insp-comment">${item.comment || ""}</p>
      ${item.credit ? `<div class="lumino-insp-credit-row"><span class="lumino-insp-credit-dot" style="background:${ACCENT}"></span><span class="lumino-insp-credit">${item.credit}</span></div>` : ""}`;

    article.appendChild(visual);
    article.appendChild(body);
    return article;
  }

  function render() {
    const feed = document.getElementById("inspirationFeed");
    if (!feed) return;
    feed.innerHTML = "";
    items.forEach((item, i) => feed.appendChild(renderCard(item, i)));
  }

  render();
})();
