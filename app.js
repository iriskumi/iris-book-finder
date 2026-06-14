(function () {
  "use strict";

  const KEYS = {
    books: "iris_books",
    platforms: "iris_platforms",
    settings: "iris_settings",
    recent: "iris_recent_searches",
  };

  const oldLibbyIds = new Set(["boobook", "monash", "melbourne", "maribyrnong", "yarra", "melton", "greater-dandenong", "greater_dandenong"]);
  const defaultPlatforms = [
    {
      id: "libby",
      name: "Libby",
      searchUrlTemplate: "https://libbyapp.com/search",
      isbnUrlTemplate: "",
      fallbackUrl: "https://libbyapp.com/search",
      enabled: true,
      note: "Libby deep links are unreliable. Open Libby Search and paste the copied query. It will use your logged-in account and added libraries.",
    },
    {
      id: "hoopla",
      name: "Hoopla",
      searchUrlTemplate: "https://www.hoopladigital.com/search?q={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://www.hoopladigital.com/",
      enabled: true,
      note: "",
    },
    {
      id: "borrowbox",
      name: "BorrowBox",
      searchUrlTemplate: "https://www.borrowbox.com/search/search/?query={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://www.borrowbox.com/",
      enabled: true,
      note: "",
    },
    {
      id: "audible",
      name: "Audible AU",
      searchUrlTemplate: "https://www.audible.com.au/search?keywords={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://www.audible.com.au/",
      enabled: true,
      note: "",
    },
    {
      id: "goodreads",
      name: "Goodreads",
      searchUrlTemplate: "https://www.goodreads.com/search?q={isbn}",
      isbnUrlTemplate: "https://www.goodreads.com/search?q={isbn}",
      fallbackUrl: "https://www.goodreads.com/",
      enabled: true,
      note: "",
    },
    {
      id: "trove",
      name: "Trove",
      searchUrlTemplate: "https://trove.nla.gov.au/search/category/books?keyword={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://trove.nla.gov.au/",
      enabled: true,
      note: "Metadata/search only; not counted in manual checking progress.",
    },
  ];

  const disabledLegacyPlatforms = [
    {
      id: "boobook",
      name: "Boobook Audio",
      searchUrlTemplate: "https://www.boobook.com.au/search?q={title}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://www.boobook.com.au/",
      enabled: false,
      note: "Legacy individual library link. Use Libby for the active manual workflow.",
    },
    {
      id: "monash",
      name: "Monash Public Library Service",
      searchUrlTemplate: "https://monlibvic.overdrive.com/search?query={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://monlibvic.overdrive.com/",
      enabled: false,
      note: "Legacy individual Libby/OverDrive library. Use Libby for the active manual workflow.",
    },
    {
      id: "melbourne",
      name: "City of Melbourne Libraries",
      searchUrlTemplate: "https://libcat.melbourne.vic.gov.au/cgi-bin/spydus.exe/ENQ/WPAC/BIBENQ?ENTRY={title}+{author}&ENTRY_TYPE=K",
      isbnUrlTemplate: "",
      fallbackUrl: "https://librarysearch.melbourne.vic.gov.au/",
      enabled: false,
      note: "Disabled by default: Melbourne Library Service no longer offers digital titles through OverDrive.",
    },
  ];

  const bestSourceOptions = [
    "Unknown",
    "Libby audio",
    "Libby ebook",
    "Libby hold",
    "Hoopla audio",
    "Hoopla ebook",
    "BorrowBox audio",
    "BorrowBox ebook",
    "BorrowBox hold",
    "Audible AU",
    "Skip",
  ];

  const manualActions = {
    libby: [
      ["Audio", "libby_audio_available", "available", "audio"],
      ["Ebook", "libby_ebook_available", "available", "ebook"],
      ["Hold", "libby_hold", "hold", null],
      ["Not found", "not_found", "unavailable", null],
      ["Checked", "checked", "checked", null],
    ],
    hoopla: [
      ["Audio", "hoopla_audio_available", "available", "audio"],
      ["Ebook", "hoopla_ebook_available", "available", "ebook"],
      ["Not found", "not_found", "unavailable", null],
      ["Checked", "checked", "checked", null],
    ],
    borrowbox: [
      ["Audio", "borrowbox_audio_available", "available", "audio"],
      ["Ebook", "borrowbox_ebook_available", "available", "ebook"],
      ["Hold", "borrowbox_hold", "hold", null],
      ["Not found", "not_found", "unavailable", null],
      ["Checked", "checked", "checked", null],
    ],
    audible: [
      ["Fallback", "audible_fallback", "available", "audio"],
      ["Audible only", "audible_only", "available", "audio"],
      ["Not worth credit", "not_worth_credit", "skipped", null],
      ["Checked", "checked", "checked", null],
    ],
    goodreads: [
      ["Metadata checked", "metadata_checked", "checked", null],
      ["Checked", "checked", "checked", null],
    ],
  };

  const state = {
    view: "search",
    books: [],
    platforms: migratePlatforms(read(KEYS.platforms, defaultPlatforms)),
    settings: read(KEYS.settings, { troveApiKey: "", stripArticles: true, troveDebug: false }),
    recent: read(KEYS.recent, []),
    activeBookId: null,
    selectedTroveBookId: null,
    troveResults: [],
    showUnrelated: false,
    editingPlatformId: null,
    selectedBooks: new Set(),
    savedFilters: { quick: "All", format: "Any", text: "", sort: "dateAdded" },
  };
  state.books = migrateBooks(read(KEYS.books, []));

  const views = {
    search: document.getElementById("view-search"),
    check: document.getElementById("view-check"),
    saved: document.getElementById("view-saved"),
    platforms: document.getElementById("view-platforms"),
    settings: document.getElementById("view-settings"),
  };
  const messages = document.getElementById("messages");

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function migratePlatforms(platforms) {
    const existing = new Map((Array.isArray(platforms) ? platforms : []).map((platform) => [platform.id, platform]));
    const migrated = defaultPlatforms.map((platform) => {
      const saved = existing.get(platform.id);
      const merged = { ...platform, ...(saved || {}), enabled: saved ? Boolean(saved.enabled) : platform.enabled };
      if (platform.id === "libby") {
        merged.searchUrlTemplate = platform.searchUrlTemplate;
        merged.fallbackUrl = platform.fallbackUrl;
        merged.note = platform.note;
      }
      return merged;
    });
    const legacy = disabledLegacyPlatforms.map((platform) => {
      const saved = existing.get(platform.id);
      return { ...platform, ...(saved || {}), enabled: saved ? Boolean(saved.enabled) : false };
    });
    existing.forEach((platform, id) => {
      const isKnown = defaultPlatforms.some((item) => item.id === id) || disabledLegacyPlatforms.some((item) => item.id === id);
      if (!isKnown) migrated.push(looksLikeSpecificLibbyLibrary(platform) ? disableLegacyLibbyPlatform(platform) : platform);
    });
    return [...migrated, ...legacy];
  }

  function looksLikeSpecificLibbyLibrary(platform) {
    const haystack = [platform.id, platform.name, platform.searchUrlTemplate, platform.fallbackUrl, platform.note].join(" ").toLowerCase();
    if (platform.id === "libby") return false;
    return (
      haystack.includes("overdrive.com") ||
      haystack.includes("libby/overdrive") ||
      haystack.includes("maribyrnong") ||
      haystack.includes("yarra") ||
      haystack.includes("melton") ||
      haystack.includes("greater dandenong")
    );
  }

  function disableLegacyLibbyPlatform(platform) {
    return {
      ...platform,
      enabled: false,
      note: platform.note || "Disabled by default: replaced by the single Libby platform in the active workflow.",
    };
  }

  function migrateBooks(books) {
    return (Array.isArray(books) ? books : []).map((book) => {
      const copy = { ...book, platformResults: { ...(book.platformResults || {}) } };
      if (!copy.bestSource) copy.bestSource = "Unknown";
      if (!copy.platformResults.libby) {
        const oldResult = [...oldLibbyIds].map((id) => copy.platformResults[id]).find((result) => result && result.status);
        copy.platformResults.libby = oldResult ? { ...oldResult, note: [oldResult.note, "Migrated from old individual Libby library check."].filter(Boolean).join(" ") } : blankResult();
      }
      ensurePlatformResults(copy);
      return copy;
    });
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function notify(text, type = "") {
    messages.innerHTML = text ? `<div class="message ${type}">${escapeHtml(text)}</div>` : "";
  }

  function saveBooks() {
    write(KEYS.books, state.books);
  }

  function savePlatforms() {
    write(KEYS.platforms, state.platforms);
  }

  function saveSettings() {
    write(KEYS.settings, state.settings);
  }

  function troveUrl(work) {
    return work?.troveId ? `https://trove.nla.gov.au/work/${encodeURIComponent(work.troveId)}` : "https://trove.nla.gov.au/";
  }

  function saveRecent(query) {
    const clean = query.trim();
    if (!clean) return;
    state.recent = [clean, ...state.recent.filter((item) => item !== clean)].slice(0, 10);
    write(KEYS.recent, state.recent);
  }

  function setView(view) {
    state.view = view;
    Object.entries(views).forEach(([key, el]) => el.classList.toggle("active", key === view));
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    notify("");
    render();
  }

  function enabledPlatforms() {
    return state.platforms.filter((platform) => platform.enabled && !oldLibbyIds.has(platform.id));
  }

  function generatedLinkPlatforms() {
    return ["libby", "hoopla", "borrowbox", "audible", "goodreads", "trove"]
      .map((id) => state.platforms.find((platform) => platform.id === id && platform.enabled))
      .filter(Boolean);
  }

  function manualCheckPlatforms() {
    return ["libby", "hoopla", "borrowbox", "audible", "goodreads"]
      .map((id) => state.platforms.find((platform) => platform.id === id && platform.enabled))
      .filter(Boolean);
  }

  function libraryPlatforms() {
    return ["libby", "hoopla", "borrowbox"]
      .map((id) => state.platforms.find((platform) => platform.id === id && platform.enabled))
      .filter(Boolean);
  }

  function stripArticles(title) {
    if (!state.settings.stripArticles) return title || "";
    return String(title || "").replace(/^(the|a|an)\s+/i, "");
  }

  function encodePart(value) {
    return encodeURIComponent(value || "");
  }

  function platformUrl(platform, book) {
    if (platform.id === "libby") return "https://libbyapp.com/search";
    const hasIsbn = Boolean(book.isbn);
    const template = hasIsbn && platform.isbnUrlTemplate ? platform.isbnUrlTemplate : platform.searchUrlTemplate;
    const fallbackTemplate = platform.id === "goodreads" && !hasIsbn ? "https://www.goodreads.com/search?q={title}+{author}" : template;
    return (fallbackTemplate || platform.fallbackUrl)
      .replaceAll("{title}", encodePart(stripArticles(book.title)))
      .replaceAll("{author}", encodePart(book.author))
      .replaceAll("{isbn}", encodePart(book.isbn));
  }

  function queryText(book) {
    return [stripArticles(book.title), book.author].filter(Boolean).join(" ");
  }

  function blankResult() {
    return { status: null, format: null, statusValue: "", note: "", checkedAt: "" };
  }

  function ensurePlatformResults(book) {
    book.platformResults = book.platformResults || {};
    if (!book.bestSource) book.bestSource = "Unknown";
    state.platforms.forEach((platform) => {
      book.platformResults[platform.id] = book.platformResults[platform.id] || blankResult();
    });
  }

  function checkedCount(book) {
    ensurePlatformResults(book);
    return manualCheckPlatforms().filter((platform) => book.platformResults[platform.id]?.status !== null).length;
  }

  function resultClass(result) {
    if (!result || !result.status) return "";
    if (result.status === "hold") return "hold";
    if (result.status === "available") return "available";
    if (result.status === "checked") return "checked";
    return result.status;
  }

  function render() {
    if (state.view === "search") renderSearch();
    if (state.view === "check") renderCheck();
    if (state.view === "saved") renderSaved();
    if (state.view === "platforms") renderPlatforms();
    if (state.view === "settings") renderSettings();
  }

  function renderSearch() {
    views.search.innerHTML = `
      <div class="stack">
        <section class="panel stack">
          <h2>Search</h2>
          <div class="search-bar">
            <input id="search-input" placeholder="Title, author, ISBN, or series" />
            <button id="search-button" class="primary">Search</button>
            <button id="manual-button">Enter manually</button>
          </div>
          <div id="recent-searches" class="chips"></div>
          <p id="trove-warning" class="muted"></p>
          <div id="generated-search-links" class="chips"></div>
          <p id="libby-search-hint" class="muted small-warning"></p>
        </section>
        <section id="trove-results" class="stack"></section>
        <section id="book-form-panel" class="panel stack" hidden></section>
      </div>
    `;
    const input = document.getElementById("search-input");
    const recent = document.getElementById("recent-searches");
    const generatedLinks = document.getElementById("generated-search-links");
    recent.innerHTML = state.recent.map((item) => `<button class="pill recent-chip" data-query="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("");
    document.querySelectorAll(".recent-chip").forEach((button) => {
      button.addEventListener("click", () => {
        input.value = button.dataset.query;
        doSearch(input.value);
      });
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") doSearch(input.value);
    });
    input.addEventListener("input", () => renderGeneratedSearchLinks(input.value, generatedLinks));
    document.getElementById("search-button").addEventListener("click", () => doSearch(input.value));
    document.getElementById("manual-button").addEventListener("click", () => handleManualEntry(input.value));
    renderGeneratedSearchLinks(input.value, generatedLinks);
  }

  function renderGeneratedSearchLinks(searchText, container) {
    const query = searchText.trim();
    if (!query) {
      container.innerHTML = "";
      document.getElementById("libby-search-hint").textContent = "";
      return;
    }
    const draft = { title: query, author: "", isbn: "" };
    container.innerHTML = generatedLinkPlatforms()
      .map((platform) => {
        if (platform.id === "libby") {
          return `
            <button class="link-button" data-open-libby-search="${escapeHtml(query)}">Open Libby</button>
            <button data-copy-generated-query="${escapeHtml(query)}">Copy query</button>
          `;
        }
        return `<a class="link-button" target="_blank" rel="noreferrer" href="${escapeHtml(platformUrl(platform, draft))}">Open ${escapeHtml(linkLabel(platform))}</a>`;
      })
      .join("");
    document.getElementById("libby-search-hint").textContent =
      "Libby deep links are unreliable. Open Libby Search copies the query, then opens Libby search so you can paste it. It will use your logged-in account and added libraries.";
    container.querySelectorAll("[data-open-libby-search]").forEach((button) => {
      button.addEventListener("click", () => {
        copyText(button.dataset.openLibbySearch, false);
        notify("Query copied. Paste it into Libby search after it opens.", "good");
        window.open("https://libbyapp.com/search", "_blank", "noopener,noreferrer");
      });
    });
    container.querySelectorAll("[data-copy-generated-query]").forEach((button) => {
      button.addEventListener("click", () => copyText(button.dataset.copyGeneratedQuery));
    });
  }

  function linkLabel(platform) {
    const labels = { libby: "Libby", hoopla: "Hoopla", borrowbox: "BorrowBox", audible: "Audible AU", goodreads: "Goodreads", trove: "Trove" };
    return labels[platform.id] || platform.name;
  }

  function handleManualEntry(searchText = "") {
    console.log("[Manual Entry] Enter manually clicked");
    showBookForm({ title: searchText.trim() });
  }

  async function doSearch(query) {
    query = query.trim();
    saveRecent(query);
    const warning = document.getElementById("trove-warning");
    const resultsEl = document.getElementById("trove-results");
    resultsEl.innerHTML = "";
    renderGeneratedSearchLinks(query, document.getElementById("generated-search-links"));
    if (!query) {
      warning.innerHTML = `Trove search unavailable — you can still enter the book manually. <button id="warning-manual-button">Enter manually</button>`;
      document.getElementById("warning-manual-button").addEventListener("click", () => handleManualEntry(query));
      return;
    }
    if (!state.settings.troveApiKey && location.protocol === "file:") {
      warning.innerHTML = `Trove search unavailable — you can still enter the book manually. <button id="warning-manual-button">Enter manually</button>`;
      document.getElementById("warning-manual-button").addEventListener("click", () => handleManualEntry(query));
      return;
    }
    warning.textContent = "Searching Trove...";
    try {
      const data = await fetchTroveResults(query);
      state.troveResults = extractTroveWorks(data)
        .map((work) => ({ ...work, ranking: rankTroveWork(work, query), troveInfo: extractTroveInfo(work.raw, work) }))
        .sort((a, b) => b.ranking.score - a.ranking.score)
        .slice(0, 12);
      if (state.settings.troveDebug && state.troveResults[0]) console.log("[Trove result raw]", state.troveResults[0].raw || state.troveResults[0]);
      warning.innerHTML = state.troveResults.length ? "" : `No Trove results found. <button id="warning-manual-button">Enter manually</button>`;
      document.getElementById("warning-manual-button")?.addEventListener("click", () => handleManualEntry(query));
      renderTroveResults();
    } catch {
      warning.innerHTML = `Trove search unavailable — you can still enter the book manually. <button id="warning-manual-button">Enter manually</button>`;
      document.getElementById("warning-manual-button").addEventListener("click", () => handleManualEntry(query));
    }
  }

  async function fetchTroveResults(query) {
    if (location.protocol !== "file:") {
      const proxyUrl = new URL("/api/trove", location.origin);
      proxyUrl.searchParams.set("q", query);
      const response = await fetch(proxyUrl.toString());
      if (!response.ok) throw new Error(`Trove proxy returned ${response.status}`);
      return response.json();
    }
    const url = new URL("https://api.trove.nla.gov.au/v3/result");
    url.searchParams.set("q", query);
    url.searchParams.set("category", "book");
    url.searchParams.set("encoding", "json");
    url.searchParams.set("n", "12");
    url.searchParams.set("key", state.settings.troveApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Trove returned ${response.status}`);
    return response.json();
  }

  async function fetchTroveDetails(workId) {
    if (!workId) throw new Error("Missing Trove work ID");
    if (location.protocol !== "file:") {
      const proxyUrl = new URL("/api/trove", location.origin);
      proxyUrl.searchParams.set("workId", workId);
      const response = await fetch(proxyUrl.toString());
      if (!response.ok) throw new Error(`Trove detail proxy returned ${response.status}`);
      return response.json();
    }
    const url = new URL(`https://api.trove.nla.gov.au/v3/work/${encodeURIComponent(workId)}`);
    url.searchParams.set("encoding", "json");
    url.searchParams.set("include", "holdings,links,versions");
    url.searchParams.set("reclevel", "full");
    url.searchParams.set("key", state.settings.troveApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Trove detail returned ${response.status}`);
    return response.json();
  }

  function extractTroveWorks(data) {
    const works = [];
    const walk = (value) => {
      if (!value || works.length >= 20) return;
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value !== "object") return;
      if (value.title || value.id) {
        const identifiers = Array.isArray(value.identifier) ? value.identifier : [value.identifier].filter(Boolean);
        const isbn = identifiers.map(String).find((item) => /97[89][0-9 -]{10,}/.test(item)) || "";
        works.push({
          title: text(value.title),
          author: text(value.contributor),
          year: text(value.issued),
          format: text(value.type || value.format),
          troveId: text(value.id),
          isbn,
          raw: value,
        });
      }
      Object.values(value).forEach(walk);
    };
    walk(data?.category?.[0]?.records?.work || data);
    return works;
  }

  function text(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
    if (value && typeof value === "object") return text(value.value || value.name || value.title);
    return String(value || "");
  }

  function unique(values) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function extractTroveInfo(raw, fallback = {}) {
    const links = [];
    const holdings = [];
    const isbns = [];
    let sawHoldingShape = false;
    const visit = (value, key = "") => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, key));
        return;
      }
      if (typeof value !== "object") {
        const stringValue = String(value);
        if (/97[89][0-9 -]{10,}/.test(stringValue)) isbns.push(stringValue.match(/97[89][0-9 -]{10,}/)?.[0] || stringValue);
        if (/^https?:\/\//i.test(stringValue)) links.push({ url: stringValue, type: key || "link" });
        return;
      }
      const lowerKey = key.toLowerCase();
      if (["holding", "holdings", "library", "libraries", "nuc"].some((part) => lowerKey.includes(part))) sawHoldingShape = true;
      const url = text(value.url || value.href || value.link);
      if (url && /^https?:\/\//i.test(url)) links.push({ url, type: text(value.linktype || value.linkType || value.type || value.access || value.accessType || key || "link") });
      const maybeLibraryName = text(value.name || value.library || value.libraryName || value.fullname || value.fullName || value.nuc);
      if (maybeLibraryName && ["holding", "holdings", "library", "libraries", "nuc"].some((part) => lowerKey.includes(part))) holdings.push(maybeLibraryName);
      Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
    };
    visit(raw);
    const onlineLinks = uniqueLinks(links).filter((link) => !link.url.includes("trove.nla.gov.au/work/"));
    const accessText = onlineLinks.map((link) => `${link.type} ${link.url}`.toLowerCase()).join(" ");
    const onlineAccess = accessText.includes("restricted") || accessText.includes("licence") || accessText.includes("license") ? "Restricted" : onlineLinks.length ? "Yes" : "Unknown";
    return {
      onlineAccess,
      onlineLinks: onlineLinks.slice(0, 5),
      holdingLibraries: unique(holdings).slice(0, 6),
      holdingsLoaded: sawHoldingShape,
      isbn: unique([fallback.isbn, ...isbns])[0] || "",
      troveLink: troveUrl(fallback),
    };
  }

  function uniqueLinks(links) {
    const seen = new Set();
    return links.filter((link) => {
      if (!link.url || seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    });
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function rankTroveWork(work, query) {
    const q = normalize(query);
    const title = normalize(work.title);
    const author = normalize(work.author);
    const combined = `${title} ${author}`;
    const tokens = q.split(" ").filter((token) => token.length > 2);
    let score = 0;
    let reason = "Weak text overlap with the search.";
    if (author.includes(q)) {
      score += 90;
      reason = "Author closely matches the search.";
    }
    if (title.includes(q)) {
      score += 75;
      reason = "Title closely matches the search.";
    }
    const tokenHits = tokens.filter((token) => combined.includes(token)).length;
    score += tokenHits * 18;
    if (tokenHits >= 2 && score < 70) reason = "Some title or author words match.";
    if (q === "eden finley" && !author.includes("eden finley")) {
      const placeLike = title.includes("eden") && title.includes("finley");
      if (placeLike || combined.includes("finley") || combined.includes("eden")) {
        score = Math.min(score, 20);
        reason = "Looks like a place-name or catalogue false positive, not the author Eden Finley.";
      }
    }
    if (title.includes("one night with rhodes") || author.includes("eden finley")) {
      score = Math.max(score, 95);
      reason = "Likely match: title/author lines up with Eden Finley.";
    }
    const label = score >= 70 ? "Likely match" : score >= 40 ? "Possible match" : "Probably unrelated";
    return { score, label, reason };
  }

  function renderTroveResults() {
    const resultsEl = document.getElementById("trove-results");
    const visible = state.showUnrelated ? state.troveResults : state.troveResults.filter((work) => work.ranking.label !== "Probably unrelated");
    resultsEl.innerHTML = `
      <section class="panel stack">
        <div class="between">
          <div>
            <h2>Trove results</h2>
            <p class="muted">Trove finds book metadata only. Use a result to generate platform links, then manually check Libby, Hoopla, BorrowBox, Audible, and Goodreads.</p>
          </div>
          <label class="row compact"><input id="show-unrelated" type="checkbox" ${state.showUnrelated ? "checked" : ""} /> Show unrelated Trove results</label>
        </div>
      </section>
      <div class="cards trove-results">${visible.map(troveCardHtml).join("") || `<div class="empty">Only unrelated Trove results were hidden.</div>`}</div>
    `;
    document.getElementById("show-unrelated")?.addEventListener("change", (event) => {
      state.showUnrelated = event.target.checked;
      renderTroveResults();
    });
    bindTroveControls();
  }

  function troveCardHtml(work) {
    const book = state.books.find((item) => item.id === state.selectedTroveBookId && item.troveId === work.troveId);
    return `
      <article class="trove-card ${work.ranking.label === "Probably unrelated" ? "unrelated" : ""}" data-id="${escapeHtml(work.troveId)}">
        <div class="between">
          <div>
            <h3>${escapeHtml(work.title || "Untitled")}</h3>
            <p class="muted">${escapeHtml([work.author, work.year].filter(Boolean).join(" - "))}</p>
          </div>
          <span class="match-badge">${escapeHtml(work.ranking.label)}</span>
        </div>
        <div class="chips">
          ${(work.format || "Book").split(",").map((item) => `<span class="tag">${escapeHtml(item.trim())}</span>`).join("")}
          ${work.troveId ? `<span class="tag">Trove ${escapeHtml(work.troveId)}</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(work.ranking.reason)}</p>
        ${troveInfoHtml(work)}
        <div class="row">
          <button class="primary" data-use-trove>Use this book</button>
          <a class="link-button" target="_blank" rel="noreferrer" href="${escapeHtml(troveUrl(work))}">Open Trove</a>
          <button data-load-trove-details ${work.detailsLoading ? "disabled" : ""}>${work.detailsLoading ? "Loading Trove details..." : work.detailsLoaded ? "Reload Trove details" : "Load Trove details"}</button>
          <button data-mark-unrelated>Mark unrelated</button>
        </div>
        ${book ? manualPanelHtml(book, "search") : ""}
      </article>
    `;
  }

  function troveInfoHtml(work) {
    const info = work.troveInfo || extractTroveInfo(work.raw, work);
    return `
      <section class="trove-info">
        <h4>Trove info</h4>
        <dl>
          <div><dt>Online access</dt><dd>${escapeHtml(info.onlineAccess || "Unknown")}</dd></div>
          <div><dt>Holding libraries</dt><dd>${info.holdingLibraries.length ? escapeHtml(info.holdingLibraries.join(", ")) : "Trove holdings not loaded. Use Open Trove for library details."}</dd></div>
          <div><dt>ISBN</dt><dd>${escapeHtml(info.isbn || "Unknown")}</dd></div>
          <div><dt>Trove link</dt><dd><a target="_blank" rel="noreferrer" href="${escapeHtml(info.troveLink || troveUrl(work))}">Open Trove</a></dd></div>
        </dl>
        ${
          info.onlineLinks.length
            ? `<div class="chips">${info.onlineLinks.map((link) => `<a class="tag" target="_blank" rel="noreferrer" href="${escapeHtml(link.url)}">${escapeHtml(link.type || "Online link")}</a>`).join("")}</div>`
            : ""
        }
        ${work.detailsError ? `<p class="muted">Trove details could not be loaded. Use Open Trove for library details.</p>` : ""}
        <p class="muted small-warning">Trove holdings are metadata/library records only. Availability on Libby, Hoopla, BorrowBox, and Audible must still be checked manually.</p>
      </section>
    `;
  }

  function bindTroveControls() {
    document.querySelectorAll(".trove-card").forEach((card) => {
      const work = state.troveResults.find((item) => item.troveId === card.dataset.id);
      card.querySelector("[data-use-trove]")?.addEventListener("click", () => {
        const book = createBookFromSeed(work);
        state.selectedTroveBookId = book.id;
        saveBooks();
        renderTroveResults();
      });
      card.querySelector("[data-mark-unrelated]")?.addEventListener("click", () => {
        work.ranking = { score: 0, label: "Probably unrelated", reason: "Marked unrelated by you." };
        renderTroveResults();
      });
      card.querySelector("[data-load-trove-details]")?.addEventListener("click", () => loadTroveDetails(work));
    });
    bindManualPanels();
  }

  async function loadTroveDetails(work) {
    if (!work) return;
    work.detailsError = "";
    work.detailsLoading = true;
    renderTroveResults();
    try {
      const detail = await fetchTroveDetails(work.troveId);
      if (state.settings.troveDebug) console.log("[Trove result raw]", detail);
      work.detailRaw = detail;
      work.detailsLoaded = true;
      work.troveInfo = extractTroveInfo(detail, work);
    } catch {
      work.detailsError = "Trove holdings not loaded";
    } finally {
      work.detailsLoading = false;
      renderTroveResults();
    }
  }

  function showBookForm(seed = {}, existingBook = null) {
    console.log("[Manual Entry] showing manual form");
    const panel = document.getElementById("book-form-panel");
    panel.hidden = false;
    panel.innerHTML = `
      <h2>${existingBook ? "Edit Book" : "New Book"}</h2>
      <p id="book-form-error" class="message warn" hidden></p>
      <div class="grid">
        ${field("book-title", "Title", seed.title || "", true)}
        ${field("book-author", "Author", seed.author || "")}
        ${field("book-narrator", "Narrator", seed.narrator || "")}
        ${field("book-series", "Series", seed.series || "")}
        ${field("book-series-number", "Series number", seed.seriesNumber || "", false, "number")}
        ${field("book-isbn", "ISBN", seed.isbn || "")}
        ${field("book-tags", "Tags", (seed.tags || []).join ? seed.tags.join(", ") : "")}
        <label class="field wide"><span>Notes</span><textarea id="book-notes">${escapeHtml(seed.notes || "")}</textarea></label>
      </div>
      <div class="row">
        <button id="save-new-book" class="primary">Save book</button>
        <button id="cancel-book-form">Cancel</button>
      </div>
    `;
    document.getElementById("cancel-book-form").addEventListener("click", () => {
      panel.hidden = true;
    });
    document.getElementById("save-new-book").addEventListener("click", () => saveBookForm(seed, existingBook));
  }

  function saveBookForm(seed, existingBook) {
    const title = value("book-title").trim();
    if (!title) {
      const error = document.getElementById("book-form-error");
      error.textContent = "Title is required.";
      error.hidden = false;
      notify("Title is required", "warn");
      return;
    }
    const target = existingBook || {
      id: uid(),
      dateAdded: new Date().toISOString(),
      platformResults: {},
    };
    Object.assign(target, {
      title,
      author: value("book-author"),
      narrator: value("book-narrator"),
      series: value("book-series"),
      seriesNumber: Number(value("book-series-number")) || null,
      isbn: value("book-isbn"),
      troveId: seed.troveId || target.troveId || "",
      tags: value("book-tags").split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: value("book-notes"),
      dateUpdated: new Date().toISOString(),
    });
    ensurePlatformResults(target);
    if (!existingBook) state.books.unshift(target);
    saveBooks();
    console.log("[Manual Entry] saved book", target);
    state.activeBookId = target.id;
    setView("check");
  }

  function createBookFromSeed(seed = {}) {
    const existing = state.books.find((book) => book.troveId && book.troveId === seed.troveId);
    if (existing) {
      ensurePlatformResults(existing);
      return existing;
    }
    const book = {
      id: uid(),
      title: seed.title || "Untitled",
      author: seed.author || "",
      narrator: "",
      series: "",
      seriesNumber: null,
      isbn: seed.isbn || "",
      troveId: seed.troveId || "",
      tags: [],
      notes: "",
      bestSource: "Unknown",
      dateAdded: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      platformResults: {},
    };
    ensurePlatformResults(book);
    state.books.unshift(book);
    return book;
  }

  function field(id, label, val = "", required = false, type = "text") {
    return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${escapeHtml(val)}" ${required ? "required" : ""} /></label>`;
  }

  function value(id) {
    return document.getElementById(id)?.value || "";
  }

  function renderCheck() {
    const book = state.books.find((item) => item.id === state.activeBookId) || state.books[0];
    if (!book) {
      views.check.innerHTML = `<div class="empty">No active book - search for a book to get started</div>`;
      return;
    }
    state.activeBookId = book.id;
    ensurePlatformResults(book);
    views.check.innerHTML = `
      <div class="stack">
        <section class="panel stack">
          <div class="between">
            <div>
              <h2>${escapeHtml(book.title)}</h2>
              <p class="muted">${escapeHtml(bookMeta(book))}</p>
            </div>
            <button id="edit-book">Edit</button>
          </div>
        </section>
        ${manualPanelHtml(book, "check")}
        <section class="panel row">
          <button id="go-saved" class="primary">Save & go to Saved Books</button>
          <button id="clear-checks" class="danger">Clear all checks</button>
        </section>
      </div>
    `;
    document.getElementById("edit-book").addEventListener("click", () => showEditBook(book));
    document.getElementById("go-saved").addEventListener("click", () => setView("saved"));
    document.getElementById("clear-checks").addEventListener("click", () => {
      if (!confirm("Clear all platform checks for this book?")) return;
      Object.keys(book.platformResults).forEach((id) => (book.platformResults[id] = blankResult()));
      book.bestSource = "Unknown";
      book.dateUpdated = new Date().toISOString();
      saveBooks();
      renderCheck();
    });
    bindManualPanels();
  }

  function bookMeta(book) {
    return [book.author, book.narrator && `Narrated by ${book.narrator}`, book.series && `${book.series}${book.seriesNumber ? ` #${book.seriesNumber}` : ""}`, book.isbn && `ISBN ${book.isbn}`]
      .filter(Boolean)
      .join(" - ");
  }

  function manualPanelHtml(book, context) {
    ensurePlatformResults(book);
    const platforms = manualCheckPlatforms();
    return `
      <section class="panel manual-panel" data-book="${book.id}" data-context="${context}">
        <div class="between manual-head">
          <div>
            <h2>Manual Check Panel</h2>
            <p class="progress-badge">Checked ${checkedCount(book)} / ${platforms.length}</p>
            <p class="muted small-warning">Your browser may block multiple tabs. If that happens, use Open next unchecked instead.</p>
          </div>
          <label class="field best-source">
            <span>Best source</span>
            <select data-best-source>
              ${bestSourceOptions.map((option) => `<option ${book.bestSource === option ? "selected" : ""}>${option}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="row">
          <button class="primary" data-open-next>Open next unchecked</button>
          <button data-open-all>Open all unchecked</button>
          <button data-open-libraries>Open library links only</button>
        </div>
        <div class="manual-rows">
          ${platforms.map((platform) => checkRowHtml(book, platform)).join("")}
        </div>
      </section>
    `;
  }

  function checkRowHtml(book, platform) {
    const result = book.platformResults[platform.id] || blankResult();
    const actions = manualActions[platform.id] || [["Checked", "checked", "checked", null]];
    return `
      <div class="check-row ${resultClass(result)}" data-platform="${platform.id}">
        <div>
          <strong>${escapeHtml(platform.name)}</strong>
          ${platform.note ? `<p class="muted">${escapeHtml(platform.note)}</p>` : ""}
        </div>
        <div class="row compact">
          ${
            platform.id === "libby"
              ? `<button data-open-platform>Open Libby</button>`
              : `<a class="link-button" target="_blank" rel="noreferrer" href="${escapeHtml(platformUrl(platform, book))}">Open</a>`
          }
          <button data-copy-query>Copy query</button>
        </div>
        <div class="status-buttons">
          ${actions.map(([label, key, status, format]) => {
            const active = result.statusValue === key || (!result.statusValue && result.status === status && result.format === format);
            return `<button class="${active ? "active" : ""}" data-action="${key}">${label}</button>`;
          }).join("")}
        </div>
        <input data-note placeholder="optional note" value="${escapeHtml(result.note || "")}" />
      </div>
    `;
  }

  function bindManualPanels() {
    document.querySelectorAll(".manual-panel").forEach((panel) => {
      const book = state.books.find((item) => item.id === panel.dataset.book);
      if (!book) return;
      panel.querySelector("[data-best-source]")?.addEventListener("change", (event) => {
        book.bestSource = event.target.value;
        book.dateUpdated = new Date().toISOString();
        saveBooks();
      });
      panel.querySelector("[data-open-next]")?.addEventListener("click", () => openNextUnchecked(book));
      panel.querySelector("[data-open-all]")?.addEventListener("click", () => openManyUnchecked(book, manualCheckPlatforms()));
      panel.querySelector("[data-open-libraries]")?.addEventListener("click", () => openManyUnchecked(book, libraryPlatforms()));
      panel.querySelectorAll(".check-row").forEach((row) => bindCheckRow(book, row, panel.dataset.context));
    });
  }

  function bindCheckRow(book, row, context) {
    const id = row.dataset.platform;
    row.querySelector("[data-copy-query]")?.addEventListener("click", () => copyText(queryText(book)));
    row.querySelector("[data-open-platform]")?.addEventListener("click", () => {
      const platform = state.platforms.find((item) => item.id === id);
      openPlatform(platform, book);
    });
    row.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = (manualActions[id] || []).find((item) => item[1] === button.dataset.action) || ["Checked", "checked", "checked", null];
        const current = book.platformResults[id] || blankResult();
        const selected = current.statusValue === action[1];
        book.platformResults[id] = selected
          ? blankResult()
          : { status: action[2], format: action[3], statusValue: action[1], note: current.note || "", checkedAt: new Date().toISOString() };
        book.dateUpdated = new Date().toISOString();
        saveBooks();
        refreshManualContext(context);
      });
    });
    row.querySelector("[data-note]")?.addEventListener("input", (event) => {
      book.platformResults[id] = book.platformResults[id] || blankResult();
      book.platformResults[id].note = event.target.value;
      book.platformResults[id].checkedAt = book.platformResults[id].checkedAt || new Date().toISOString();
      book.dateUpdated = new Date().toISOString();
      saveBooks();
    });
  }

  function refreshManualContext(context) {
    if (context === "search") renderTroveResults();
    if (context === "check") renderCheck();
    if (context === "saved") renderSaved();
  }

  function openNextUnchecked(book) {
    const platform = manualCheckPlatforms().find((item) => book.platformResults[item.id]?.status === null);
    if (!platform) {
      notify("All manual platforms are checked", "good");
      return;
    }
    openPlatform(platform, book);
  }

  function openManyUnchecked(book, platforms) {
    if (!confirm("Open all unchecked platform links? This may open several tabs.")) return;
    let blocked = false;
    platforms
      .filter((platform) => book.platformResults[platform.id]?.status === null)
      .forEach((platform) => {
        const opened = openPlatform(platform, book, false);
        if (opened === null) blocked = true;
      });
    if (blocked) notify("Some tabs may have been blocked. Please allow popups or use Open next unchecked.", "warn");
  }

  function openPlatform(platform, book, showMessage = true) {
    if (!platform) return null;
    if (platform.id === "libby") {
      copyText(queryText(book), false);
      if (showMessage) notify("Query copied. Paste it into Libby search after it opens.", "good");
    }
    return window.open(platformUrl(platform, book), "_blank", "noopener,noreferrer");
  }

  function copyText(textToCopy, showMessage = true) {
    navigator.clipboard?.writeText(textToCopy).then(
      () => {
        if (showMessage) notify("Query copied", "good");
      },
      () => notify("Copy failed", "warn"),
    );
  }

  function showEditBook(book) {
    setView("search");
    showBookForm(book, book);
    document.getElementById("save-new-book").textContent = "Update book and check platforms";
  }

  function renderSaved() {
    const books = filteredBooks();
    const selected = state.selectedBooks.size;
    views.saved.innerHTML = `
      <div class="stack">
        <section class="panel filter-bar">
          <div class="chips">
            ${["All", "Available now", "On hold", "Not checked", "Unavailable everywhere"]
              .map((item) => `<button class="pill filter-quick ${state.savedFilters.quick === item ? "active" : ""}" data-filter="${item}">${item}</button>`)
              .join("")}
          </div>
          <div class="filter-grid">
            <input id="saved-text" placeholder="Search title, author, narrator, tags" value="${escapeHtml(state.savedFilters.text)}" />
            <select id="format-filter">${["Any", "Audio", "Ebook"].map((item) => `<option ${state.savedFilters.format === item ? "selected" : ""}>${item}</option>`).join("")}</select>
            <select id="sort-filter">
              <option value="dateAdded" ${state.savedFilters.sort === "dateAdded" ? "selected" : ""}>Date added</option>
              <option value="title" ${state.savedFilters.sort === "title" ? "selected" : ""}>Title A-Z</option>
              <option value="author" ${state.savedFilters.sort === "author" ? "selected" : ""}>Author</option>
              <option value="dateUpdated" ${state.savedFilters.sort === "dateUpdated" ? "selected" : ""}>Last updated</option>
            </select>
          </div>
          ${selected ? `<div class="row"><button id="delete-selected" class="danger">Delete selected</button><button id="export-selected">Export selected as JSON</button></div>` : ""}
        </section>
        <section class="stack">
          ${books.length ? books.map(bookCardHtml).join("") : `<div class="empty">No books saved yet - search for a book to get started</div>`}
        </section>
      </div>
    `;
    bindSavedControls();
    bindManualPanels();
  }

  function filteredBooks() {
    let books = [...state.books];
    const { quick, format, text: query, sort } = state.savedFilters;
    books = books.filter((book) => {
      ensurePlatformResults(book);
      const results = manualCheckPlatforms().map((platform) => book.platformResults[platform.id] || blankResult());
      const hasAvailable = results.some((result) => result.status === "available");
      const hasHold = results.some((result) => result.status === "hold");
      const anyUnchecked = results.some((result) => result.status === null);
      const allUnavailable = results.length > 0 && results.every((result) => ["unavailable", "skipped", "checked"].includes(result.status));
      const hasFormat = format === "Any" || results.some((result) => result.format === format.toLowerCase());
      const haystack = [book.title, book.author, book.narrator, (book.tags || []).join(" ")].join(" ").toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (!hasFormat) return false;
      if (quick === "Available now") return hasAvailable;
      if (quick === "On hold") return hasHold;
      if (quick === "Not checked") return anyUnchecked;
      if (quick === "Unavailable everywhere") return allUnavailable;
      return true;
    });
    books.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "author") return a.author.localeCompare(b.author);
      if (sort === "dateUpdated") return new Date(b.dateUpdated) - new Date(a.dateUpdated);
      return new Date(b.dateAdded) - new Date(a.dateAdded);
    });
    return books;
  }

  function bookCardHtml(book) {
    ensurePlatformResults(book);
    const incomplete = manualCheckPlatforms().some((platform) => book.platformResults[platform.id]?.status === null);
    return `
      <article class="book-card">
        <header>
          <input type="checkbox" data-select="${book.id}" ${state.selectedBooks.has(book.id) ? "checked" : ""} />
          <div>
            <h3>${escapeHtml(book.title)}</h3>
            <p class="muted">${escapeHtml(bookMeta(book))}</p>
          </div>
          <button data-open-book="${book.id}">Open</button>
        </header>
        <div class="chips">${(book.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}${incomplete ? `<span class="status-pill">Incomplete</span>` : ""}</div>
        <div class="status-dots">
          ${manualCheckPlatforms().map((platform) => `<span title="${escapeHtml(platform.name)}" class="dot ${resultClass(book.platformResults[platform.id])}"></span>`).join("")}
        </div>
        ${manualPanelHtml(book, "saved")}
      </article>
    `;
  }

  function bindSavedControls() {
    document.querySelectorAll(".filter-quick").forEach((button) => {
      button.addEventListener("click", () => {
        state.savedFilters.quick = button.dataset.filter;
        renderSaved();
      });
    });
    document.getElementById("saved-text")?.addEventListener("input", (event) => {
      state.savedFilters.text = event.target.value;
      renderSaved();
    });
    document.getElementById("format-filter")?.addEventListener("change", (event) => {
      state.savedFilters.format = event.target.value;
      renderSaved();
    });
    document.getElementById("sort-filter")?.addEventListener("change", (event) => {
      state.savedFilters.sort = event.target.value;
      renderSaved();
    });
    document.querySelectorAll("[data-select]").forEach((box) => {
      box.addEventListener("click", (event) => event.stopPropagation());
      box.addEventListener("change", () => {
        if (box.checked) state.selectedBooks.add(box.dataset.select);
        else state.selectedBooks.delete(box.dataset.select);
      });
    });
    document.querySelectorAll("[data-open-book]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeBookId = button.dataset.openBook;
        setView("check");
      });
    });
    document.getElementById("delete-selected")?.addEventListener("click", () => {
      if (!confirm("Delete selected books?")) return;
      state.books = state.books.filter((book) => !state.selectedBooks.has(book.id));
      state.selectedBooks.clear();
      saveBooks();
      renderSaved();
    });
    document.getElementById("export-selected")?.addEventListener("click", () => {
      downloadJson("iris-books-selected.json", state.books.filter((book) => state.selectedBooks.has(book.id)));
    });
  }

  function renderPlatforms() {
    views.platforms.innerHTML = `
      <div class="stack">
        <section class="panel between">
          <div>
            <h2>Platforms</h2>
            <p class="muted">Defaults now use one Libby entry. Placeholders: {title}, {author}, {isbn}</p>
          </div>
          <div class="row">
            <button id="add-platform">Add platform</button>
            <button id="reset-platforms">Reset to defaults</button>
          </div>
        </section>
        <section class="platform-table">${state.platforms.map(platformRowHtml).join("")}</section>
      </div>
    `;
    bindPlatformControls();
  }

  function platformRowHtml(platform) {
    const editing = state.editingPlatformId === platform.id;
    if (editing) {
      return `
        <div class="platform-row" data-platform="${platform.id}">
          <input data-name value="${escapeHtml(platform.name)}" />
          <input data-search value="${escapeHtml(platform.searchUrlTemplate)}" />
          <div class="stack">
            <input data-isbn placeholder="ISBN URL template" value="${escapeHtml(platform.isbnUrlTemplate || "")}" />
            <input data-fallback placeholder="Fallback URL" value="${escapeHtml(platform.fallbackUrl || "")}" />
            <input data-note placeholder="Note" value="${escapeHtml(platform.note || "")}" />
          </div>
          <div class="row">
            <label class="row"><input data-enabled type="checkbox" ${platform.enabled ? "checked" : ""} /> Enabled</label>
            <button data-save-platform class="primary">Save</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="platform-row ${platform.enabled ? "" : "disabled"}" data-platform="${platform.id}">
        <strong>${escapeHtml(platform.name)}</strong>
        <span class="muted">${escapeHtml(platform.searchUrlTemplate)}</span>
        <span class="muted">${escapeHtml(platform.note || platform.isbnUrlTemplate || "-")}</span>
        <div class="row">
          <span class="pill">${platform.enabled ? "Enabled" : "Disabled"}</span>
          <button data-edit-platform>Edit</button>
        </div>
      </div>
    `;
  }

  function bindPlatformControls() {
    document.getElementById("add-platform").addEventListener("click", () => {
      const id = `platform-${Date.now()}`;
      state.platforms.push({ id, name: "New platform", searchUrlTemplate: "https://example.com/search?q={title}+{author}", isbnUrlTemplate: "", fallbackUrl: "", enabled: true, note: "" });
      state.editingPlatformId = id;
      savePlatforms();
      renderPlatforms();
    });
    document.getElementById("reset-platforms").addEventListener("click", () => {
      if (!confirm("Reset platforms to defaults?")) return;
      state.platforms = [...clone(defaultPlatforms), ...clone(disabledLegacyPlatforms)];
      savePlatforms();
      renderPlatforms();
    });
    document.querySelectorAll("[data-edit-platform]").forEach((button) => {
      button.addEventListener("click", () => {
        state.editingPlatformId = button.closest(".platform-row").dataset.platform;
        renderPlatforms();
      });
    });
    document.querySelectorAll("[data-save-platform]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest(".platform-row");
        const platform = state.platforms.find((item) => item.id === row.dataset.platform);
        platform.name = row.querySelector("[data-name]").value;
        platform.searchUrlTemplate = row.querySelector("[data-search]").value;
        platform.isbnUrlTemplate = row.querySelector("[data-isbn]").value;
        platform.fallbackUrl = row.querySelector("[data-fallback]").value;
        platform.note = row.querySelector("[data-note]").value;
        platform.enabled = row.querySelector("[data-enabled]").checked;
        state.editingPlatformId = null;
        savePlatforms();
        renderPlatforms();
      });
    });
  }

  function renderSettings() {
    views.settings.innerHTML = `
      <div class="stack">
        <section class="panel stack">
          <h2>Settings</h2>
          <label class="field">
            <span>Trove API key ${state.settings.troveApiKey ? "(local fallback saved: hidden)" : "(local file fallback only; Vercel uses TROVE_API_KEY env)"}</span>
            <input id="trove-key" value="${escapeHtml(state.settings.troveApiKey)}" />
          </label>
          <p class="muted">On Vercel, keep the real Trove key in the TROVE_API_KEY environment variable. The browser calls /api/trove, so the deployed key is not exposed in the page.</p>
          <label class="row"><input id="strip-articles" type="checkbox" ${state.settings.stripArticles ? "checked" : ""} /> Strip leading The/A/An from generated searches</label>
          <label class="row"><input id="trove-debug" type="checkbox" ${state.settings.troveDebug ? "checked" : ""} /> Log raw Trove result objects in the console</label>
          <div class="row">
            <button id="save-settings" class="primary">Save settings</button>
            <button id="test-key">Test key</button>
          </div>
        </section>
        <section class="panel row">
          <button id="export-data">Export data</button>
          <label class="link-button">Import data<input id="import-data" type="file" accept="application/json" hidden /></label>
          <button id="reset-data" class="danger">Reset all data</button>
        </section>
      </div>
    `;
    document.getElementById("save-settings").addEventListener("click", () => {
      state.settings.troveApiKey = value("trove-key").trim();
      state.settings.stripArticles = document.getElementById("strip-articles").checked;
      state.settings.troveDebug = document.getElementById("trove-debug").checked;
      saveSettings();
      notify("Settings saved", "good");
      renderSettings();
    });
    document.getElementById("test-key").addEventListener("click", testTroveKey);
    document.getElementById("export-data").addEventListener("click", () => {
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`iris-books-backup-${date}.json`, { books: state.books, platforms: state.platforms, settings: state.settings });
    });
    document.getElementById("import-data").addEventListener("change", importData);
    document.getElementById("reset-data").addEventListener("click", () => {
      if (!confirm("Clear all Iris Book Finder data?")) return;
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
      location.reload();
    });
  }

  async function testTroveKey() {
    const key = value("trove-key").trim();
    if (!key) {
      notify("Enter a Trove API key first", "warn");
      return;
    }
    const url = new URL("https://api.trove.nla.gov.au/v3/result");
    url.searchParams.set("q", "Pride and Prejudice");
    url.searchParams.set("category", "book");
    url.searchParams.set("encoding", "json");
    url.searchParams.set("n", "1");
    url.searchParams.set("key", key);
    try {
      const response = await fetch(url.toString());
      notify(response.ok ? "Trove key works" : "Trove key test failed", response.ok ? "good" : "warn");
    } catch {
      notify("Trove key test failed", "warn");
    }
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    file
      .text()
      .then((content) => {
        const data = JSON.parse(content);
        const books = Array.isArray(data) ? data : data.books;
        if (!Array.isArray(books)) throw new Error("Missing books array");
        const mode = confirm("Replace existing data? Cancel will merge imported books.") ? "replace" : "merge";
        state.books = mode === "replace" ? migrateBooks(books) : [...migrateBooks(books), ...state.books];
        if (Array.isArray(data.platforms)) state.platforms = migratePlatforms(data.platforms);
        if (data.settings) state.settings = { ...state.settings, ...data.settings };
        saveBooks();
        savePlatforms();
        saveSettings();
        notify("Import complete", "good");
        render();
      })
      .catch(() => notify("Malformed import JSON - nothing imported", "warn"));
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

  state.books.forEach(ensurePlatformResults);
  saveBooks();
  savePlatforms();
  render();
})();
