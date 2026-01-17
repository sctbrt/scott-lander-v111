(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const isMobile = () => window.innerWidth < 768;

  let systemState = 'ready';
  let cachedNotes = null;
  let filteredNotes = [];
  let displayedCount = 12;
  const ITEMS_PER_PAGE = 12;

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
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
  };

  const saveTheme = (t) => {
    try { localStorage.setItem(THEME_KEY, t); } catch {}
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

    $$(".theme-icon, .mobile-theme-icon").forEach(icon => {
      icon.textContent = theme === "dark" ? "🌙" : "☀️";
    });
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    swapAssets(theme);
  };

  const initTheme = () => {
    const stored = getTheme();
    const initial = stored || getTimeTheme();
    applyTheme(initial);

    const toggleTheme = () => {
      const current = root.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      saveTheme(next);
      applyTheme(next);
    };

    const desktopToggle = $("#themeToggle");
    const mobileToggle = $("#mobileThemeToggle");
    
    if (desktopToggle) desktopToggle.addEventListener("click", toggleTheme);
    if (mobileToggle) mobileToggle.addEventListener("click", toggleTheme);
  };

  /* MOBILE MENU */
  const initMobileMenu = () => {
    const menuBtn = $("#mobileMenuBtn");
    const menu = $("#mobileMenu");
    const closeBtn = $("#mobileMenuClose");
    const backdrop = $(".mobile-menu-backdrop", menu);

    if (!menuBtn || !menu) return;

    const openMenu = () => {
      menu.setAttribute("aria-hidden", "false");
      menu.classList.add("is-open");
      document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
      menu.setAttribute("aria-hidden", "true");
      menu.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    menuBtn.addEventListener("click", openMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);
    if (backdrop) backdrop.addEventListener("click", closeMenu);

    $$(".mobile-nav-link", menu).forEach(link => {
      link.addEventListener("click", closeMenu);
    });
  };

  /* MORPHING HEADER */
  const initMorphHeader = () => {
    const header = $("#morphHeader");
    if (!header) return;

    let ticking = false;

    const updateHeader = () => {
      const scroll = window.pageYOffset || document.documentElement.scrollTop;
      const threshold = 100;
      const progress = Math.min(scroll / threshold, 1);

      if (progress > 0.01) {
        header.classList.add('morphed');
        document.body.classList.add('header-morphed');
        header.style.setProperty('--morph-progress', progress);
      } else {
        header.classList.remove('morphed');
        document.body.classList.remove('header-morphed');
        header.style.setProperty('--morph-progress', 0);
      }

      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });

    // Set initial state
    updateHeader();

    const grilleBtn = $("#grilleBtn");
    if (grilleBtn) {
      grilleBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  /* ROUTING */
  const navigate = (route) => {
    const main = $("#mainSite");
    const fn = $("#fieldNotes");
    const about = $("#aboutSection");
    const philosophy = $("#philosophySection");

    if (route === "field-notes") {
      if (main) main.hidden = true;
      if (fn) fn.hidden = false;
      window.scrollTo(0, 0);
    } else if (route === "about") {
      if (main) main.hidden = false;
      if (fn) fn.hidden = true;
      if (about) {
        about.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (route === "philosophy") {
      if (main) main.hidden = false;
      if (fn) fn.hidden = true;
      if (philosophy) {
        philosophy.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      if (main) main.hidden = false;
      if (fn) fn.hidden = true;
      window.scrollTo(0, 0);
    }
  };

  const initRouting = () => {
    $$('[data-route]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const route = btn.getAttribute('data-route');
        navigate(route);
      });
    });
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

  /* FIELD NOTES API */
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
    return u.endsWith(".mp4") || u.endsWith(".mov") || u.endsWith(".webm") || u.endsWith(".avi");
  };

  const pickSize = (i, hasMedia) => {
    const cycle = hasMedia ? ["l", "m", "m", "s", "m"] : ["m", "s", "m", "s", "m"];
    return cycle[i % cycle.length];
  };

  const getUrl = (r) => r?.__url || r?.URL || r?.Url || r?.Link || "";

  const renderCard = (row, idx, isPreview = false) => {
    const title = row?.Title || row?.Name || "Field note";
    const type = row?.Type || "Note";
    const excerpt = row?.Excerpt || row?.Text || row?.Content || "";
    const date = row?.Published || row?.Date || row?.Created || "";
    const url = getUrl(row);
    const media = getMedia(row);
    const hasMedia = Boolean(media);
    const size = isPreview ? "l" : pickSize(idx, hasMedia);

    if (!hasMedia) {
      const quote = excerpt || title;
      return `
        <article class="fn-card ${size} text">
          <button class="fn-card-btn"
            data-type="text"
            data-url="${esc(url)}"
            data-title="${esc(title)}"
            data-card-type="${esc(type)}"
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
      ? `<video class="fn-media" src="${esc(media)}" muted playsinline preload="metadata" aria-label="${esc(title)}"></video>`
      : `<img class="fn-media" src="${esc(media)}" alt="${esc(title)}" loading="lazy" />`;

    return `
      <article class="fn-card ${size} media">
        <button class="fn-card-btn"
          data-type="media"
          data-media="${esc(media)}"
          data-is-video="${isVideo(media)}"
          data-title="${esc(title)}"
          data-card-type="${esc(type)}"
          data-date="${esc(date)}">
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

  /* FILTERS */
  const applyFilters = () => {
    if (!cachedNotes) return;

    const typeFilter = $("#typeFilter")?.value || "all";
    const dateFilter = $("#dateFilter")?.value || "all";

    let filtered = [...cachedNotes];

    if (typeFilter !== "all") {
      filtered = filtered.filter(n => (n?.Type || "Note") === typeFilter);
    }

    if (dateFilter !== "all") {
      const now = Date.now();
      const cutoffs = {
        month: 30 * 24 * 60 * 60 * 1000,
        quarter: 90 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      const cutoff = cutoffs[dateFilter];
      if (cutoff) {
        filtered = filtered.filter(n => {
          const date = new Date(n?.Published || n?.Date || n?.Created || 0);
          return (now - date.getTime()) <= cutoff;
        });
      }
    }

    filteredNotes = filtered;
    displayedCount = ITEMS_PER_PAGE;
    renderFeed();
  };

  const initFilters = () => {
    const typeFilter = $("#typeFilter");
    const dateFilter = $("#dateFilter");

    if (typeFilter) typeFilter.addEventListener("change", applyFilters);
    if (dateFilter) dateFilter.addEventListener("change", applyFilters);
  };

  const populateTypeFilter = () => {
    if (!cachedNotes) return;
    
    const types = new Set(cachedNotes.map(n => n?.Type || "Note"));
    const typeFilter = $("#typeFilter");
    
    if (typeFilter) {
      types.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        typeFilter.appendChild(opt);
      });
    }
  };

  /* MODALS */
  const openTextModal = ({ title, type, date, excerpt, url }) => {
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

    const handleKey = (e) => {
      if (e.key === "Escape") closeModal();
    };

    const closeModal = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.style.overflow = '';
      document.removeEventListener("keydown", handleKey);
    };

    close.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    };

    document.addEventListener("keydown", handleKey);

    close.focus();
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

    const handleKey = (e) => {
      if (e.key === "Escape") closeSheet();
    };

    const closeSheet = () => {
      sheet.setAttribute("aria-hidden", "true");
      sheet.classList.remove("is-open");
      document.body.style.overflow = '';
      document.removeEventListener("keydown", handleKey);
    };

    close.onclick = closeSheet;
    sheet.onclick = (e) => {
      if (e.target.classList.contains('sheet-backdrop')) closeSheet();
    };

    document.addEventListener("keydown", handleKey);

    close.focus();
  };

  /* MEDIA LIGHTBOX */
  const openLightbox = ({ media, isVideo, title }) => {
    const lightbox = $("#lightbox");
    const content = $("#lightboxContent");
    const close = $(".lightbox-close", lightbox);
    const backdrop = $(".lightbox-backdrop", lightbox);

    if (!lightbox || !content || !close) return;

    if (isVideo === "true" || isVideo === true) {
      content.innerHTML = `<video src="${esc(media)}" controls playsinline autoplay class="lightbox-media" aria-label="${esc(title)}"></video>`;
    } else {
      content.innerHTML = `<img src="${esc(media)}" alt="${esc(title)}" class="lightbox-media" />`;
    }

    lightbox.setAttribute("aria-hidden", "false");
    lightbox.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const handleKey = (e) => {
      if (e.key === "Escape") closeLightbox();
    };

    const closeLightbox = () => {
      lightbox.setAttribute("aria-hidden", "true");
      lightbox.classList.remove("is-open");
      document.body.style.overflow = '';
      content.innerHTML = '';
      document.removeEventListener("keydown", handleKey);
    };

    close.onclick = closeLightbox;
    backdrop.onclick = closeLightbox;

    document.addEventListener("keydown", handleKey);

    close.focus();
  };

  /* LOAD FIELD NOTES */
  async function fetchFieldNotes() {
    if (cachedNotes) return cachedNotes;

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

      cachedNotes = posts;
      filteredNotes = posts;
      setState('ready');
      return posts;

    } catch (err) {
      console.error("Field Notes fetch error:", err);
      setState('ready');
      return [];
    }
  }

  async function loadLatestNote() {
    const container = $("#latestNoteCard");
    if (!container) return;

    try {
      const notes = await fetchFieldNotes();
      
      if (!notes.length) {
        container.innerHTML = `<div class="error-state">No notes published yet.</div>`;
        return;
      }

      const latest = notes[0];
      container.innerHTML = renderCard(latest, 0, true);
      attachCardListeners(container);

    } catch (err) {
      console.error("Latest note error:", err);
      container.innerHTML = `<div class="error-state">Could not load latest note.</div>`;
    }
  }

  function renderFeed() {
    const feed = $("#fnFeed");
    if (!feed) return;

    const toShow = filteredNotes.slice(0, displayedCount);
    
    if (!toShow.length) {
      feed.innerHTML = `<div class="fn-empty">No notes match your filters.</div>`;
      updateLoadMore();
      return;
    }

    feed.innerHTML = toShow.map(renderCard).join("");
    attachCardListeners(feed);
    updateLoadMore();
  }

  function updateLoadMore() {
    const container = $("#loadMoreContainer");
    const btn = $("#loadMoreBtn");
    const shown = $("#itemsShown");

    if (!container) return;

    const hasMore = displayedCount < filteredNotes.length;
    
    if (hasMore) {
      container.hidden = false;
      if (shown) {
        shown.textContent = `Showing ${displayedCount} of ${filteredNotes.length}`;
      }
    } else {
      container.hidden = true;
    }
  }

  function initLoadMore() {
    const btn = $("#loadMoreBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      displayedCount += ITEMS_PER_PAGE;
      renderFeed();
    });
  }

  async function loadFieldNotes() {
    const feed = $("#fnFeed");
    if (!feed) return;

    try {
      feed.setAttribute('aria-busy', 'true');
      await fetchFieldNotes();
      
      populateTypeFilter();
      applyFilters();
      
      feed.setAttribute('aria-busy', 'false');

    } catch (err) {
      console.error("Field Notes error:", err);
      feed.innerHTML = `<div class="fn-empty error-state">Could not load Field Notes.</div>`;
      feed.setAttribute('aria-busy', 'false');
    }
  }

  function attachCardListeners(container) {
    $$(".fn-card-btn", container).forEach(btn => {
      btn.addEventListener("click", () => {
        const cardType = btn.getAttribute("data-type");
        
        if (cardType === "media") {
          openLightbox({
            media: btn.getAttribute("data-media"),
            isVideo: btn.getAttribute("data-is-video"),
            title: btn.getAttribute("data-title")
          });
        } else {
          openTextModal({
            title: btn.getAttribute("data-title") || "",
            type: btn.getAttribute("data-card-type") || "",
            date: btn.getAttribute("data-date") || "",
            excerpt: btn.getAttribute("data-excerpt") || "",
            url: btn.getAttribute("data-url") || ""
          });
        }
      });
    });
  }

  /* SCROLL TRANSFORMATIONS */
  const initScrollTransforms = () => {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          entry.target.classList.remove('in-view');
        }
      });
    }, {
      threshold: 0.3,
      rootMargin: '-10% 0px -10% 0px'
    });

    const about = $('#aboutSection');
    const philosophy = $('#philosophySection');

    if (about) observer.observe(about);
    if (philosophy) observer.observe(philosophy);
  };

  /* PRELUDE / BOOT SEQUENCE */
  const initPrelude = () => {
    const PRELUDE_KEY = "sb_prelude_shown";
    const prelude = $("#preludeOverlay");
    if (!prelude) return;

    // Check if prelude has been shown this session
    try {
      const shown = sessionStorage.getItem(PRELUDE_KEY);
      if (shown === "true") {
        prelude.classList.add("exited");
        return;
      }
    } catch {}

    const indicators = $$(".pill", prelude);

    // Phase 1: Presence (indicators appear) - 0-600ms
    // Already handled by CSS fadeIn animation

    // Phase 2: Active (amber pulses) - 800ms-2000ms
    setTimeout(() => {
      if (indicators[1]) {
        indicators[1].style.animation = "amberPulse 1200ms linear 1";
      }
    }, 800);

    // Phase 3: Ready (green blooms) - 2000ms-2600ms
    setTimeout(() => {
      if (indicators[2]) {
        indicators[2].style.animation = "greenBloom 800ms linear 1";
      }
    }, 2000);

    // Phase 4: Mark & wordmark reveal - 1400ms-2800ms
    // Handled by CSS animations

    // Phase 5: Exit - 2800ms-3600ms
    setTimeout(() => {
      prelude.classList.add("hidden");

      setTimeout(() => {
        prelude.classList.add("exited");
        try {
          sessionStorage.setItem(PRELUDE_KEY, "true");
        } catch {}
      }, 800);
    }, 2800);
  };

  /* INIT */
  const init = () => {
    initTheme();
    initPrelude();
    initMobileMenu();
    initMorphHeader();
    initScrollTransforms();
    initRouting();
    initViewToggle();
    initFilters();
    initLoadMore();
    setState('ready');
    loadLatestNote();
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
