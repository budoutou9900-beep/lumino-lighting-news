(function () {
  const data = window.LUMINO_RESEARCH || { papers: [] };
  const papers = data.papers || [];
  let openIndex = null;

  function renderCard(p, i) {
    const card = document.createElement("div");
    card.className = "lumino-research-card";
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : p.url;
    const hasAi = !!p.ai;

    card.innerHTML = `
      <div class="lumino-research-row">
        <span class="lumino-research-journal">${p.journal || ""}</span>
        <span class="lumino-research-date">${p.date || ""}</span>
      </div>
      <a class="lumino-research-title" href="${doiUrl}" target="_blank" rel="noopener">${p.title || ""}</a>
      ${p.authors ? `<p class="lumino-research-authors">${p.authors}</p>` : ""}
      ${p.doi ? `<div class="lumino-research-doi"><a href="${doiUrl}" target="_blank" rel="noopener">DOI: ${p.doi}</a></div>` : ""}
      <div class="lumino-ai-area">
        <button type="button" class="lumino-ai-toggle">
          <span class="lumino-ai-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2M12 19v2M5 12H3M21 12h-2"></path><circle cx="12" cy="12" r="4"></circle></svg>AI要約</span>
          <span class="lumino-ai-status">${hasAi ? "要点を読む" : "近日公開"}</span>
          <svg class="lumino-ai-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c859b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
        </button>
        <div class="lumino-ai-content" hidden>
          <p style="color:${hasAi ? "#cdd3e0" : "#7c859b"}">${hasAi ? p.ai : "この論文のAI要約は近日公開予定です。原文(DOI)をご参照ください。"}</p>
        </div>
      </div>`;

    const toggleBtn = card.querySelector(".lumino-ai-toggle");
    const content = card.querySelector(".lumino-ai-content");
    const chevron = card.querySelector(".lumino-ai-chevron");
    toggleBtn.addEventListener("click", () => {
      const isOpen = openIndex === i;
      openIndex = isOpen ? null : i;
      content.hidden = isOpen;
      chevron.classList.toggle("open", !isOpen);
    });

    return card;
  }

  function render() {
    const list = document.getElementById("researchList");
    if (!list) return;
    list.innerHTML = "";
    if (papers.length === 0) {
      list.innerHTML = `<div class="lumino-empty"><div class="lumino-empty-title">論文データがまだありません</div><div class="lumino-empty-sub">fetch_research.py を実行するとここに表示されます。</div></div>`;
      return;
    }
    papers.forEach((p, i) => list.appendChild(renderCard(p, i)));
  }

  render();
})();
