(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const isMobile = () => window.innerWidth < 768;

  let systemState = 'offline';

  const setState = (state) => {
    systemState = state;
    root.setAttribute('data-state', state);
    updateAllIndicators();
  };

  const updateAllIndicators = () => {
    $$('.indicator-pills').forEach(group => {
      const red = $('.pill.red', group);
      const amber = $('.pill.amber', group);
      const green = $('.pill.green', group);
      if (!red || !amber || !green) return;

      [red, amber, green].forEach(p => p.className = p.className.replace(/ state-\w+/g, ''));

      if (systemState === 'offline') {
        red.classList.add('state-off');
        amber.classList.add('state-off');
        green.classList.add('state-off');
      } else if (systemState === 'active') {
        red.classList.add('state-dim');
        amber.classList.add('state-active');
        green.classList.add('state-dim');
      } else if (systemState === 'ready') {
        red.classList.add('state-dim');
        amber.classList.add('state-dim');
        green.classList.add('state-ready');
      }
    });
  };

  /* THEME */
  const THEME_KEY = "sb_theme";

  const getStoredTheme = () => {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
  };

  const saveTheme = (t) => {
    try { localStorage.setItem(THEME_KEY, t); } catch {}
  };

  const getTimeBasedTheme = () => {
    try {
      const h = new Date().getHours();
      return (h >= 9 && h < 18) ? "light" : "dark";
    } catch {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
    }
  };

  const swapAssets = (theme) => {
    $$("img[data-src-light][data-src-dark]").forEach(img => {
      img.src = theme === "dark" ? img.getAttribute("data-src-dark") : img.getAttribute("data-src-light");
    });
    const fnMark = $(".fn-mark");
    if (fnMark) {
      fnMark.src = theme === "dark" ? "./assets/marks/field-notes-white.png" : "./assets/marks/field-notes.png";
    }
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    swapAssets(theme);
  };

  const initTheme = () => {
    const stored = getStoredTheme();
    const initial = stored || getTimeBasedTheme();
    applyTheme(initial);

    const toggle = $("#themeToggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        saveTheme(next);
        applyTheme(next);
      });
    }
  };

  /* PRELUDE - ENFORCED 3.2s */
  const initPrelude = () => {
    const prelude = $("#prelude");
    if (!prelude) {
      setState('ready');
      return;
    }

    try {
      if (sessionStorage.getItem("sb_booted") === "1") {
        prelude.remove();
        setState('ready');
        return;
      }
      sessionStorage.setItem("sb_booted", "1");
    } catch {}

    const setPhase = (p) => prelude.setAttribute("data-phase", p);

    let started = false;
    const startTime = Date.now();

    const runSequence = () => {
      if (started) return;
      started = true;

      // Phase 1: Presence (0-260ms)
      setPhase('presence');
      setState('offline');

      setTimeout(() => {
        // Phase 2: Active (260-2060ms)
        setPhase('active');
        setState('active');

        setTimeout(() => {
          // Phase 3: Ready (2060-2580ms)
          setPhase('ready');
          setState('ready');

          setTimeout(() => {
            // Phase 4: Reveal (2360-2880ms) - overlaps
            setPhase('reveal');

            setTimeout(() => {
              // Phase 5: Exit (2880-3200ms)
              setPhase('exit');

              setTimeout(() => {
                prelude.remove();
              }, 320);

            }, 520);
          }, 300);
        }, 1800);
      }, 260);
    };

    // ENFORCE 3.2s minimum - wait until both load complete AND 2060ms elapsed
    const minWait = 2060;
    let loadComplete = false;

    const checkStart = () => {
      const elapsed = Date.now() - startTime;
      if (loadComplete && elapsed >= minWait) {
        runSequence();
      } else {
        const remaining = Math.max(0, minWait - elapsed);
        setTimeout(checkStart, remaining);
      }
    };

    if (document.readyState === "complete") {
      loadComplete = true;
      checkStart();
    } else {
      window.addEventListener("load", () => {
        loadComplete = true;
        checkStart();
      }, { once: true });
    }

    // Failsafe
    setTimeout(runSequence, 5200);
  };

  /* ROUTING */
  const applyRoute = () => {
    const hash = window.location.hash.toLowerCase();
    const showFN = hash === "#field-notes";
    
    const main = $("#mainSite");
    const fn = $("#fieldNotes");
    
    if (showFN) {
      if (main) main.hidden = true;
      if (fn) fn.hidden = false;
      document.body.classList.add('route-fn');
    } else {
      if (main) main.hidden = false;
      if (fn) fn.hidden = true;
      document.body.classList.remove('route-fn');
    }
  };

  const initRouting = () => {
    window.addEventListener("hashchange", applyRoute);
    applyRoute();
  };

  /* BRAND REFRESH */
  const initBrandRefresh = () => {
    const btn = $("#brandRefresh");
    if (btn) {
      btn.addEventListener("click", () => {
        window.location.hash = "";
        window.scrollTo(0, 0);
      });
    }
  };

  /* FN REFRESH */
  const initFNRefresh = () => {
    const btn = $("#fnRefresh");
    if (btn) {
      btn.addEventListener("click", () => {
        loadFieldNotes();
      });
    }

    const close = $("#fnClose");
    if (close) {
      close.addEventListener("click", () => {
        window.location.hash = "";
      });
    }
  };

  /* VIEW TOGGLE */
  const VIEW_KEY = "sb_view";
  const initViewToggle = () => {
    const toggle = $("#viewToggle");
    const feed = $("#fnFeed");
    if (!toggle || !feed) return;

    const iconGrid = $(".icon-grid", toggle);
    const iconList = $(".icon-list", toggle);
    const label = $(".fn-label", toggle);

    let view = "grid";
    try { view = localStorage.getItem(VIEW_KEY) || "grid"; } catch {}

    const apply = (v) => {
      view = v;
      if (v === "list") {
        feed.classList.add("list-view");
        if (iconGrid) iconGrid.style.display = "none";
        if (iconList) iconList.style.display = "block";
        if (label) label.textContent = "List";
      } else {
        feed.classList.remove("list-view");
        if (iconGrid) iconGrid.style.display = "block";
        if (iconList) iconList.style.display = "none";
        if (label) label.textContent = "Grid";
      }
      try { localStorage.setItem(VIEW_KEY, v); } catch {}
    };

    apply(view);
    toggle.addEventListener("click", () => apply(view === "grid" ? "list" : "grid"));
  };

  /* FIELD NOTES LOADER */
  const API_ID = "2ea3c4a766e480b7a46ed6bb8d6cde82";
  const API_URL = `https://notion-api.splitbee.io/v1/table/${API_ID}`;

  const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  const fmtDate = (v) => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return String(v);
    }
  };

  const isPublic = (r) => {
    const v = r?.Public;
    if (v == null || v === "") return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    const s = String(v).trim().toLowerCase();
    return s === "true" || s === "yes" || s === "1" || s === "checked" || s === "✅";
  };

  const getMedia = (r) => {
    const m = r?.Media;
    if (!m) return "";
    if (typeof m === "string") return m;
    if (Array.isArray(m) && m.length) {
      const f = m[0];
      if (typeof f === "string") return f;
      if (f?.url) return f.url;
    }
    if (m?.url) return m.url;
    return "";
  };

  const isVideo = (url) => {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.endsWith(".mp4") || u.endsWith(".mov") || u.includes("video");
  };

  const pickSize = (i, hasMedia) => {
    const cycle = hasMedia ? ["l", "m", "m", "s", "m"] : ["m", "s", "m", "s", "m"];
    return cycle[i % cycle.length];
  };

  const getUrl = (r) => r?.__url || r?.URL || r?.Url || r?.Link || "";

  const renderCard = (row, idx) => {
    const title = row?.Title || row?.Name || "Field note";
    const type = row?.Type || "Note";
    const excerpt = row?.Excerpt || row?.Text || row?.Content || "";
    const date = row?.Published || row?.Date || row?.Created || "";
    const url = getUrl(row);
    const media = getMedia(row);
    const hasMedia = Boolean(media);
    const size = pickSize(idx, hasMedia);

    if (!hasMedia) {
      const quote = excerpt || title;
      return `
        <article class="fn-card ${size} text">
          <button class="fn-card-btn"
            data-url="${esc(url)}"
            data-title="${esc(title)}"
            data-type="${esc(type)}"
            data-date="${esc(date)}"
            data-excerpt="${esc(excerpt)}">
            <div class="fn-tag">${esc(type)}</div>
            <div class="fn-content">
              <div class="fn-quote">${esc(quote)}</div>
              <div class="fn-source">${esc(title)}</div>
            </div>
            <div class="fn-meta">
              <span>${esc(type)}</span>
              <span>${esc(fmtDate(date))}</span>
            </div>
          </button>
        </article>
      `;
    }

    const mediaEl = isVideo(media)
      ? `<video class="fn-media" src="${esc(media)}" muted playsinline preload="metadata"></video>`
      : `<img class="fn-media" src="${esc(media)}" alt="" loading="lazy" />`;

    return `
      <article class="fn-card ${size} media">
        <button class="fn-card-btn"
          data-url="${esc(url)}"
          data-title="${esc(title)}"
          data-type="${esc(type)}"
          data-date="${esc(date)}"
          data-excerpt="${esc(excerpt)}">
          ${mediaEl}
          <div class="fn-scrim"></div>
          <div class="fn-meta">
            <span>${esc(type)}</span>
            <span>${esc(fmtDate(date))}</span>
          </div>
        </button>
      </article>
    `;
  };

  const openModal = ({ title, type, date, excerpt, url }) => {
    if (isMobile()) {
      openSheet({ title, type, date, excerpt, url });
    } else {
      openCenterModal({ title, type, date, excerpt, url });
    }
  };

  const openCenterModal = ({ title, type, date, excerpt, url }) => {
    const modal = $("#modal");
    const body = $("#modalBody");
    const link = $("#modalLink");
    const close = $(".modal-close", modal);

    if (!modal || !body || !link || !close) return;

    body.innerHTML = `
      <div class="modal-kicker">${esc(type || "Field note")}</div>
      <h3 class="modal-title">${esc(title || "Field note")}</h3>
      <div class="modal-date">${esc(fmtDate(date))}</div>
      <div class="modal-excerpt">${esc(excerpt || "")}</div>
    `;

    if (url && url !== "#") {
      link.href = url;
      link.style.display = "inline-flex";
    } else {
      link.style.display = "none";
    }

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    close.onclick = closeModal;
    modal.onclick = (e) => { if (e.target.classList.contains('modal-backdrop')) closeModal(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); }, { once: true });
  };

  const openSheet = ({ title, type, date, excerpt, url }) => {
    const sheet = $("#sheet");
    const body = $("#sheetBody");
    const link = $("#sheetLink");
    const close = $(".sheet-close", sheet);

    if (!sheet || !body || !link || !close) return;

    body.innerHTML = `
      <div class="modal-kicker">${esc(type || "Field note")}</div>
      <h3 class="modal-title">${esc(title || "Field note")}</h3>
      <div class="modal-date">${esc(fmtDate(date))}</div>
      <div class="modal-excerpt">${esc(excerpt || "")}</div>
    `;

    if (url && url !== "#") {
      link.href = url;
      link.style.display = "inline-flex";
    } else {
      link.style.display = "none";
    }

    sheet.setAttribute("aria-hidden", "false");
    sheet.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const closeSheet = () => {
      sheet.setAttribute("aria-hidden", "true");
      sheet.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    close.onclick = closeSheet;
    sheet.onclick = (e) => { if (e.target.classList.contains('sheet-backdrop')) closeSheet(); };
  };

  async function loadFieldNotes() {
    const feed = $("#fnFeed");
    const empty = $("#fnEmpty");
    if (!feed || !empty) return;

    try {
      setState('active');
      empty.textContent = "Loading…";

      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = await res.json();
      const all = Array.isArray(rows) ? rows : [];
      const posts = all.filter(isPublic);

      posts.sort((a, b) => {
        const da = new Date(a?.Published || a?.Date || a?.Created || 0).getTime();
        const db = new Date(b?.Published || b?.Date || b?.Created || 0).getTime();
        return db - da;
      });

      if (!posts.length) {
        feed.innerHTML = `<div class="fn-empty">No public notes yet.</div>`;
        setState('ready');
        return;
      }

      feed.innerHTML = posts.map(renderCard).join("");

      $$(".fn-card-btn", feed).forEach(btn => {
        btn.addEventListener("click", () => {
          openModal({
            title: btn.getAttribute("data-title") || "",
            type: btn.getAttribute("data-type") || "",
            date: btn.getAttribute("data-date") || "",
            excerpt: btn.getAttribute("data-excerpt") || "",
            url: btn.getAttribute("data-url") || ""
          });
        });
      });

      setState('ready');

    } catch (err) {
      console.error(err);
      feed.innerHTML = `<div class="fn-empty">Could not load Field Notes.</div>`;
      setState('ready');
    }
  }

  /* INIT */
  const init = () => {
    initTheme();
    initRouting();
    initBrandRefresh();
    initFNRefresh();
    initViewToggle();
    initPrelude();
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
