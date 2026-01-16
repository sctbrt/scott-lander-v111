(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const isMobile = () => window.innerWidth < 768;

  let systemState = 'ready';

  const setState = (state) => {
    systemState = state;
    root.setAttribute('data-state', state);
    updateIndicators();
  };

  const updateIndicators = () => {
    $$('.pill').forEach(p => {
      p.className = p.className.replace(/ state-\w+/g, '');
    });

    const pills = {
      red: $$('.pill.red'),
      amber: $$('.pill.amber'),
      green: $$('.pill.green')
    };

    if (systemState === 'active') {
      pills.red.forEach(p => p.classList.add('state-dim'));
      pills.amber.forEach(p => p.classList.add('state-active'));
      pills.green.forEach(p => p.classList.add('state-dim'));
    } else if (systemState === 'ready') {
      pills.red.forEach(p => p.classList.add('state-dim'));
      pills.amber.forEach(p => p.classList.add('state-dim'));
      pills.green.forEach(p => p.classList.add('state-ready'));
    } else {
      pills.red.forEach(p => p.classList.add('state-off'));
      pills.amber.forEach(p => p.classList.add('state-off'));
      pills.green.forEach(p => p.classList.add('state-off'));
    }
  };

  /* THEME */
  const THEME_KEY = "sb_theme";

  const getTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };

  const saveTheme = (t) => {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
  };

  const getTimeTheme = () => {
    try {
      const h = new Date().getHours();
      return (h >= 9 && h < 18) ? "light" : "dark";
    } catch {
      return "light";
    }
  };

  const swapAssets = (theme) => {
    $$("img[data-src-light][data-src-dark]").forEach(img => {
      img.src = theme === "dark" 
        ? img.getAttribute("data-src-dark") 
        : img.getAttribute("data-src-light");
    });

    const fnMark = $(".fn-mark");
    if (fnMark) {
      fnMark.src = theme === "dark" 
        ? "./assets/marks/field-notes-white.png" 
        : "./assets/marks/field-notes.png";
    }
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    swapAssets(theme);
  };

  const initTheme = () => {
    const stored = getTheme();
    const initial = stored || getTimeTheme();
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

  /* MORPHING HEADER */
  const initMorphHeader = () => {
    const header = $("#morphHeader");
    if (!header) return;

    let ticking = false;
    let lastScroll = 0;

    const updateHeader = () => {
      const scroll = window.pageYOffset || document.documentElement.scrollTop;
      const threshold = 100;
      const progress = Math.min(scroll / threshold, 1);

      if (progress > 0.01) {
        header.classList.add('morphed');
        header.style.setProperty('--morph-progress', progress);
      } else {
        header.classList.remove('morphed');
        header.style.setProperty('--morph-progress', 0);
      }

      lastScroll = scroll;
      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });

    const grilleBtn = $("#grilleBtn");
    if (grilleBtn) {
      grilleBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };
  const applyRoute = () => {
    const hash = window.location.hash.toLowerCase();
    const showFN = hash === "#field-notes";
    
    const main = $("#mainSite");
    const fn = $("#fieldNotes");
    
    if (showFN) {
      if (main) main.hidden = true;
      if (fn) fn.hidden = false;
    } else {
      if (main) main.hidden = false;
      if (fn) fn.hidden = true;
    }
  };

  const initRouting = () => {
    window.addEventListener("hashchange", applyRoute);
    applyRoute();

    const fnHome = $("#fnHome");
    if (fnHome) {
      fnHome.addEventListener("click", () => {
        window.location.hash = "";
      });
    }

    const fnClose = $("#fnClose");
    if (fnClose) {
      fnClose.addEventListener("click", () => {
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
    try {
      view = localStorage.getItem(VIEW_KEY) || "grid";
    } catch {}

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
      try {
        localStorage.setItem(VIEW_KEY, v);
      } catch {}
    };

    apply(view);
    toggle.addEventListener("click", () => apply(view === "grid" ? "list" : "grid"));
  };

  /* FIELD NOTES */
  const API_ID = "2ea3c4a766e480b7a46ed6bb8d6cde82";
  const API_URL = `https://notion-api.splitbee.io/v1/table/${API_ID}`;

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const fmtDate = (v) => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (isNaN(d)) return String(v);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
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

    modal.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const closeModal = () => {
      modal.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    close.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    };
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    }, { once: true });
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

    sheet.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const closeSheet = () => {
      sheet.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    close.onclick = closeSheet;
    sheet.onclick = (e) => {
      if (e.target.classList.contains('sheet-backdrop')) closeSheet();
    };
  };

  async function loadFieldNotes() {
    const feed = $("#fnFeed");
    if (!feed) return;

    try {
      setState('active');

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
    initMorphHeader();
    initRouting();
    initViewToggle();
    setState('ready');
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
