(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const isMobile = () => window.innerWidth < 768;

  let cachedNotes = null;
  let filteredNotes = [];
  let displayedCount = 12;
  const ITEMS_PER_PAGE = 12;

  /* THEME */
  const initTheme = () => {
    const toggle = $("#themeToggle") || $("#mobileThemeToggle");
    const savedTheme = localStorage.getItem("sb_theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");

    root.setAttribute("data-theme", theme);

    const updateThemeImages = () => {
      $$("[data-src-light]").forEach(img => {
        const src = theme === "light" ? img.getAttribute("data-src-light") : img.getAttribute("data-src-dark");
        if (src) img.src = src;
      });
    };

    updateThemeImages();

    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        localStorage.setItem("sb_theme", next);
        updateThemeImages();
      });
    }
  };

  /* UTILS */
  const esc = (str) => {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  };

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    return isNaN(dt) ? "" : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const getMedia = (r) => {
    const m = r?.Media || r?.Image || r?.Photo || r?.Video;
    if (typeof m === "string") return m;
    if (Array.isArray(m) && m[0]?.url) return m[0].url;
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
    const title = row?.Title || row?.Name || row?.Excerpt || "Field note";
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

  /* VIEW TOGGLE */
  const VIEW_KEY = "sb_view";

  const initViewToggle = () => {
    const toggle = $("#viewToggle");
    const feed = $("#fnFeed");
    if (!toggle || !feed) return;

    const iconGrid = $(".icon-grid", toggle);
    const iconList = $(".icon-list", toggle);
    const label = $(".fn-label", toggle);
    const savedView = localStorage.getItem(VIEW_KEY) || "grid";

    const setView = (view) => {
      if (view === "list") {
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
      localStorage.setItem(VIEW_KEY, view);
    };

    setView(savedView);

    toggle.addEventListener("click", () => {
      const currentView = feed.classList.contains("list-view") ? "list" : "grid";
      const nextView = currentView === "grid" ? "list" : "grid";
      setView(nextView);
    });
  };

  /* LOAD MORE */
  const initLoadMore = () => {
    const btn = $("#loadMoreBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      displayedCount += ITEMS_PER_PAGE;
      renderFeed();
    });
  };

  /* MODALS */
  const openCenterModal = ({ title, type, date, excerpt, url }) => {
    const modal = $("#modal");
    const body = $("#modalBody");
    const close = $(".modal-close", modal);
    const link = $("#modalLink");

    if (!modal || !body || !close || !link) return;

    body.innerHTML = `
      <div class="modal-meta">
        <span>${esc(type)}</span>
        <span>${esc(fmtDate(date))}</span>
      </div>
      <h3 class="modal-title">${esc(title)}</h3>
      <div class="modal-text">${esc(excerpt)}</div>
    `;

    if (url) {
      link.href = url;
      link.style.display = "inline-block";
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

    if (!sheet || !body || !close || !link) return;

    body.innerHTML = `
      <div class="sheet-meta">
        <span>${esc(type)}</span>
        <span>${esc(fmtDate(date))}</span>
      </div>
      <h3 class="sheet-title">${esc(title)}</h3>
      <div class="sheet-text">${esc(excerpt)}</div>
    `;

    if (url) {
      link.href = url;
      link.style.display = "inline-block";
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

    if (isVideo) {
      content.innerHTML = `<video src="${esc(media)}" controls playsinline class="lightbox-media" aria-label="${esc(title)}"></video>`;
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
      const API_ID = "2ea3c4a766e480b7a46ed6bb8d6cde82";
      const API_URL = `https://notion-api.splitbee.io/v1/table/${API_ID}`;

      const resp = await fetch(API_URL, { cache: "no-store" });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const rows = await resp.json();
      const all = Array.isArray(rows) ? rows : [];
      const published = all.filter(r => r?.Public === true);

      cachedNotes = published;
      return cachedNotes;
    } catch (err) {
      console.error("Error fetching Field Notes:", err);
      return [];
    }
  }

  function renderFeed() {
    const feed = $("#fnFeed");
    const loadMoreContainer = $("#loadMoreContainer");
    const itemsShown = $("#itemsShown");

    if (!feed) return;

    const toDisplay = filteredNotes.slice(0, displayedCount);

    if (toDisplay.length === 0) {
      feed.innerHTML = `<div class="fn-empty">No Field Notes match the selected filters.</div>`;
      if (loadMoreContainer) loadMoreContainer.hidden = true;
      return;
    }

    feed.innerHTML = toDisplay.map((note, i) => renderCard(note, i)).join("");

    if (loadMoreContainer) {
      const hasMore = toDisplay.length < filteredNotes.length;
      loadMoreContainer.hidden = !hasMore;

      if (hasMore && itemsShown) {
        itemsShown.textContent = `Showing ${toDisplay.length} of ${filteredNotes.length}`;
      }
    }

    attachCardHandlers();
  }

  function attachCardHandlers() {
    $$(".fn-card-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const dataType = btn.getAttribute("data-type");

        if (dataType === "media") {
          const media = btn.getAttribute("data-media") || "";
          const isVideoFlag = btn.getAttribute("data-is-video") === "true";
          const title = btn.getAttribute("data-title") || "";
          openLightbox({ media, isVideo: isVideoFlag, title });
        } else {
          const handler = isMobile() ? openSheet : openCenterModal;
          handler({
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

  async function loadFieldNotes() {
    const notes = await fetchFieldNotes();

    if (!notes || notes.length === 0) {
      const feed = $("#fnFeed");
      if (feed) feed.innerHTML = `<div class="fn-empty">No Field Notes available.</div>`;
      return;
    }

    const types = new Set();
    notes.forEach(n => {
      const type = n?.Type || "Note";
      types.add(type);
    });

    const typeFilter = $("#typeFilter");
    if (typeFilter) {
      const opts = Array.from(types).sort();
      opts.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeFilter.appendChild(opt);
      });
    }

    filteredNotes = notes;
    renderFeed();
  }

  /* LOGO NAVIGATION */
  const initLogoNav = () => {
    const logoBtn = $("#fnLogoBtn");
    if (logoBtn) {
      logoBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  /* INIT */
  const init = () => {
    initTheme();
    initLogoNav();
    initViewToggle();
    initFilters();
    initLoadMore();
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
