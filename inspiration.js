(function () {
  const items = window.LUMINO_INSPIRATION || [];
  const HEIGHTS = ["384px", "286px", "430px", "300px", "350px", "408px"];
  const ACCENT = "#f5c560";

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
