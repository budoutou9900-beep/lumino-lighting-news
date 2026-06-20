(function () {
  const items = window.LUMINO_LEARN || [];
  const CAT_COLORS = { "基礎": "#f5c560", "色のしくみ": "#6fc6c0", "設計": "#e9a6c4", "歴史": "#9aa6f5" };

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
    return escapeHtml(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
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

  function showDetail(item) {
    const featured = document.getElementById("learnFeatured");
    const list = document.getElementById("learnList");
    const detail = document.getElementById("learnDetail");
    featured.hidden = true;
    list.hidden = true;
    detail.hidden = false;
    detail.innerHTML = `
      <button type="button" class="lumino-learn-detail-back" id="learnBackBtn">← 一覧に戻る</button>
      <h2 class="lumino-learn-detail-title">${item.title}</h2>
      <div class="lumino-learn-detail-body">${markdownToHtml(item.content)}</div>`;
    document.getElementById("learnBackBtn").addEventListener("click", showList);
  }

  function showList() {
    document.getElementById("learnFeatured").hidden = false;
    document.getElementById("learnList").hidden = false;
    document.getElementById("learnDetail").hidden = true;
  }

  function renderFeatured(item) {
    const wrap = document.getElementById("learnFeatured");
    const color = catColor(item.category);
    const thumbBg = item.thumbnail
      ? `center / cover no-repeat url('${item.thumbnail}')`
      : `radial-gradient(circle at 30% 40%, ${color}55, transparent 60%), linear-gradient(140deg,#2a2110,#0c1018)`;
    wrap.innerHTML = `
      <div class="lumino-learn-featured-thumb" style="background:${thumbBg}">
        ${item.thumbnail ? "" : `<div class="lumino-learn-featured-hatch"></div>`}
        <span class="lumino-learn-original-badge"><span class="lumino-learn-original-dot"></span>LUMINO ORIGINAL</span>
      </div>
      <div class="lumino-learn-featured-body">
        <span class="lumino-learn-cat" style="color:${color}">${item.category || ""}</span>
        <h3 class="lumino-learn-featured-title">${item.title}</h3>
        <p class="lumino-learn-excerpt">${item.summary || ""}</p>
        <div class="lumino-learn-meta-row">
          <span>LUMINO編集部</span>
          <span class="lumino-learn-meta-dot"></span>
          <span>${item.readTime ? item.readTime + "で読める" : ""}</span>
        </div>
      </div>`;
    wrap.addEventListener("click", () => showDetail(item));
  }

  function renderRow(item) {
    const color = catColor(item.category);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "lumino-learn-row";
    const thumbBg = item.thumbnail
      ? `center / cover no-repeat url('${item.thumbnail}')`
      : `radial-gradient(circle at 45% 50%, ${color}42, transparent 60%), linear-gradient(140deg,#1c2740,#0c1322)`;
    row.innerHTML = `
      <div class="lumino-learn-row-text">
        <span class="lumino-learn-cat" style="color:${color}">${item.category || ""}</span>
        <h4 class="lumino-learn-row-title">${item.title}</h4>
        <div class="lumino-learn-meta-row">
          <span>LUMINO編集部</span>
          <span class="lumino-learn-meta-dot"></span>
          <span>${item.readTime || ""}</span>
        </div>
      </div>
      <div class="lumino-learn-row-thumb" style="background:${thumbBg}"></div>`;
    row.addEventListener("click", () => showDetail(item));
    return row;
  }

  function render() {
    const list = document.getElementById("learnList");
    if (!list) return;
    if (items.length === 0) return;
    renderFeatured(items[0]);
    list.innerHTML = "";
    items.slice(1).forEach((item) => list.appendChild(renderRow(item)));
  }

  render();
})();
