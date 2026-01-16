/* ==========================================================================
   Scott Bertrand — Lander v1.3.0
   Enhanced indicator system with true operational states
   Following brand guidelines: offline → active → ready
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const root = document.documentElement;
  const isMobile = () => window.innerWidth < 768;
  const prefersReducedMotion = () => 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================
     System State Management
     Single source of truth
     ============================ */

  let systemState = 'offline'; // 'offline' | 'active' | 'ready'

  const setState = (newState) => {
    systemState = newState;
    root.setAttribute('data-system-state', newState);
    
    // Update all indicator groups
    $$('.indicator-group').forEach(updateIndicators);
  };

  const updateIndicators = (group) => {
    const red = $('.dot.red', group);
    const amber = $('.dot.amber', group);
    const green = $('.dot.green', group);

    if (!red || !amber || !green) return;

    // Remove all state classes
    [red, amber, green].forEach(dot => {
      dot.classList.remove('state-off', 'state-dim', 'state-active', 'state-ready');
    });

    // Apply state classes
    switch(systemState) {
      case 'offline':
        red.classList.add('state-off');
        amber.classList.add('state-off');
        green.classList.add('state-off');
        break;
      case 'active':
        red.classList.add('state-dim');
        amber.classList.add('state-active');
        green.classList.add('state-dim');
        break;
      case 'ready':
        red.classList.add('state-dim');
        amber.classList.add('state-dim');
        green.classList.add('state-ready');
        break;
    }
  };

  /* ============================
     Theme Management
     ============================ */

  const THEME_KEY = "sb_theme";

  const prefersDark = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const readTheme = () => {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  };

  const writeTheme = (v) => {
    try {
      localStorage.setItem(THEME_KEY, v);
    } catch {}
  };

  const themeByLocalTime = () => {
    try {
      const hour = new Date().getHours();
      const isDay = hour >= 9 && hour < 18;
      return isDay ? "light" : "dark";
    } catch {
      return prefersDark() ? "dark" : "light";
    }
  };

  const swapThemeAssets = (theme) => {
    $$("img[data-src-light][data-src-dark]").forEach((img) => {
      const next =
        theme === "dark"
          ? img.getAttribute("data-src-dark")
          : img.getAttribute("data-src-light");
      if (next) img.src = next;
    });

    const fnMark = $(".field-notes-mark");
    if (fnMark) {
      fnMark.src =
        theme === "dark"
          ? "./assets/marks/field-notes-white.png"
          : "./assets/marks/field-notes.png";
    }
  };

  const applyTheme = (theme) => {
    root.setAttribute("data-theme", theme);
    root.classList.add('theme-transitioning');
    swapThemeAssets(theme);
    setTimeout(() => root.classList.remove('theme-transitioning'), 400);
  };

  const initTheme = () => {
    const stored = readTheme();
    const initial = stored || themeByLocalTime();
    applyTheme(initial);

    if (!stored && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme(themeByLocalTime());
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    const toggle = $("#themeToggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || themeByLocalTime();
        const next = current === "dark" ? "light" : "dark";
        writeTheme(next);
        applyTheme(next);
      });
    }
  };

  /* ============================
     Prelude / Boot Sequence
     Exact timing: 3200ms total
     Phase 1: 0-260ms (Presence)
     Phase 2: 260-2060ms (Active)
     Phase 3: 2060-2580ms (Ready)
     Phase 4: 2360-2880ms (Reveal, overlaps with Ready)
     Phase 5: 2880-3200ms (Exit)
     ============================ */

  const initPrelude = () => {
    const prelude = $("#prelude");
    if (!prelude) return;

    // Run once per session
    try {
      if (sessionStorage.getItem("sb_booted") === "1") {
        prelude.remove();
        setState('ready');
        return;
      }
      sessionStorage.setItem("sb_booted", "1");
    } catch {}

    const setPhase = (phase) => prelude.setAttribute("data-phase", phase);

    // Phase timing (ms)
    const T = {
      presenceStart: 0,
      presenceEnd: 260,
      activeStart: 260,
      activeEnd: 2060,
      readyStart: 2060,
      readyEnd: 2580,
      revealStart: 2360,
      revealEnd: 2880,
      exitStart: 2880,
      exitEnd: 3200,
      hardCap: 5200
    };

    prelude.setAttribute("aria-hidden", "false");

    let finished = false;

    const runSequence = () => {
      if (finished) return;
      finished = true;

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
            // Phase 4: Reveal (2360-2880ms, overlaps with ready)
            setPhase('reveal');

            setTimeout(() => {
              // Phase 5: Exit (2880-3200ms)
              setPhase('exit');

              setTimeout(() => {
                prelude.remove();
              }, T.exitEnd - T.exitStart + 50);

            }, T.exitStart - T.revealStart);
          }, T.revealStart - T.readyStart);
        }, T.readyStart - T.activeStart);
      }, T.activeStart - T.presenceStart);
    };

    // Ensure minimum dwell on prelude
    const minGate = T.activeEnd;

    setTimeout(() => {
      if (document.readyState === "complete") runSequence();
      else window.addEventListener("load", runSequence, { once: true });
    }, 0);

    // Failsafe
    setTimeout(runSequence, T.hardCap);
  };

  /* ============================
     Route Handling
     ============================ */

  const applyRoute = () => {
    const hash = (window.location.hash || "").toLowerCase();
    const isFieldNotes = hash === "#field-notes";
    document.body.classList.toggle("route-fieldnotes", isFieldNotes);
  };

  const initRouting = () => {
    window.addEventListener("hashchange", applyRoute);
    applyRoute();
  };

  /* ============================
     Brand Logo - Return to Hero
     ============================ */

  const initBrandRefresh = () => {
    const brand = $(".brand");
    if (!brand) return;

    brand.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "";
      window.scrollTo(0, 0);
    });
  };

  /* ============================
     Field Notes Logo - Refresh
     ============================ */

  const initFieldNotesRefresh = () => {
    const refreshBtn = $("#fieldNotesRefresh");
    if (!refreshBtn) return;

    refreshBtn.addEventListener("click", () => {
      const fieldNotes = $("#field-notes");
      if (fieldNotes) {
        fieldNotes.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      loadFieldNotes();
    });
  };

  /* ============================
     View Toggle (Grid/List)
     ============================ */

  const VIEW_KEY = "sb_view";

  const initViewToggle = () => {
    const toggle = $("#viewToggle");
    const feed = $("#fieldNotesFeed");
    if (!toggle || !feed) return;

    const iconGrid = $(".icon-grid", toggle);
    const iconList = $(".icon-list", toggle);
    const label = $(".chip-label", toggle);

    let currentView = "grid";
    try {
      currentView = localStorage.getItem(VIEW_KEY) || "grid";
    } catch {}

    const applyView = (view) => {
      currentView = view;
      
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

      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {}
    };

    applyView(currentView);

    toggle.addEventListener("click", () => {
      const nextView = currentView === "grid" ? "list" : "grid";
      applyView(nextView);
    });
  };

  /* ============================
     Scroll Animations
     ============================ */

  const initScrollAnimations = () => {
    if (prefersReducedMotion()) return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, observerOptions);

    $$('.scroll-fade').forEach(el => observer.observe(el));

    const cards = $$('.card');
    if (cards.length) {
      cards.forEach((card, i) => {
        card.style.transitionDelay = `${i * 50}ms`;
      });
    }
  };

  /* ============================
     Parallax (Desktop Only)
     ============================ */

  const initParallax = () => {
    if (isMobile() || prefersReducedMotion()) return;

    const parallaxElements = $$('[data-parallax]');
    if (!parallaxElements.length) return;

    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;

      parallaxElements.forEach(el => {
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.5;
        const yPos = -(scrolled * speed);
        el.style.transform = `translate3d(0, ${yPos}px, 0)`;
      });

      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });
  };

  /* ============================
     3D Card Tilt (Desktop Only)
     ============================ */

  const init3DCardTilt = () => {
    if (isMobile() || prefersReducedMotion()) return;

    const cards = $$('.card');

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  };

  /* ============================
     Field Notes - Notion API
     ============================ */

  const FIELDNOTES_TABLE_ID = "2ea3c4a766e480b7a46ed6bb8d6cde82";
  const API = (id) => `https://notion-api.splitbee.io/v1/table/${id}`;

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtDate = (v) => {
    if (!v) return "";
    try {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
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
    if (v === undefined || v === null || v === "") return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    const s = String(v).trim().toLowerCase();
    return (
      s === "true" ||
      s === "yes" ||
      s === "y" ||
      s === "1" ||
      s === "checked" ||
      s === "on" ||
      s === "✅" ||
      s === "✔" ||
      s === "✔︎"
    );
  };

  const mediaUrlFromRow = (row) => {
    const m = row?.Media;
    if (!m) return "";

    if (typeof m === "string") return m;

    if (Array.isArray(m) && m.length) {
      const first = m[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && first.url) return first.url;
    }

    if (typeof m === "object" && m.url) return m.url;

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

  const getNotionUrl = (row) => {
    return row?.__url || row?.URL || row?.Url || row?.Link || "";
  };

  const renderCard = (row, index) => {
    const title = row?.Title || row?.Name || "Field note";
    const type = row?.Type || "Note";
    const excerpt = row?.Excerpt || row?.Text || row?.Content || "";
    const published = row?.Published || row?.Date || row?.Created || "";

    const notionUrl = getNotionUrl(row);
    const media = mediaUrlFromRow(row);
    const hasMedia = Boolean(media);
    const size = pickSize(index, hasMedia);

    if (!hasMedia) {
      const quote = excerpt || title;

      return `
        <article class="card ${size} text scroll-fade" role="listitem">
          <button class="card-link"
            type="button"
            data-notion-url="${escapeHtml(notionUrl)}"
            data-title="${escapeHtml(title)}"
            data-type="${escapeHtml(type)}"
            data-date="${escapeHtml(published)}"
            data-excerpt="${escapeHtml(excerpt)}"
            aria-label="Open field note">
            <div class="label-tag">${escapeHtml(type)}</div>
            <div class="card-content">
              <div class="quote">${escapeHtml(quote)}</div>
              <div class="source">${escapeHtml(title)}</div>
            </div>
            <div class="meta-bar" aria-hidden="true">
              <span class="type">${escapeHtml(type)}</span>
              <span class="date">${escapeHtml(fmtDate(published))}</span>
            </div>
          </button>
        </article>
      `;
    }

    const mediaEl = isVideo(media)
      ? `<video class="card-media" src="${escapeHtml(media)}" muted playsinline preload="metadata" loading="lazy"></video>`
      : `<img class="card-media" src="${escapeHtml(media)}" alt="" loading="lazy" />`;

    return `
      <article class="card ${size} media scroll-fade" role="listitem">
        <button class="card-link"
          type="button"
          data-notion-url="${escapeHtml(notionUrl)}"
          data-title="${escapeHtml(title)}"
          data-type="${escapeHtml(type)}"
          data-date="${escapeHtml(published)}"
          data-excerpt="${escapeHtml(excerpt)}"
          aria-label="Open field note media">
          ${mediaEl}
          <div class="scrim" aria-hidden="true"></div>
          <div class="meta-bar" aria-hidden="true">
            <span class="type">${escapeHtml(type)}</span>
            <span class="date">${escapeHtml(fmtDate(published))}</span>
          </div>
        </button>
      </article>
    `;
  };

  /* ============================
     Modal Systems
     ============================ */

  const openModal = ({ title, type, date, excerpt, notionUrl }) => {
    const mobile = isMobile();

    if (mobile) {
      openBottomSheet({ title, type, date, excerpt, notionUrl });
    } else {
      openCenterModal({ title, type, date, excerpt, notionUrl });
    }
  };

  const openCenterModal = ({ title, type, date, excerpt, notionUrl }) => {
    const modal = $("#fieldNotesModal");
    const content = $("#fieldNotesModalContent");
    const closeBtn = $(".modal-close", modal);
    const original = $("#fieldNotesOriginal");

    if (!modal || !content || !closeBtn || !original) return;

    content.innerHTML = `
      <div class="fn-modal-kicker">${escapeHtml(type || "Field note")}</div>
      <h3 class="fn-modal-title">${escapeHtml(title || "Field note")}</h3>
      <div class="fn-modal-date">${escapeHtml(fmtDate(date))}</div>
      <div class="fn-modal-body">${escapeHtml(excerpt || "")}</div>
    `;

    if (notionUrl && notionUrl !== "#") {
      original.href = notionUrl;
      original.style.display = "inline-flex";
    } else {
      original.style.display = "none";
    }

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    const onBackdrop = (e) => {
      if (e.target.classList.contains('modal-backdrop')) close();
    };

    const onKey = (e) => {
      if (e.key === "Escape") close();
    };

    closeBtn.onclick = close;
    modal.onclick = onBackdrop;
    document.addEventListener("keydown", onKey, { once: true });
  };

  const openBottomSheet = ({ title, type, date, excerpt, notionUrl }) => {
    const sheet = $("#fieldNotesSheet");
    const content = $("#fieldNotesSheetContent");
    const closeBtn = $(".sheet-close", sheet);
    const original = $("#fieldNotesSheetOriginal");

    if (!sheet || !content || !closeBtn || !original) return;

    content.innerHTML = `
      <div class="fn-modal-kicker">${escapeHtml(type || "Field note")}</div>
      <h3 class="fn-modal-title">${escapeHtml(title || "Field note")}</h3>
      <div class="fn-modal-date">${escapeHtml(fmtDate(date))}</div>
      <div class="fn-modal-body">${escapeHtml(excerpt || "")}</div>
    `;

    if (notionUrl && notionUrl !== "#") {
      original.href = notionUrl;
      original.style.display = "inline-flex";
    } else {
      original.style.display = "none";
    }

    sheet.setAttribute("aria-hidden", "false");
    sheet.classList.add("is-open");
    document.body.style.overflow = 'hidden';

    const close = () => {
      sheet.setAttribute("aria-hidden", "true");
      sheet.classList.remove("is-open");
      document.body.style.overflow = '';
    };

    const onBackdrop = (e) => {
      if (e.target.classList.contains('sheet-backdrop')) close();
    };

    closeBtn.onclick = close;
    sheet.onclick = onBackdrop;
  };

  async function loadFieldNotes() {
    const feedEl = $("#fieldNotesFeed");
    const emptyEl = $("#fieldNotesEmpty");
    if (!feedEl || !emptyEl) return;

    try {
      // Show loading state
      setState('active');
      emptyEl.textContent = "Loading Field Notes…";

      const res = await fetch(API(FIELDNOTES_TABLE_ID), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = await res.json();
      const allRows = Array.isArray(rows) ? rows : [];
      const posts = allRows.filter(isPublic);

      posts.sort((a, b) => {
        const da = new Date(a?.Published || a?.Date || a?.Created || 0).getTime();
        const db = new Date(b?.Published || b?.Date || b?.Created || 0).getTime();
        return db - da;
      });

      if (!posts.length) {
        feedEl.innerHTML = `
          <div class="field-notes-empty">
            No public notes yet. Toggle <b>Public</b> on in Notion to publish.
          </div>
        `;
        setState('ready');
        return;
      }

      feedEl.innerHTML = posts.map(renderCard).join("");

      $$(".card-link", feedEl).forEach((btn) => {
        btn.addEventListener("click", () => {
          const title = btn.getAttribute("data-title") || "";
          const type = btn.getAttribute("data-type") || "";
          const date = btn.getAttribute("data-date") || "";
          const excerpt = btn.getAttribute("data-excerpt") || "";
          const notionUrl = btn.getAttribute("data-notion-url") || "";
          openModal({ title, type, date, excerpt, notionUrl });
        });
      });

      // Ready state after load
      setState('ready');

      initScrollAnimations();
      setTimeout(init3DCardTilt, 100);

    } catch (err) {
      console.error(err);
      feedEl.innerHTML = `
        <div class="field-notes-empty">
          Could not load Field Notes right now.
        </div>
      `;
      setState('ready');
    }
  }

  /* ============================
     Init
     ============================ */

  const init = () => {
    initTheme();
    initRouting();
    initBrandRefresh();
    initFieldNotesRefresh();
    initViewToggle();
    initPrelude();
    initScrollAnimations();
    initParallax();
    
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
