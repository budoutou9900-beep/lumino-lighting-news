(function () {
  const TABS = {
    home: { word: "Home", jp: "今日のあかり", desc: "おすすめの記事と、4つのセクションのハイライトを、ここから。", accent: "#f5c560", accentBg: "rgba(247,195,86,0.14)", glow: "rgba(245,181,61,0.18)", tint: "linear-gradient(180deg, rgba(210,150,60,0.11), rgba(210,150,60,0) 48%)" },
    inspiration: { word: "Inspiration", jp: "光に出会う", desc: "光が美しい瞬間を、世界中のメディアから。眺めるうちに、光に興味が湧いてくる。", accent: "#f5c560", accentBg: "rgba(247,195,86,0.14)", glow: "rgba(245,181,61,0.18)", tint: "linear-gradient(180deg, rgba(210,150,60,0.11), rgba(210,150,60,0) 48%)" },
    news: { word: "News", jp: "業界の最新情報", desc: "メーカー・製品・展示会・受賞。実務に効くニュースを、毎朝。", accent: "#6fc6c0", accentBg: "rgba(111,198,192,0.14)", glow: "rgba(111,198,192,0.16)", tint: "linear-gradient(180deg, rgba(46,158,148,0.11), rgba(46,158,148,0) 48%)" },
    learn: { word: "Learn", jp: "光を、もっと知る", desc: "なぜそう見えるのか。LUMINO編集部による、光の完全オリジナル解説。", accent: "#e9a6c4", accentBg: "rgba(233,166,196,0.14)", glow: "rgba(233,166,196,0.16)", tint: "linear-gradient(180deg, rgba(150,86,168,0.11), rgba(150,86,168,0) 48%)" },
    research: { word: "Research", jp: "論文・学会情報", desc: "学術誌・学会の一次情報。各論文はAI要約に対応予定。", accent: "#9aa6f5", accentBg: "rgba(154,166,245,0.14)", glow: "rgba(154,166,245,0.16)", tint: "linear-gradient(180deg, rgba(70,86,200,0.11), rgba(70,86,200,0) 48%)" },
  };
  const TAB_KEYS = Object.keys(TABS);
  let activeTab = null;

  const sections = {};
  TAB_KEYS.forEach((t) => { sections[t] = document.getElementById("tab-" + t); });
  const navButtons = Array.from(document.querySelectorAll(".lumino-navbtn"));
  const appEl = document.getElementById("luminoApp");

  function applyTheme(tab) {
    const t = TABS[tab];
    appEl.style.setProperty("--accent", t.accent);
    appEl.style.setProperty("--accent-bg", t.accentBg);
    appEl.style.setProperty("--glow", t.glow);
    appEl.style.setProperty("--tint", t.tint);
    document.getElementById("sectionLabel").textContent = t.jp;
    document.getElementById("sectionTitle").textContent = t.word;
    document.getElementById("sectionDesc").textContent = t.desc;
  }

  function showTab(tab) {
    if (!TABS[tab] || tab === activeTab) return;
    const fromIdx = TAB_KEYS.indexOf(activeTab);
    const toIdx = TAB_KEYS.indexOf(tab);
    const dir = toIdx > fromIdx ? "right" : "left";
    activeTab = tab;
    TAB_KEYS.forEach((t) => { sections[t].hidden = t !== tab; });
    navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
    applyTheme(tab);
    document.querySelector(".lumino-content").scrollTo(0, 0);

    const enteringEl = sections[tab];
    const animClass = dir === "right" ? "lumino-slide-in-right" : "lumino-slide-in-left";
    enteringEl.classList.remove("lumino-slide-in-right", "lumino-slide-in-left");
    // 再生のためリフローを強制してからクラスを付与
    void enteringEl.offsetWidth;
    enteringEl.classList.add(animClass);
    enteringEl.addEventListener("animationend", () => {
      enteringEl.classList.remove(animClass);
    }, { once: true });
  }

  window.luminoGoTab = showTab;
  window.LUMINO_TAB_THEME = TABS;

  navButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

  // SWIPE NAVIGATION
  const contentEl = document.querySelector(".lumino-content");
  let touchStartX = null;
  let touchStartY = null;

  contentEl.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  contentEl.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = TAB_KEYS.indexOf(activeTab);
    if (dx < 0 && idx < TAB_KEYS.length - 1) showTab(TAB_KEYS[idx + 1]);
    if (dx > 0 && idx > 0) showTab(TAB_KEYS[idx - 1]);
  }, { passive: true });

  showTab("home");
})();
