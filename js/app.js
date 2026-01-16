/* ==========================================================================
   Scott Lander v1.1.1 — app.js
   - Clean theme system (time-based default 9am–6pm local; manual override persists)
   - Prelude boot sequence (2–3s feel; runs once per tab/session)
   - Route handling (#field-notes as a “page”)
   - Field Notes feed (Notion via Splitbee API) + on-site modal (no Notion app hijack)
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const root = document.documentElement;

  /* ============================
     Theme + asset swapping
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
    } catch {
      // ignore
    }
  };

  // Local timezone default: light between 09:00–17:59, dark otherwise.
  const themeByLocalTime = () => {
    try {
      const hour = new Date().getHours(); // local tz
      const isDay = hour >= 9 && hour < 18;
      return isDay ? "light" : "dark";
    } catch {
      return prefersDark() ? "dark" : "light";
    }
  };

  const swapThemeAssets = (theme) => {
    // Swaps any img with data-src-light + data-src-dark
    $$("img[data-src-light][data-src-dark]").forEach((img) => {
      const next =
        theme === "dark"
          ? img.getAttribute("data-src-dark")
          : img.getAttribute("data-src-light");
      if (next) img.src = next;
    });

    // Field Notes mark is special: uses separate files
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
    swapThemeAssets(theme);
  };

  const initTheme = () => {
    const stored = readTheme();
    const initial = stored || themeByLocalTime();
    applyTheme(initial);

    // Optional: if no stored preference, follow OS changes BUT time remains primary.
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
     Route handling (#field-notes)
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
     Brand click = refresh
     ============================ */

  const initBrandRefresh = () => {
    const brand = $(".brand");
    if (!brand) return;

    brand.addEventListener("click", (e) => {
      // If we're already on this page, do a hard refresh.
      // If repo is in a subpath on GitHub Pages, "./" still resolves correctly.
      e.preventDefault();
      window.location.href = "./";
      // If you're already at "./", force reload:
      setTimeout(() => window.location.reload(), 0);
    });
  };

  /* ============================
     Prelude / Boot Sequence
     - Runs once per tab (sessionStorage)
     - Desired feel: ~2–3 seconds
     - Sequence:
       1) All off
       2) Amber pulses during load
       3) Green confirmation flash when ready
       4) All three flash together once
       5) Fade out → reveal page
     ============================ */

  const initPrelude = () => {
    const prelude = $("#prelude");
    if (!prelude) return;

    // Run once per tab/session
    try {
      if (sessionStorage.getItem("sb_booted") === "1") {
        prelude.remove();
        return;
      }
      sessionStorage.setItem("sb_booted", "1");
    } catch {
      // If blocked, still run
    }

    const setState = (state) => prelude.setAttribute("data-state", state);

    // Timing tuned for "2–3 full seconds"
    const T = {
      intro: 180,       // indicator presence
      loadingMin: 1700, // amber pulse dwell
      ready: 520,       // green confirm
      allflash: 380,    // all three flash
      reveal: 460,      // mark/wordmark focus
      exit: 520,        // fade out
      hardCap: 5200     // failsafe
    };

    prelude.setAttribute("aria-hidden", "false");

    // Start at "intro" (all off baseline)
    setState("intro");

    // Enter loading pulse quickly
    setTimeout(() => setState("loading"), T.intro);

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;

      // Ready → allflash → reveal → exit
      setState("ready");

      setTimeout(() => {
        setState("allflash");
        setTimeout(() => {
          setState("reveal");
          setTimeout(() => {
            setState("exit");
            setTimeout(() => {
              prelude.remove();
            }, T.exit + 40);
          }, T.reveal);
        }, T.allflash);
      }, T.ready);
    };

    // Guarantee minimum time on the prelude:
    const minGate = T.intro + T.loadingMin;

    // When the page is loaded:
    const onLoaded = () => {
      // Don’t finish before min gate; schedule finish at/after gate.
      // (If load happens after gate, this executes immediately.)
      const now = performance.now ? performance.now() : 0;
      // We can't perfectly align "start time" across all browsers in a trivial way,
      // but the minGate timeout below ensures the minimum dwell regardless.
      setTimeout(finish, 0);
    };

    // After min gate, if already loaded, finish; otherwise wait for load.
    setTimeout(() => {
      if (document.readyState === "complete") finish();
      else window.addEventListener("load", finish, { once: true });
    }, minGate);

    // Fail-safe hard cap
    setTimeout(finish, T.hardCap);
  };

  /* ============================
     Field Notes — Notion (Option A)
     - Uses splitbee's public notion API proxy:
       https://notion-api.splitbee.io
     - Filter to Public-only (your column "Public")
     - Modal opens on-site (prevents Notion app hijack)
     ============================ */

  // Your database/page id (from your shared link)
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
    if (v === undefined || v === null || v === "") return false; // enforce Public-only
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

    // could be string, array, or object depending on notion field type
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

  // Modular size pattern (3 sizes). This is intentionally deterministic.
  const pickSize = (i, hasMedia) => {
    const cycle = hasMedia ? ["l", "m", "m", "s", "m"] : ["m", "s", "m", "s", "m"];
    return cycle[i % cycle.length];
  };

  const getNotionUrl = (row) => {
    // splitbee often returns __url; keep robust.
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
      // Text card: "fills" like an image (type-centered, ends low)
      const quote = excerpt || title;

      return `
        <article class="card ${size} text" role="listitem">
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
      ? `<video class="card-media" src="${escapeHtml(media)}" muted playsinline preload="metadata"></video>`
      : `<img class="card-media" src="${escapeHtml(media)}" alt="" loading="lazy" />`;

    return `
      <article class="card ${size} media" role="listitem">
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

  const openModal = ({ title, type, date, excerpt, notionUrl }) => {
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

    original.href = notionUrl || "#";

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");

    const close = () => {
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
    };

    // One-time bindings per open
    const onBackdrop = (e) => {
      if (e.target === modal) close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };

    closeBtn.onclick = close;
    modal.onclick = onBackdrop;
    window.addEventListener("keydown", onKey, { once: true });
  };

  async function loadFieldNotes() {
    const feedEl = $("#fieldNotesFeed");
    const emptyEl = $("#fieldNotesEmpty");
    if (!feedEl || !emptyEl) return;

    try {
      emptyEl.textContent = "Loading Field Notes…";

      const res = await fetch(API(FIELDNOTES_TABLE_ID), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = await res.json();
      const allRows = Array.isArray(rows) ? rows : [];
      const posts = allRows.filter(isPublic);

      posts.sort((a, b) => {
        const da = new Date(a?.Published || a?.Date || a?.Created || 0).getTime();
        const db = new Date(b?.Published || b?.Date || b?.Created || 0).getTime();
        return db - da; // newest first
      });

      if (!posts.length) {
        feedEl.innerHTML = `
          <div class="field-notes-empty">
            No public notes yet. Toggle <b>Public</b> on in Notion to publish.
          </div>
        `;
        return;
      }

      // Render list
      feedEl.innerHTML = posts.map(renderCard).join("");

      // Bind modal opens (prevent Notion app hijack by not using <a href>)
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
    } catch (err) {
      console.error(err);
      $("#fieldNotesFeed").innerHTML = `
        <div class="field-notes-empty">
          Could not load Field Notes right now. (Check that your Notion view is public and the table id is correct.)
        </div>
      `;
    }
  }

  /* ============================
     Init (order matters)
     ============================ */

  const init = () => {
    initTheme();
    initRouting();
    initBrandRefresh();
    initPrelude();
    loadFieldNotes();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();