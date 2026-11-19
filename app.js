(() => {
  const STORAGE_SETTINGS = "gstreams_settings_v1";
  const STORAGE_RECENTS = "gstreams_recents_v1";

  const CORS_RELAYS = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  const ICONS = {
    folder: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`,
    video: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,9 15,12 10,15" fill="currentColor" stroke="none"/></svg>`,
    image: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 20"/></svg>`,
    audio: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    other: `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  };

  const state = {
    currentFolderId: null,
    breadcrumbs: [],
    items: [],
    filteredItems: [],
    activeFilter: "all",
    searchQuery: "",
    nativeMode: false,
    activeMedia: null,
    videoMode: "preview",
    settings: loadSettings(),
    recents: loadRecents(),
  };

  const el = {
    linkForm: document.getElementById("linkForm"),
    linkInput: document.getElementById("linkInput"),
    loadBtn: document.getElementById("loadBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    recentBar: document.getElementById("recentBar"),
    recentList: document.getElementById("recentList"),
    statusBanner: document.getElementById("statusBanner"),
    toolbar: document.getElementById("toolbar"),
    breadcrumbs: document.getElementById("breadcrumbs"),
    nativeFallbackBtn: document.getElementById("nativeFallbackBtn"),
    filterTabs: document.getElementById("filterTabs"),
    searchInput: document.getElementById("searchInput"),
    mediaGrid: document.getElementById("mediaGrid"),
    nativeContainer: document.getElementById("nativeContainer"),
    nativeIframe: document.getElementById("nativeIframe"),
    playerModal: document.getElementById("playerModal"),
    closePlayerBtn: document.getElementById("closePlayerBtn"),
    playerTitle: document.getElementById("playerTitle"),
    playerBadge: document.getElementById("playerBadge"),
    playerStage: document.getElementById("playerStage"),
    videoModeGroup: document.getElementById("videoModeGroup"),
    modePreviewBtn: document.getElementById("modePreviewBtn"),
    modeDirectBtn: document.getElementById("modeDirectBtn"),
    navGroup: document.getElementById("navGroup"),
    prevMediaBtn: document.getElementById("prevMediaBtn"),
    nextMediaBtn: document.getElementById("nextMediaBtn"),
    openDriveLink: document.getElementById("openDriveLink"),
    downloadLink: document.getElementById("downloadLink"),
    settingsModal: document.getElementById("settingsModal"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    appsScriptInput: document.getElementById("appsScriptInput"),
    workerInput: document.getElementById("workerInput"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    saveSettingsBtn: document.getElementById("saveSettingsBtn"),
    clearSettingsBtn: document.getElementById("clearSettingsBtn"),
  };

  init();

  function init() {
    renderRecents();
    bindEvents();

    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("folder");
    const fileParam = params.get("file");

    if (folderParam) {
      el.linkInput.value = `https://drive.google.com/drive/folders/${folderParam}`;
      openRootFolder(folderParam);
    } else if (fileParam) {
      el.linkInput.value = `https://drive.google.com/file/d/${fileParam}/view`;
      openMediaModal({
        id: fileParam,
        name: "Drive File",
        type: "video",
      });
    }
  }

  function bindEvents() {
    el.linkForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleLinkSubmit(el.linkInput.value.trim());
    });

    el.filterTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (!btn) return;
      state.activeFilter = btn.dataset.filter;
      el.filterTabs.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      applyFiltersAndRender();
    });

    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender();
    });

    el.nativeFallbackBtn.addEventListener("click", () => {
      toggleNativeMode(!state.nativeMode);
    });

    el.mediaGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const idx = Number(card.dataset.idx);
      const item = state.filteredItems[idx];
      if (!item) return;

      if (item.type === "folder") {
        openSubfolder(item.id, item.name);
      } else {
        openMediaModal(item);
      }
    });

    el.breadcrumbs.addEventListener("click", (e) => {
      const btn = e.target.closest(".crumb-btn");
      if (!btn) return;
      const idx = Number(btn.dataset.crumbIdx);
      const target = state.breadcrumbs[idx];
      if (!target) return;
      state.breadcrumbs = state.breadcrumbs.slice(0, idx + 1);
      loadFolder(target.id);
    });

    el.closePlayerBtn.addEventListener("click", closePlayerModal);
    document.querySelector('[data-close="player"]').addEventListener("click", closePlayerModal);

    el.modePreviewBtn.addEventListener("click", () => {
      state.videoMode = "preview";
      renderPlayerStage();
    });

    el.modeDirectBtn.addEventListener("click", () => {
      state.videoMode = "direct";
      renderPlayerStage();
    });

    el.prevMediaBtn.addEventListener("click", () => stepMedia(-1));
    el.nextMediaBtn.addEventListener("click", () => stepMedia(1));

    el.settingsBtn.addEventListener("click", openSettingsModal);
    el.closeSettingsBtn.addEventListener("click", closeSettingsModal);
    document.querySelector('[data-close="settings"]').addEventListener("click", closeSettingsModal);
    el.saveSettingsBtn.addEventListener("click", saveSettingsFromUI);
    el.clearSettingsBtn.addEventListener("click", () => {
      state.settings = { appsScriptUrl: "", workerUrl: "", apiKey: "" };
      localStorage.removeItem(STORAGE_SETTINGS);
      populateSettingsInputs();
      closeSettingsModal();
      showStatus("Settings cleared.", "info");
    });

    window.addEventListener("keydown", (e) => {
      if (!el.playerModal.classList.contains("hidden")) {
        if (e.key === "Escape") closePlayerModal();
        if (e.key === "ArrowLeft") stepMedia(-1);
        if (e.key === "ArrowRight") stepMedia(1);
      } else if (!el.settingsModal.classList.contains("hidden") && e.key === "Escape") {
        closeSettingsModal();
      }
    });
  }

  function parseDriveInput(raw) {
    if (!raw) return null;

    const folderMatch =
      raw.match(/\/folders\/([a-zA-Z0-9_-]{10,})/) ||
      raw.match(/embeddedfolderview\?id=([a-zA-Z0-9_-]{10,})/) ||
      raw.match(/folderview\?id=([a-zA-Z0-9_-]{10,})/);
    if (folderMatch) return { kind: "folder", id: folderMatch[1] };

    const fileMatch =
      raw.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
      raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (fileMatch) {
      if (raw.includes("/file/d/") || raw.includes("/uc?")) {
        return { kind: "file", id: fileMatch[1] };
      }
      return { kind: "folder", id: fileMatch[1] };
    }

    if (/^[a-zA-Z0-9_-]{15,}$/.test(raw)) {
      return { kind: "folder", id: raw };
    }

    return null;
  }

  function handleLinkSubmit(raw) {
    const parsed = parseDriveInput(raw);
    if (!parsed) {
      showStatus("Invalid Google Drive link.", "error");
      return;
    }

    if (parsed.kind === "file") {
      openMediaModal({
        id: parsed.id,
        name: "Drive File",
        type: "video",
      });
      return;
    }

    openRootFolder(parsed.id);
  }

  function openRootFolder(folderId, label = "Root") {
    state.breadcrumbs = [{ id: folderId, name: label }];
    updateUrlQuery("folder", folderId);
    loadFolder(folderId, true);
  }

  function openSubfolder(folderId, folderName) {
    state.breadcrumbs.push({ id: folderId, name: folderName });
    loadFolder(folderId, false);
  }

  async function loadFolder(folderId, saveToRecent = false) {
    state.currentFolderId = folderId;
    state.nativeMode = false;
    el.nativeContainer.classList.add("hidden");
    el.mediaGrid.classList.remove("hidden");
    el.nativeFallbackBtn.textContent = "Native Grid";
    el.toolbar.classList.remove("hidden");
    renderBreadcrumbs();

    showStatus("Loading folder...", "info");
    el.mediaGrid.innerHTML = "";

    try {
      let result;

      if (state.settings.appsScriptUrl) {
        result = await fetchViaAppsScript(folderId, state.settings.appsScriptUrl);
      } else if (state.settings.apiKey) {
        result = await fetchViaDriveApi(folderId, state.settings.apiKey);
      } else {
        result = await fetchViaEmbeddedScrape(folderId);
      }

      if (result.folderName && state.breadcrumbs.length > 0) {
        state.breadcrumbs[state.breadcrumbs.length - 1].name = result.folderName;
        renderBreadcrumbs();
      }

      if (saveToRecent) {
        addRecent(folderId, result.folderName || `Folder ${folderId.slice(0, 6)}`);
      }

      state.items = sortItems(result.items);
      hideStatus();
      applyFiltersAndRender();
    } catch (err) {
      console.error(err);
      showStatus(err.message, "error", {
        label: "Open Native Grid",
        onClick: () => toggleNativeMode(true),
      });
    }
  }

  async function fetchViaEmbeddedScrape(folderId) {
    const targetUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
    const relays = [];

    if (state.settings.workerUrl) {
      const base = state.settings.workerUrl;
      relays.push((u) => (base.includes("=") ? `${base}${encodeURIComponent(u)}` : `${base}?url=${encodeURIComponent(u)}`));
    }
    relays.push(...CORS_RELAYS);

    let html = null;
    let lastError = "Proxy request failed";

    for (const buildUrl of relays) {
      try {
        const res = await fetchWithTimeout(buildUrl(targetUrl), 9000);
        if (!res.ok) {
          lastError = `HTTP ${res.status}`;
          continue;
        }
        const text = await res.text();
        if (text && text.length > 100) {
          html = text;
          break;
        }
      } catch (e) {
        lastError = e.message || "Request timeout";
      }
    }

    if (!html) {
      throw new Error(`Could not load folder (${lastError}).`);
    }

    if (
      html.includes("accounts.google.com/ServiceLogin") ||
      html.includes("You need access") ||
      /<title>\s*Sign in/i.test(html)
    ) {
      throw new Error("Folder is private. Set sharing to public or configure an Apps Script URL in Settings.");
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const rawTitle = (doc.querySelector("title")?.textContent || "").replace(/\s*-\s*Google Drive$/i, "").trim();

    const itemsMap = new Map();

    doc.querySelectorAll(".flip-entry").forEach((entry) => {
      const link = entry.querySelector("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const titleEl = entry.querySelector(".flip-entry-title");
      const name = (titleEl ? titleEl.textContent : link.textContent || "").trim();
      const iconImg = entry.querySelector("img[src]");
      const iconSrc = iconImg ? iconImg.getAttribute("src") || "" : "";

      const parsed = extractEntryFromHref(href, name, iconSrc);
      if (parsed && !itemsMap.has(parsed.id)) {
        itemsMap.set(parsed.id, parsed);
      }
    });

    if (itemsMap.size === 0) {
      doc.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        const name = (a.textContent || "").trim();
        const parsed = extractEntryFromHref(href, name, "");
        if (parsed && parsed.id !== folderId && !itemsMap.has(parsed.id)) {
          itemsMap.set(parsed.id, parsed);
        }
      });
    }

    return {
      folderName: rawTitle || null,
      items: Array.from(itemsMap.values()),
    };
  }

  function extractEntryFromHref(href, name, iconSrc) {
    const fileMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch =
      href.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
      href.match(/folderview\?id=([a-zA-Z0-9_-]+)/);

    if (folderMatch) {
      return {
        id: folderMatch[1],
        name: name || "Untitled Folder",
        type: "folder",
        size: "",
      };
    }

    if (fileMatch) {
      const fileName = name || "Untitled File";
      return {
        id: fileMatch[1],
        name: fileName,
        type: detectMediaType(fileName, "", iconSrc),
        size: "",
      };
    }

    return null;
  }

  async function fetchViaAppsScript(folderId, scriptUrl) {
    const sep = scriptUrl.includes("?") ? "&" : "?";
    const res = await fetchWithTimeout(`${scriptUrl}${sep}id=${encodeURIComponent(folderId)}`, 15000);
    if (!res.ok) throw new Error(`Apps Script error (HTTP ${res.status}).`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const items = (data.items || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: f.isFolder ? "folder" : detectMediaType(f.name, f.mimeType || "", ""),
      size: f.size ? formatBytes(f.size) : "",
    }));

    return { folderName: data.folderName || null, items };
  }

  async function fetchViaDriveApi(folderId, apiKey) {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent("files(id,name,mimeType,size)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&key=${encodeURIComponent(apiKey)}`;

    const res = await fetchWithTimeout(url, 12000);
    if (!res.ok) throw new Error(`Drive API error (HTTP ${res.status}).`);
    const data = await res.json();

    const items = (data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type:
        f.mimeType === "application/vnd.google-apps.folder"
          ? "folder"
          : detectMediaType(f.name, f.mimeType || "", ""),
      size: f.size ? formatBytes(Number(f.size)) : "",
    }));

    return { folderName: null, items };
  }

  function detectMediaType(name, mimeType, iconSrc) {
    const lowerName = (name || "").toLowerCase();
    const lowerMime = (mimeType || "").toLowerCase();
    const lowerIcon = (iconSrc || "").toLowerCase();

    if (lowerMime.includes("folder") || lowerIcon.includes("folder")) return "folder";

    if (
      lowerMime.startsWith("video/") ||
      lowerIcon.includes("video") ||
      /\.(mp4|mkv|webm|mov|avi|m4v|flv|wmv|ts|3gp|ogv)$/.test(lowerName)
    ) {
      return "video";
    }

    if (
      lowerMime.startsWith("image/") ||
      lowerIcon.includes("image") ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|heic)$/.test(lowerName)
    ) {
      return "image";
    }

    if (
      lowerMime.startsWith("audio/") ||
      lowerIcon.includes("audio") ||
      /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/.test(lowerName)
    ) {
      return "audio";
    }

    return "other";
  }

  function sortItems(items) {
    const rank = { folder: 0, video: 1, image: 2, audio: 3, other: 4 };
    return [...items].sort((a, b) => {
      if (rank[a.type] !== rank[b.type]) return rank[a.type] - rank[b.type];
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function applyFiltersAndRender() {
    state.filteredItems = state.items.filter((item) => {
      const matchType = state.activeFilter === "all" || item.type === state.activeFilter;
      const matchSearch = !state.searchQuery || item.name.toLowerCase().includes(state.searchQuery);
      return matchType && matchSearch;
    });

    renderGrid();
  }

  function renderGrid() {
    if (state.filteredItems.length === 0) {
      el.mediaGrid.innerHTML = `<div class="empty-state">No files found.</div>`;
      return;
    }

    el.mediaGrid.innerHTML = state.filteredItems
      .map((item, idx) => {
        const showThumb = item.type === "video" || item.type === "image";
        const thumbUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w500`;
        const icon = ICONS[item.type] || ICONS.other;

        return `
          <article class="card" data-idx="${idx}">
            <div class="thumb-wrap">
              ${
                showThumb
                  ? `<img src="${thumbUrl}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
                     <span class="thumb-fallback" style="display:none">${icon}</span>`
                  : `<span class="thumb-fallback">${icon}</span>`
              }
              <span class="type-pill">${escapeHtml(item.type)}</span>
              ${item.type === "video" ? `<span class="play-overlay">▶</span>` : ""}
            </div>
            <div class="card-body">
              <div class="card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              ${item.size ? `<div class="card-meta">${escapeHtml(item.size)}</div>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderBreadcrumbs() {
    el.breadcrumbs.innerHTML = state.breadcrumbs
      .map((crumb, idx) => {
        const sep = idx > 0 ? `<span class="crumb-sep">/</span>` : "";
        return `${sep}<button class="crumb-btn" data-crumb-idx="${idx}">${escapeHtml(crumb.name)}</button>`;
      })
      .join("");
  }

  function toggleNativeMode(enable) {
    state.nativeMode = enable;
    if (enable && state.currentFolderId) {
      el.mediaGrid.classList.add("hidden");
      el.nativeContainer.classList.remove("hidden");
      el.nativeIframe.src = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(state.currentFolderId)}#grid`;
      el.nativeFallbackBtn.textContent = "Custom Grid";
    } else {
      el.nativeContainer.classList.add("hidden");
      el.nativeIframe.src = "";
      el.mediaGrid.classList.remove("hidden");
      el.nativeFallbackBtn.textContent = "Native Grid";
    }
  }

  function openMediaModal(item) {
    state.activeMedia = item;
    state.videoMode = "preview";

    el.playerTitle.textContent = item.name;
    el.playerBadge.textContent = item.type.toUpperCase();
    el.openDriveLink.href = `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`;
    el.downloadLink.href = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.id)}`;

    el.videoModeGroup.classList.toggle("hidden", item.type !== "video");

    const playable = getPlayableSiblings();
    el.navGroup.classList.toggle("hidden", playable.length <= 1);

    renderPlayerStage();
    el.playerModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function renderPlayerStage() {
    const item = state.activeMedia;
    if (!item) return;

    const id = encodeURIComponent(item.id);
    el.modePreviewBtn.classList.toggle("active", state.videoMode === "preview");
    el.modeDirectBtn.classList.toggle("active", state.videoMode === "direct");

    if (item.type === "image") {
      el.playerStage.innerHTML = `
        <img src="https://drive.google.com/thumbnail?id=${id}&sz=w2000" alt="${escapeHtml(item.name)}" />
      `;
      return;
    }

    if (item.type === "video" && state.videoMode === "direct") {
      const directSrc = state.settings.apiKey
        ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(state.settings.apiKey)}`
        : `https://drive.google.com/uc?export=download&id=${id}`;

      el.playerStage.innerHTML = `
        <video controls autoplay playsinline src="${directSrc}">
          Format not supported in direct mode. Switch to Embed Player.
        </video>
      `;
      return;
    }

    el.playerStage.innerHTML = `
      <iframe
        src="https://drive.google.com/file/d/${id}/preview"
        allow="autoplay; fullscreen; encrypted-media"
        allowfullscreen
      ></iframe>
    `;
  }

  function closePlayerModal() {
    el.playerStage.innerHTML = "";
    el.playerModal.classList.add("hidden");
    state.activeMedia = null;
    document.body.style.overflow = "";
  }

  function getPlayableSiblings() {
    return state.filteredItems.filter((i) => i.type !== "folder");
  }

  function stepMedia(delta) {
    if (!state.activeMedia) return;
    const playable = getPlayableSiblings();
    if (playable.length <= 1) return;
    const currentIdx = playable.findIndex((i) => i.id === state.activeMedia.id);
    if (currentIdx === -1) return;
    const nextIdx = (currentIdx + delta + playable.length) % playable.length;
    openMediaModal(playable[nextIdx]);
  }

  function loadRecents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_RECENTS) || "[]");
    } catch {
      return [];
    }
  }

  function addRecent(id, name) {
    state.recents = state.recents.filter((r) => r.id !== id);
    state.recents.unshift({ id, name });
    state.recents = state.recents.slice(0, 6);
    localStorage.setItem(STORAGE_RECENTS, JSON.stringify(state.recents));
    renderRecents();
  }

  function removeRecent(id) {
    state.recents = state.recents.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_RECENTS, JSON.stringify(state.recents));
    renderRecents();
  }

  function renderRecents() {
    if (state.recents.length === 0) {
      el.recentBar.classList.add("hidden");
      return;
    }
    el.recentBar.classList.remove("hidden");
    el.recentList.innerHTML = state.recents
      .map(
        (r) => `
        <span class="recent-pill">
          <button class="open-recent" data-id="${escapeHtml(r.id)}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.name)}</button>
          <button class="remove-recent" data-del="${escapeHtml(r.id)}" title="Remove">✕</button>
        </span>`
      )
      .join("");

    el.recentList.querySelectorAll(".open-recent").forEach((btn) => {
      btn.addEventListener("click", () => {
        el.linkInput.value = `https://drive.google.com/drive/folders/${btn.dataset.id}`;
        openRootFolder(btn.dataset.id, btn.dataset.name);
      });
    });

    el.recentList.querySelectorAll(".remove-recent").forEach((btn) => {
      btn.addEventListener("click", () => removeRecent(btn.dataset.del));
    });
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{"appsScriptUrl":"","workerUrl":"","apiKey":""}');
    } catch {
      return { appsScriptUrl: "", workerUrl: "", apiKey: "" };
    }
  }

  function populateSettingsInputs() {
    el.appsScriptInput.value = state.settings.appsScriptUrl || "";
    el.workerInput.value = state.settings.workerUrl || "";
    el.apiKeyInput.value = state.settings.apiKey || "";
  }

  function openSettingsModal() {
    populateSettingsInputs();
    el.settingsModal.classList.remove("hidden");
  }

  function closeSettingsModal() {
    el.settingsModal.classList.add("hidden");
  }

  function saveSettingsFromUI() {
    state.settings = {
      appsScriptUrl: el.appsScriptInput.value.trim(),
      workerUrl: el.workerInput.value.trim(),
      apiKey: el.apiKeyInput.value.trim(),
    };
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
    closeSettingsModal();
    showStatus("Settings saved.", "info");
    if (state.currentFolderId) {
      loadFolder(state.currentFolderId, false);
    }
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function showStatus(message, type = "info", action = null) {
    el.statusBanner.className = `status-banner ${type}`;
    el.statusBanner.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (action) {
      const btn = document.createElement("button");
      btn.className = "secondary-btn";
      btn.textContent = action.label;
      btn.addEventListener("click", action.onClick);
      el.statusBanner.appendChild(btn);
    }
  }

  function hideStatus() {
    el.statusBanner.classList.add("hidden");
  }

  function updateUrlQuery(key, val) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(key, val);
      window.history.replaceState({}, "", url);
    } catch {}
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();