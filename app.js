(function () {
  "use strict";

  const KEYS = {
    books: "iris_books",
    platforms: "iris_platforms",
    settings: "iris_settings",
    recent: "iris_recent_searches",
  };

  const defaultPlatforms = [
    {
      id: "boobook",
      name: "Boobook Audio",
      searchUrlTemplate: "https://www.boobook.com.au/search?q={title}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://www.boobook.com.au/",
      enabled: true,
      note: "",
    },
    {
      id: "monash",
      name: "Monash Public Library Service",
      searchUrlTemplate: "https://monlibvic.overdrive.com/search?query={title}+{author}",
      isbnUrlTemplate: "",
      fallbackUrl: "https://monlibvic.overdrive.com/",
      enabled: true,
      note: "Monash Public Library Service Libby/OverDrive collection.",
    },
    {
      id: "hoopla",
      name: "Hoopla AU",
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
    {
      id: "melbourne",
      name: "City of Melbourne Libraries",
      searchUrlTemplate:
        "https://libcat.melbourne.vic.gov.au/cgi-bin/spydus.exe/ENQ/WPAC/BIBENQ?ENTRY={title}+{author}&ENTRY_TYPE=K",
      isbnUrlTemplate: "",
      fallbackUrl: "https://librarysearch.melbourne.vic.gov.au/",
      enabled: false,
      note: "Disabled by default: Melbourne Library Service no longer offers digital titles through OverDrive.",
    },
  ];

  const statusOptions = [
    { key: "audio", label: "Audio", status: "available", format: "audio" },
    { key: "ebook", label: "Ebook", status: "available", format: "ebook" },
    { key: "both", label: "Both", status: "available", format: "both" },
    { key: "hold", label: "Hold", status: "hold", format: null },
    { key: "unavailable", label: "Unavailable", status: "unavailable", format: null },
    { key: "skipped", label: "Skip", status: "skipped", format: null },
  ];

  const state = {
    view: "search",
    books: read(KEYS.books, []),
    platforms: migratePlatforms(read(KEYS.platforms, defaultPlatforms)),
    settings: read(KEYS.settings, { troveApiKey: "", stripArticles: true }),
    recent: read(KEYS.recent, []),
    activeBookId: null,
    troveResults: [],
    editingPlatformId: null,
    selectedBooks: new Set(),
    savedFilters: {
      quick: "All",
      format: "Any",
      text: "",
      sort: "dateAdded",
    },
  };

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

  function migratePlatforms(platforms) {
    const byId = new Map((Array.isArray(platforms) ? platforms : []).map((platform) => [platform.id, platform]));
    const migrated = defaultPlatforms.map((defaultPlatform) => {
      const existing = byId.get(defaultPlatform.id);
      if (!existing) return { ...defaultPlatform };
      const merged = { ...defaultPlatform, ...existing };
      if (defaultPlatform.id === "melbourne") {
        merged.name = defaultPlatform.name;
        merged.searchUrlTemplate = defaultPlatform.searchUrlTemplate;
        merged.fallbackUrl = defaultPlatform.fallbackUrl;
        merged.enabled = false;
        merged.note = defaultPlatform.note;
      }
      if (defaultPlatform.id === "monash") {
        merged.name = defaultPlatform.name;
        merged.searchUrlTemplate = defaultPlatform.searchUrlTemplate;
        merged.fallbackUrl = defaultPlatform.fallbackUrl;
        merged.enabled = true;
        merged.note = defaultPlatform.note;
      }
      return merged;
    });
    byId.forEach((platform, id) => {
      if (!defaultPlatforms.some((defaultPlatform) => defaultPlatform.id === id)) migrated.push(platform);
    });
    return migrated;
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

  function saveRecent(query) {
    const clean = query.trim();
    if (!clean) return;
    state.recent = [clean, ...state.recent.filter((item) => item !== clean)].slice(0, 10);
    write(KEYS.recent, state.recent);
  }

  function setView(view) {
    state.view = view;
    Object.entries(views).forEach(([key, el]) => el.classList.toggle("active", key === view));
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
    notify("");
    render();
  }

  function enabledPlatforms() {
    return state.platforms.filter((platform) => platform.enabled);
  }

  function manualCheckPlatforms() {
    return enabledPlatforms().filter((platform) => platform.id !== "trove");
  }

  function stripArticles(title) {
    if (!state.settings.stripArticles) return title || "";
    return String(title || "").replace(/^(the|a|an)\s+/i, "");
  }

  function encodePart(value) {
    return encodeURIComponent(value || "");
  }

  function platformUrl(platform, book) {
    const hasIsbn = Boolean(book.isbn);
    const template = hasIsbn && platform.isbnUrlTemplate ? platform.isbnUrlTemplate : platform.searchUrlTemplate;
    const fallbackTemplate =
      platform.id === "goodreads" && !hasIsbn
        ? "https://www.goodreads.com/search?q={title}+{author}"
        : template;
    return fallbackTemplate
      .replaceAll("{title}", encodePart(stripArticles(book.title)))
      .replaceAll("{author}", encodePart(book.author))
      .replaceAll("{isbn}", encodePart(book.isbn));
  }

  function blankResult() {
    return { status: null, format: null, note: "", checkedAt: "" };
  }

  function ensurePlatformResults(book) {
    book.platformResults = book.platformResults || {};
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
        </section>
        <section id="trove-results" class="stack"></section>
        <section id="book-form-panel" class="panel stack" hidden></section>
      </div>
    `;

    const input = document.getElementById("search-input");
    const recent = document.getElementById("recent-searches");
    const generatedLinks = document.getElementById("generated-search-links");
    recent.innerHTML = state.recent
      .map((item) => `<button class="pill recent-chip" data-query="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
      .join("");

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
      return;
    }
    const draft = { title: query, author: "", isbn: "" };
    container.innerHTML = enabledPlatforms()
      .map((platform) => {
        return `<a class="link-button" target="_blank" rel="noreferrer" href="${escapeHtml(platformUrl(platform, draft))}">Open ${escapeHtml(linkLabel(platform))}</a>`;
      })
      .join("");
  }

  function linkLabel(platform) {
    const labels = {
      boobook: "Boobook",
      monash: "Monash",
      hoopla: "Hoopla",
      borrowbox: "BorrowBox",
      audible: "Audible AU",
      goodreads: "Goodreads",
      trove: "Trove",
      melbourne: "Melbourne",
    };
    return labels[platform.id] || platform.name;
  }

  function handleManualEntry(searchText = "") {
    console.log("[Manual Entry] Enter manually clicked");
    showBookForm({ title: searchText.trim() });
  }

  async function doSearch(query) {
    query = query.trim();
    if (!query) {
      notify("Enter a title or author to search", "warn");
      return;
    }
    saveRecent(query);
    const warning = document.getElementById("trove-warning");
    const resultsEl = document.getElementById("trove-results");
    resultsEl.innerHTML = "";
    if (!state.settings.troveApiKey && location.protocol === "file:") {
      warning.innerHTML = `
        Trove search unavailable — you can still enter the book manually.
        <button id="warning-manual-button">Enter manually</button>
      `;
      document.getElementById("warning-manual-button").addEventListener("click", () => handleManualEntry(query));
      showBookForm({ title: query });
      return;
    }
    warning.textContent = "Searching Trove...";
    try {
      const data = await fetchTroveResults(query);
      state.troveResults = extractTroveWorks(data).slice(0, 5);
      warning.innerHTML = state.troveResults.length
        ? ""
        : `No Trove results found. <button id="warning-manual-button">Enter manually</button>`;
      document.getElementById("warning-manual-button")?.addEventListener("click", () => handleManualEntry(query));
      resultsEl.innerHTML = `
        <h2>Trove results</h2>
        <div class="cards">
          ${state.troveResults.map(troveCardHtml).join("")}
        </div>
      `;
      document.querySelectorAll(".trove-card").forEach((card) => {
        card.addEventListener("click", () => {
          const work = state.troveResults.find((item) => item.troveId === card.dataset.id);
          showBookForm(work || {});
        });
      });
    } catch {
      warning.innerHTML = `
        Trove search unavailable — you can still enter the book manually.
        <button id="warning-manual-button">Enter manually</button>
      `;
      document.getElementById("warning-manual-button").addEventListener("click", () => handleManualEntry(query));
      showBookForm({ title: query });
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
    url.searchParams.set("n", "5");
    url.searchParams.set("key", state.settings.troveApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Trove returned ${response.status}`);
    return response.json();
  }

  function extractTroveWorks(data) {
    const works = [];
    const walk = (value) => {
      if (!value || works.length >= 5) return;
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

  function troveCardHtml(work) {
    return `
      <article class="trove-card" data-id="${escapeHtml(work.troveId)}">
        <h3>${escapeHtml(work.title || "Untitled")}</h3>
        <p class="muted">${escapeHtml([work.author, work.year].filter(Boolean).join(" - "))}</p>
        <div class="chips">
          ${(work.format || "Book").split(",").map((item) => `<span class="tag">${escapeHtml(item.trim())}</span>`).join("")}
          ${work.troveId ? `<span class="tag">Trove ${escapeHtml(work.troveId)}</span>` : ""}
        </div>
      </article>
    `;
  }

  function showBookForm(seed = {}, existingBook = null) {
    console.log("[Manual Entry] showing manual form");
    const panel = document.getElementById("book-form-panel");
    panel.hidden = false;
    panel.innerHTML = `
      <h2>New Book</h2>
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
    document.getElementById("save-new-book").addEventListener("click", () => {
      const title = value("book-title").trim();
      if (!title) {
        const error = document.getElementById("book-form-error");
        error.textContent = "Title is required.";
        error.hidden = false;
        notify("Title is required", "warn");
        return;
      }
      if (existingBook) {
        existingBook.title = title;
        existingBook.author = value("book-author");
        existingBook.narrator = value("book-narrator");
        existingBook.series = value("book-series");
        existingBook.seriesNumber = Number(value("book-series-number")) || null;
        existingBook.isbn = value("book-isbn");
        existingBook.tags = value("book-tags").split(",").map((tag) => tag.trim()).filter(Boolean);
        existingBook.notes = value("book-notes");
        existingBook.dateUpdated = new Date().toISOString();
        ensurePlatformResults(existingBook);
        saveBooks();
        state.activeBookId = existingBook.id;
        setView("check");
        return;
      }
      const book = {
        id: uid(),
        title,
        author: value("book-author"),
        narrator: value("book-narrator"),
        series: value("book-series"),
        seriesNumber: Number(value("book-series-number")) || null,
        isbn: value("book-isbn"),
        troveId: seed.troveId || "",
        tags: value("book-tags").split(",").map((tag) => tag.trim()).filter(Boolean),
        notes: value("book-notes"),
        dateAdded: new Date().toISOString(),
        dateUpdated: new Date().toISOString(),
        platformResults: {},
      };
      ensurePlatformResults(book);
      state.books.unshift(book);
      saveBooks();
      console.log("[Manual Entry] saved book", book);
      state.activeBookId = book.id;
      setView("check");
    });
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
    const platforms = manualCheckPlatforms();
    views.check.innerHTML = `
      <div class="stack">
        <section class="panel stack">
          <div class="between">
            <div>
              <h2>${escapeHtml(book.title)}</h2>
              <p class="muted">${escapeHtml([book.author, book.series && `${book.series}${book.seriesNumber ? ` #${book.seriesNumber}` : ""}`, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(" - "))}</p>
            </div>
            <button id="edit-book">Edit</button>
          </div>
          <strong>${checkedCount(book)} / ${platforms.length} platforms checked</strong>
        </section>
        <section class="stack">
          ${platforms.map((platform) => checkRowHtml(book, platform)).join("")}
        </section>
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
      book.dateUpdated = new Date().toISOString();
      saveBooks();
      renderCheck();
    });
    bindCheckRows(book);
  }

  function checkRowHtml(book, platform) {
    const result = book.platformResults[platform.id] || blankResult();
    return `
      <div class="check-row ${resultClass(result)}" data-platform="${platform.id}">
        <strong>${escapeHtml(platform.name)}</strong>
        <a class="link-button" target="_blank" rel="noreferrer" href="${escapeHtml(platformUrl(platform, book))}">Open ↗</a>
        <div class="status-buttons">
          ${statusOptions
            .map((option) => {
              const isActive =
                option.status === "available"
                  ? result.status === "available" && result.format === option.format
                  : result.status === option.status;
              return `<button class="${isActive ? "active" : ""}" data-status="${option.key}">${option.label}</button>`;
            })
            .join("")}
        </div>
        <input data-note placeholder="optional note" value="${escapeHtml(result.note || "")}" />
      </div>
    `;
  }

  function bindCheckRows(book) {
    document.querySelectorAll(".check-row").forEach((row) => {
      const id = row.dataset.platform;
      row.querySelectorAll("[data-status]").forEach((button) => {
        button.addEventListener("click", () => {
          const current = book.platformResults[id] || blankResult();
          const option = statusOptions.find((item) => item.key === button.dataset.status);
          const selected = current.format === option.format && current.status === option.status;
          book.platformResults[id] = selected
            ? blankResult()
            : {
                status: option.status,
                format: option.format,
                note: current.note || "",
                checkedAt: new Date().toISOString(),
              };
          book.dateUpdated = new Date().toISOString();
          saveBooks();
          renderCheck();
        });
      });
      row.querySelector("[data-note]").addEventListener("input", (event) => {
        book.platformResults[id] = book.platformResults[id] || blankResult();
        book.platformResults[id].note = event.target.value;
        book.platformResults[id].checkedAt = book.platformResults[id].checkedAt || new Date().toISOString();
        book.dateUpdated = new Date().toISOString();
        saveBooks();
      });
    });
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
            <select id="format-filter">
              ${["Any", "Audio", "Ebook"].map((item) => `<option ${state.savedFilters.format === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
            <select id="sort-filter">
              <option value="dateAdded" ${state.savedFilters.sort === "dateAdded" ? "selected" : ""}>Date added</option>
              <option value="title" ${state.savedFilters.sort === "title" ? "selected" : ""}>Title A-Z</option>
              <option value="author" ${state.savedFilters.sort === "author" ? "selected" : ""}>Author</option>
              <option value="dateUpdated" ${state.savedFilters.sort === "dateUpdated" ? "selected" : ""}>Last updated</option>
            </select>
          </div>
          ${
            selected
              ? `<div class="row"><button id="delete-selected" class="danger">Delete selected</button><button id="export-selected">Export selected as JSON</button></div>`
              : ""
          }
        </section>
        <section class="cards">
          ${books.length ? books.map(bookCardHtml).join("") : `<div class="empty">No books saved yet - search for a book to get started</div>`}
        </section>
      </div>
    `;
    bindSavedControls();
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
      const allUnavailable = results.length > 0 && results.every((result) => ["unavailable", "skipped"].includes(result.status));
      const hasFormat =
        format === "Any" ||
        results.some((result) => result.format === format.toLowerCase() || result.format === "both");
      const haystack = [book.title, book.author, book.narrator, book.tags.join(" ")].join(" ").toLowerCase();
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
      <article class="book-card" data-book="${book.id}">
        <header>
          <input type="checkbox" data-select="${book.id}" ${state.selectedBooks.has(book.id) ? "checked" : ""} />
          <div>
            <h3>${escapeHtml(book.title)}</h3>
            <p class="muted">${escapeHtml([book.author, book.narrator, book.series && `${book.series}${book.seriesNumber ? ` #${book.seriesNumber}` : ""}`].filter(Boolean).join(" - "))}</p>
          </div>
        </header>
        <div class="chips">${book.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}${incomplete ? `<span class="status-pill">Incomplete</span>` : ""}</div>
        <div class="status-dots">
          ${manualCheckPlatforms()
            .map((platform) => `<span title="${escapeHtml(platform.name)}" class="dot ${resultClass(book.platformResults[platform.id])}"></span>`)
            .join("")}
        </div>
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
        renderSaved();
      });
    });
    document.querySelectorAll(".book-card").forEach((card) => {
      card.addEventListener("click", () => {
        state.activeBookId = card.dataset.book;
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
            <p class="muted">Placeholders: {title}, {author}, {isbn}</p>
          </div>
          <div class="row">
            <button id="add-platform">Add platform</button>
            <button id="reset-platforms">Reset to defaults</button>
          </div>
        </section>
        <section class="platform-table">
          ${state.platforms.map(platformRowHtml).join("")}
        </section>
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
      <div class="platform-row" data-platform="${platform.id}">
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
      state.platforms.push({
        id,
        name: "New platform",
        searchUrlTemplate: "https://example.com/search?q={title}+{author}",
        isbnUrlTemplate: "",
        fallbackUrl: "",
        enabled: true,
        note: "",
      });
      state.editingPlatformId = id;
      savePlatforms();
      renderPlatforms();
    });
    document.getElementById("reset-platforms").addEventListener("click", () => {
      if (!confirm("Reset platforms to defaults?")) return;
      state.platforms = structuredClone(defaultPlatforms);
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
            <span>Trove API key ${state.settings.troveApiKey ? "(local fallback saved: •••••)" : "(local file fallback only; Vercel uses TROVE_API_KEY env)"}</span>
            <input id="trove-key" value="${escapeHtml(state.settings.troveApiKey)}" />
          </label>
          <p class="muted">On Vercel, keep the real Trove key in the TROVE_API_KEY environment variable. The browser calls /api/trove, so the deployed key is not exposed in the page.</p>
          <label class="row">
            <input id="strip-articles" type="checkbox" ${state.settings.stripArticles ? "checked" : ""} />
            Strip leading The/A/An from generated searches
          </label>
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
      .then((text) => {
        const data = JSON.parse(text);
        const books = Array.isArray(data) ? data : data.books;
        if (!Array.isArray(books)) throw new Error("Missing books array");
        const mode = confirm("Replace existing data? Cancel will merge imported books.") ? "replace" : "merge";
        state.books = mode === "replace" ? books : [...books, ...state.books];
        if (Array.isArray(data.platforms)) state.platforms = data.platforms;
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

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  state.books.forEach(ensurePlatformResults);
  saveBooks();
  savePlatforms();
  render();
})();
