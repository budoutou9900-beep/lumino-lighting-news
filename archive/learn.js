(function () {
  const items = window.LUMINO_LEARN || [];
  const CAT_COLORS = { "基礎": "#f5c560", "色のしくみ": "#6fc6c0", "設計": "#e9a6c4", "歴史": "#9aa6f5" };
  const CARD_HEIGHTS = ["280px", "340px", "300px", "360px", "310px"];

  function catColor(cat) {
    const key = Object.keys(CAT_COLORS).find((k) => (cat || "").includes(k));
    return key ? CAT_COLORS[key] : "#f5c560";
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inlineFormat(text) {
    return escapeHtml(text)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function markdownToHtml(md) {
    const lines = (md || "").split("\n");
    let html = "";
    let listOpen = false;
    const closeList = () => { if (listOpen) { html += "</ul>"; listOpen = false; } };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) { closeList(); return; }
      if (trimmed.startsWith("## ")) {
        closeList();
        html += `<h2>${inlineFormat(trimmed.slice(3))}</h2>`;
      } else if (trimmed.startsWith("- ")) {
        if (!listOpen) { html += "<ul>"; listOpen = true; }
        html += `<li>${inlineFormat(trimmed.slice(2))}</li>`;
      } else {
        closeList();
        html += `<p>${inlineFormat(trimmed)}</p>`;
      }
    });
    closeList();
    return html;
  }

  function thumbStyle(item, size) {
    const color = catColor(item.category);
    if (item.thumbnail) return `background:center / cover no-repeat url('${item.thumbnail}')`;
    const grad = size === "hero"
      ? `radial-gradient(circle at 30% 35%, ${color}55, transparent 60%), linear-gradient(140deg,#1c1610,#0c1018)`
      : `radial-gradient(circle at 30% 40%, ${color}55, transparent 60%), linear-gradient(140deg,#1c1610,#0c1018)`;
    return `background:${grad}`;
  }

  function renderMasonry() {
    const wrap = document.getElementById("learnMasonry");
    wrap.innerHTML = "";
    items.forEach((item, i) => {
      const color = catColor(item.category);
      const height = CARD_HEIGHTS[i % CARD_HEIGHTS.length];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "lumino-learn-card";
      card.innerHTML = `
        <div class="lumino-learn-card-img" style="height:${height};${thumbStyle(item)}">
          ${item.thumbnail ? "" : `<div class="lumino-learn-card-hatch"></div>`}
          <div class="lumino-learn-card-fade"></div>
          <div class="lumino-learn-card-text">
            <span class="lumino-learn-cat" style="color:${color}">${item.category || ""}</span>
            <h3 class="lumino-learn-card-title">${item.title}</h3>
          </div>
        </div>`;
      card.addEventListener("click", () => openArticle(item));
      wrap.appendChild(card);
    });
  }

  function relatedFor(item) {
    const sameCat = items.filter((i) => i.id !== item.id && i.category === item.category);
    const others = items.filter((i) => i.id !== item.id && i.category !== item.category);
    return sameCat.concat(others).slice(0, 3);
  }

  function openArticle(item) {
    const color = catColor(item.category);
    const articleWrap = document.getElementById("learnArticle");
    const related = relatedFor(item);

    articleWrap.innerHTML = `
      <div class="lumino-learn-article-card">
        <div class="lumino-learn-article-hero" style="${thumbStyle(item, "hero")}">
          ${item.thumbnail ? "" : `<div class="lumino-learn-article-hero-fallback">フル幅ヒーロー画像</div>`}
          <span class="lumino-learn-original-badge"><span class="lumino-learn-original-dot"></span>LUMINO ORIGINAL</span>
          <div class="lumino-learn-article-hero-title-wrap">
            <span class="lumino-learn-cat" style="color:${color}">${item.category || ""}</span>
            <h1 class="lumino-learn-article-title">${item.title}</h1>
            ${item.summary ? `<p class="lumino-learn-article-tagline">${item.summary}</p>` : ""}
          </div>
        </div>
        <div class="lumino-learn-article-body-wrap">
          <div class="lumino-learn-article-meta-row">
            <div class="lumino-learn-article-avatar"></div>
            <div>
              <div class="lumino-learn-article-authorlabel">著者</div>
              <div class="lumino-learn-article-author">LUMINO編集部</div>
              <div class="lumino-learn-article-datemeta">${item.date || ""}${item.date && item.readTime ? " • " : ""}${item.readTime ? item.readTime + "で読める" : ""}</div>
            </div>
          </div>
          <div class="lumino-learn-detail-body">${markdownToHtml(item.content)}</div>
        </div>
        ${related.length ? `
        <div class="lumino-learn-related-wrap">
          <h3 class="lumino-learn-related-title">関連する記事</h3>
          <div class="lumino-learn-related-grid">
            ${related.map((rel) => `
              <button type="button" class="lumino-learn-related-card" data-id="${rel.id}">
                <span class="lumino-learn-cat" style="color:${catColor(rel.category)}">${rel.category || ""}</span>
                <h4 class="lumino-learn-related-title">${rel.title}</h4>
                <div class="lumino-learn-related-read">${rel.readTime || ""}</div>
              </button>`).join("")}
          </div>
        </div>` : ""}
      </div>`;

    articleWrap.querySelectorAll(".lumino-learn-related-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rel = items.find((i) => String(i.id) === btn.dataset.id);
        if (rel) openArticle(rel);
      });
    });

    document.getElementById("learnMasonry").hidden = true;
    document.getElementById("learnBackBtn").hidden = false;
    articleWrap.hidden = false;
    window.scrollTo(0, 0);
  }

  function closeArticle() {
    document.getElementById("learnArticle").hidden = true;
    document.getElementById("learnBackBtn").hidden = true;
    document.getElementById("learnMasonry").hidden = false;
    window.scrollTo(0, 0);
  }

  document.getElementById("learnBackBtn").addEventListener("click", closeArticle);
  window.luminoCloseLearnArticle = closeArticle;

  function render() {
    if (!document.getElementById("learnMasonry")) return;
    renderMasonry();
  }

  render();
})();
