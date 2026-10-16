(function () {
  const TABS = {
    Art: { jp: "アート・展示", accent: "#e9a6c4", accentBg: "rgba(233,166,196,0.14)", glow: "rgba(233,166,196,0.16)", tint: "linear-gradient(180deg, rgba(150,86,168,0.11), rgba(150,86,168,0) 48%)" },
    Architecture: { jp: "建築・照明デザイン", accent: "#f5c560", accentBg: "rgba(247,195,86,0.14)", glow: "rgba(245,181,61,0.18)", tint: "linear-gradient(180deg, rgba(210,150,60,0.11), rgba(210,150,60,0) 48%)" },
    Technology: { jp: "製品・技術", accent: "#6fc6c0", accentBg: "rgba(111,198,192,0.14)", glow: "rgba(111,198,192,0.16)", tint: "linear-gradient(180deg, rgba(46,158,148,0.11), rgba(46,158,148,0) 48%)" },
  };
  const TAB_KEYS = Object.keys(TABS);
  const TAB_STORAGE_KEY = "lumino-active-tab";
  let activeTab = null;

  const section = document.getElementById("tab-news");
  const navButtons = Array.from(document.querySelectorAll(".lumino-tabitem"));
  const appEl = document.getElementById("luminoApp");
  const contentEl = document.querySelector(".lumino-content");

  function applyTheme(tab) {
    const t = TABS[tab];
    appEl.style.setProperty("--accent", t.accent);
    appEl.style.setProperty("--accent-bg", t.accentBg);
    appEl.style.setProperty("--glow", t.glow);
    appEl.style.setProperty("--tint", t.tint);
    document.getElementById("sectionLabel").textContent = t.jp;
    document.getElementById("sectionTitle").textContent = tab;
  }

  function showTab(tab) {
    if (!TABS[tab] || tab === activeTab) return;
    const fromIdx = TAB_KEYS.indexOf(activeTab);
    const toIdx = TAB_KEYS.indexOf(tab);
    const animClass = toIdx > fromIdx ? "lumino-slide-in-right" : "lumino-slide-in-left";
    activeTab = tab;
    try { localStorage.setItem(TAB_STORAGE_KEY, tab); } catch {}
    navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
    applyTheme(tab);
    window.luminoSetCategory(tab);
    contentEl.scrollTo(0, 0);

    section.classList.remove("lumino-slide-in-right", "lumino-slide-in-left");
    // 再生のためリフローを強制してからクラスを付与
    void section.offsetWidth;
    section.classList.add(animClass);
    section.addEventListener("animationend", () => {
      section.classList.remove(animClass);
    }, { once: true });
  }

  navButtons.forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tab)));

  // SWIPE NAVIGATION
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

  let initial = "Architecture";
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (TABS[saved]) initial = saved;
  } catch {}
  showTab(initial);
})();
