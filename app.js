(() => {
  const STORAGE_SETTINGS = "gstreams_settings_v1";
  const STORAGE_RECENTS = "gstreams_recents_v1";

  const PUBLIC_RELAYS = [
    async (targetUrl, timeoutMs) => {
      const res = await fetchWithTimeout(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
        timeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async (targetUrl, timeoutMs) => {
      const res = await fetchWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
        timeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.contents || "";
    },
    async (targetUrl, timeoutMs) => {
      const res = await fetchWithTimeout(
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
        timeoutMs
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
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
    lastFocusedEl: null,
    playerHistoryActive: false,
    settingsHistoryActive: false,
    subfolderHistoryDepth: 0,
    ignoringPopstate: false,
  };

  const el = {
    brand: document.querySelector(".brand"),
    linkForm: document.getElementById("linkForm"),
    linkInput: document.getElementById("linkInput"),
    loadBtn: document.getElementById("loadBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    recentBar: document.getElementById("recentBar"),
    recentList: document.getElementById("recentList"),
    statusBanner: document.getElementById("statusBanner"),
    toolbar: document.getElementById("toolbar"),
    toolbarBottom: document.querySelector(".toolbar-bottom"),
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
    externalLinks: document.querySelector(".external-links"),
    openDriveLink: document.getElementById("openDriveLink"),
    downloadLink: document.getElementById("downloadLink"),
    fullTabLink: null,
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
    injectFullTabButton();
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
      openMediaModal({ id: fileParam, name: "Drive File", type: "video" });
    } else {
      loadPlaylist(true);
    }
  }

  function injectFullTabButton() {
    if (!el.externalLinks) return;
    const link = document.createElement("a");
    link.id = "fullTabLink";
    link.className = "primary-btn full-tab-btn";
    link.href = "#";
    link.textContent = "Full Tab Player";
    el.externalLinks.prepend(link);
    el.fullTabLink = link;
  }

  function bindEvents() {
    if (el.brand) {
      el.brand.tabIndex = 0;
      el.brand.setAttribute("role", "button");
      el.brand.style.cursor = "pointer";
      el.brand.title = "Return to playlist.json";
      const goHome = () => {
        el.linkInput.value = "";
        clearUrlQuery();
        state.subfolderHistoryDepth = 0;
        loadPlaylist(false);
      };
      el.brand.addEventListener("click", goHome);
      el.brand.addEventListener("keydown", (e) => {
        if (isSelectKey(e)) {
          e.preventDefault();
          goHome();
        }
      });
    }

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
      applyFiltersAndRender(false);
    });

    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      applyFiltersAndRender(false);
    });

    el.nativeFallbackBtn.addEventListener("click", () => {
      if (!state.currentFolderId) return;
      if (state.nativeMode) {
        loadCustomGrid(state.currentFolderId, false);
      } else {
        openNativeGrid(state.currentFolderId, false);
      }
    });

    const activateCard = (card) => {
      if (!card) return;
      const item = state.filteredItems[Number(card.dataset.idx)];
      if (!item) return;

      if (item.type === "folder") {
        if (Array.isArray(item.playlistItems)) {
          openPlaylistFolder(item);
        } else {
          openSubfolder(item.id, item.name);
        }
      } else {
        openMediaModal(item);
      }
    };

    el.mediaGrid.addEventListener("click", (e) => {
      activateCard(e.target.closest(".card"));
    });

    el.mediaGrid.addEventListener("keydown", (e) => {
      if (!isSelectKey(e)) return;
      const card = e.target.closest(".card");
      if (!card) return;
      e.preventDefault();
      activateCard(card);
    });

    el.breadcrumbs.addEventListener("click", (e) => {
      const btn = e.target.closest(".crumb-btn");
      if (!btn) return;
      const idx = Number(btn.dataset.crumbIdx);
      navigateToBreadcrumb(idx);
    });

    el.closePlayerBtn.addEventListener("click", () => closePlayerModal(false));
    document.querySelector('[data-close="player"]').addEventListener("click", () => closePlayerModal(false));

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
    el.closeSettingsBtn.addEventListener("click", () => closeSettingsModal(false));
    document.querySelector('[data-close="settings"]').addEventListener("click", () => closeSettingsModal(false));
    el.saveSettingsBtn.addEventListener("click", saveSettingsFromUI);
    el.clearSettingsBtn.addEventListener("click", () => {
      state.settings = { appsScriptUrl: "", workerUrl: "", apiKey: "" };
      localStorage.removeItem(STORAGE_SETTINGS);
      sessionStorage.clear();
      populateSettingsInputs();
      closeSettingsModal(false);
      showStatus("Settings cleared.", "info");
    });

    // Switch between pointer and remote/keyboard focus styling
    window.addEventListener("pointerdown", () => {
      document.body.classList.remove("using-remote");
    });

    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("popstate", handlePopstate);
  }

  // ===== Smart TV D-Pad & Back Button Handling =====
  function isSelectKey(e) {
    return e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 23;
  }

  function isBackKey(e) {
    const k = e.key;
    const c = e.keyCode;
    if (k === "Escape" || k === "GoBack" || k === "BrowserBack" || k === "XF86Back") return true;
    // 27 = Esc, 461 = LG WebOS Back, 10009 = Samsung Tizen Return
    if (c === 27 || c === 461 || c === 10009) return true;
    if (k === "Backspace" || c === 8) {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea") return true;
    }
    return false;
  }

  function handleGlobalKeydown(e) {
    const arrowMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };

    if (isBackKey(e)) {
      if (handleBackAction()) {
        e.preventDefault();
      }
      return;
    }

    // TV remote media track buttons when player is open
    if (!el.playerModal.classList.contains("hidden")) {
      if (e.key === "MediaTrackPrevious" || e.key === "[") {
        e.preventDefault();
        stepMedia(-1);
        return;
      }
      if (e.key === "MediaTrackNext" || e.key === "]") {
        e.preventDefault();
        stepMedia(1);
        return;
      }
    }

    const dir = arrowMap[e.key];
    if (!dir) {
      if (e.key === "Tab") document.body.classList.add("using-remote");
      return;
    }

    document.body.classList.add("using-remote");

    const active = document.activeElement;
    const isTextInput =
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

    // Allow Left/Right cursor editing inside text inputs, but let Up/Down escape cleanly
    if (isTextInput && (dir === "left" || dir === "right")) {
      return;
    }

    e.preventDefault();
    moveSpatialFocus(dir);
  }

  function handleBackAction() {
    if (!el.playerModal.classList.contains("hidden")) {
      closePlayerModal(false);
      return true;
    }
    if (!el.settingsModal.classList.contains("hidden")) {
      closeSettingsModal(false);
      return true;
    }
    if (state.breadcrumbs.length > 1) {
      goBackFolder(false);
      return true;
    }
    if (state.searchQuery || state.activeFilter !== "all") {
      resetFiltersUI();
      applyFiltersAndRender(true);
      return true;
    }
    return false;
  }

  function handlePopstate() {
    if (state.ignoringPopstate) {
      state.ignoringPopstate = false;
      return;
    }
    if (!el.playerModal.classList.contains("hidden")) {
      state.playerHistoryActive = false;
      closePlayerModal(true);
      return;
    }
    if (!el.settingsModal.classList.contains("hidden")) {
      state.settingsHistoryActive = false;
      closeSettingsModal(true);
      return;
    }
    if (state.breadcrumbs.length > 1 && state.subfolderHistoryDepth > 0) {
      state.subfolderHistoryDepth = Math.max(0, state.subfolderHistoryDepth - 1);
      goBackFolder(true);
    }
  }

  function getActiveFocusScope() {
    if (!el.playerModal.classList.contains("hidden")) return el.playerModal;
    if (!el.settingsModal.classList.contains("hidden")) return el.settingsModal;
    return document.body;
  }

  function getFocusableElements(scope) {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    return Array.from(scope.querySelectorAll(selector)).filter((node) => {
      if (scope === document.body && node.closest(".modal")) return false;
      if (node.closest(".hidden")) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function moveSpatialFocus(dir) {
    const scope = getActiveFocusScope();
    const candidates = getFocusableElements(scope);
    if (candidates.length === 0) return;

    const current = document.activeElement;
    if (!current || !scope.contains(current) || current === document.body) {
      const preferred =
        scope === document.body
          ? el.mediaGrid.querySelector(".card") || candidates[0]
          : el.fullTabLink || candidates[0];
      focusElement(preferred);
      return;
    }

    const currRect = current.getBoundingClientRect();
    const currX = currRect.left + currRect.width / 2;
    const currY = currRect.top + currRect.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const cand of candidates) {
      if (cand === current) continue;
      const r = cand.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const dx = x - currX;
      const dy = y - currY;

      let primary = 0;
      let cross = 0;

      if (dir === "right") {
        if (dx <= 6) continue;
        primary = dx;
        cross = Math.abs(dy);
      } else if (dir === "left") {
        if (dx >= -6) continue;
        primary = -dx;
        cross = Math.abs(dy);
      } else if (dir === "down") {
        if (dy <= 6) continue;
        primary = dy;
        cross = Math.abs(dx);
      } else if (dir === "up") {
        if (dy >= -6) continue;
        primary = -dy;
        cross = Math.abs(dx);
      }

      // Strongly favor items aligned on the same row/column
      const score = primary + cross * 2.4;
      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (best) {
      focusElement(best);
    }
  }

  function focusElement(node) {
    if (!node || typeof node.focus !== "function") return;
    node.focus({ preventScroll: false });
    try {
      node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    } catch {
      node.scrollIntoView(false);
    }
  }

  function focusFirstCard() {
    const firstCard = el.mediaGrid.querySelector(".card");
    if (firstCard) {
      focusElement(firstCard);
    }
  }

  // ===== Repo playlist.json Loader =====
  async function loadPlaylist(silentIfMissing = false) {
    try {
      const res = await fetch(`./playlist.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.status === 404) {
        if (!silentIfMissing) {
          showStatus("playlist.json not found in repository root.", "info");
        }
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let data;
      try {
        data = await res.json();
      } catch {
        showStatus("Invalid JSON syntax in playlist.json. Check commas and quotes.", "error");
        return;
      }

      const rawItems = Array.isArray(data) ? data : data.items || [];
      const title = (!Array.isArray(data) && data.title) || "Library";
      const items = normalizePlaylistItems(rawItems);

      state.breadcrumbs = [{ id: null, name: title, playlistItems: items }];
      renderPlaylistView(items);
    } catch (err) {
      if (!silentIfMissing) {
        showStatus(`Could not load playlist.json (${err.message}).`, "error");
      }
    }
  }

  function normalizePlaylistItems(rawItems) {
    const validTypes = new Set(["folder", "video", "image", "audio", "other"]);
    const result = [];

    for (const entry of rawItems) {
      if (!entry || typeof entry !== "object") continue;

      if (entry.type === "folder" || Array.isArray(entry.items)) {
        const children = normalizePlaylistItems(entry.items || []);
        result.push({
          id: entry.id || `pl_${result.length}`,
          name: entry.name || "Untitled Folder",
          type: "folder",
          size: entry.size || `${children.length} ${children.length === 1 ? "item" : "items"}`,
          thumb: entry.thumb || entry.poster || "",
          playlistItems: children,
        });
        continue;
      }

      const id = extractDriveFileId(entry.id || entry.url || "");
      if (!id) continue;

      const name = entry.name || "Untitled";
      let type = validTypes.has(entry.type) ? entry.type : detectMediaType(name, "", "");
      if (!entry.type && type === "other" && !/\.[a-z0-9]{2,5}$/i.test(name)) {
        type = "video";
      }

      result.push({
        id,
        name,
        type,
        size: entry.size || "",
        thumb: entry.thumb || entry.poster || "",
      });
    }

    return result;
  }

  function extractDriveFileId(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    const match =
      str.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ||
      str.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{15,}$/.test(str)) return str;
    return null;
  }

  function openPlaylistFolder(folderItem) {
    state.breadcrumbs.push({
      id: null,
      name: folderItem.name,
      playlistItems: folderItem.playlistItems,
    });
    pushSubfolderHistory();
    renderPlaylistView(folderItem.playlistItems);
  }

  function renderPlaylistView(items) {
    state.currentFolderId = null;
    state.nativeMode = false;
    resetFiltersUI();

    el.nativeContainer.classList.add("hidden");
    el.nativeIframe.src = "";
    el.mediaGrid.classList.remove("hidden");
    el.toolbar.classList.remove("hidden");
    if (el.toolbarBottom) el.toolbarBottom.classList.remove("hidden");
    el.nativeFallbackBtn.classList.add("hidden");

    renderBreadcrumbs();
    state.items = sortItems(items);
    hideStatus();
    applyFiltersAndRender(true);
  }

  function navigateToBreadcrumb(idx) {
    const target = state.breadcrumbs[idx];
    if (!target) return;
    state.breadcrumbs = state.breadcrumbs.slice(0, idx + 1);
    if (Array.isArray(target.playlistItems)) {
      renderPlaylistView(target.playlistItems);
    } else if (state.nativeMode) {
      openNativeGrid(target.id, false);
    } else {
      loadCustomGrid(target.id, false);
    }
  }

  function goBackFolder(fromPopstate = false) {
    if (state.breadcrumbs.length <= 1) return;
    state.breadcrumbs.pop();
    const parent = state.breadcrumbs[state.breadcrumbs.length - 1];

    if (!fromPopstate && state.subfolderHistoryDepth > 0) {
      state.subfolderHistoryDepth--;
      popHistorySilently();
    }

    if (Array.isArray(parent.playlistItems)) {
      renderPlaylistView(parent.playlistItems);
    } else if (state.nativeMode) {
      openNativeGrid(parent.id, false);
    } else {
      loadCustomGrid(parent.id, false);
    }
  }

  function pushSubfolderHistory() {
    try {
      window.history.pushState({ gstreamsFolder: state.breadcrumbs.length }, "");
      state.subfolderHistoryDepth++;
    } catch {}
  }

  function popHistorySilently() {
    try {
      state.ignoringPopstate = true;
      window.history.back();
      setTimeout(() => {
        state.ignoringPopstate = false;
      }, 250);
    } catch {
      state.ignoringPopstate = false;
    }
  }

  function resetFiltersUI() {
    state.activeFilter = "all";
    state.searchQuery = "";
    el.searchInput.value = "";
    el.filterTabs.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.filter === "all");
    });
  }

  // ===== Direct Link / Folder Handling =====
  function hasCustomBackend() {
    return Boolean(
      state.settings.appsScriptUrl ||
      state.settings.workerUrl ||
      state.settings.apiKey
    );
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
      openMediaModal({ id: parsed.id, name: "Drive File", type: "video" });
      return;
    }

    openRootFolder(parsed.id);
  }

  function openRootFolder(folderId, label = "Folder") {
    state.breadcrumbs = [{ id: folderId, name: label }];
    state.subfolderHistoryDepth = 0;
    updateUrlQuery("folder", folderId);

    if (hasCustomBackend()) {
      loadCustomGrid(folderId, true);
    } else {
      openNativeGrid(folderId, true, label);
    }
  }

  function openSubfolder(folderId, folderName) {
    state.breadcrumbs.push({ id: folderId, name: folderName });
    pushSubfolderHistory();
    loadCustomGrid(folderId, false);
  }

  function openNativeGrid(folderId, saveToRecent = false, label = null) {
    state.currentFolderId = folderId;
    state.nativeMode = true;

    hideStatus();
    el.toolbar.classList.remove("hidden");
    if (el.toolbarBottom) el.toolbarBottom.classList.add("hidden");
    el.mediaGrid.classList.add("hidden");
    el.nativeContainer.classList.remove("hidden");
    el.nativeFallbackBtn.classList.remove("hidden");
    el.nativeFallbackBtn.textContent = "Custom Grid";

    renderBreadcrumbs();
    el.nativeIframe.src = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`;

    if (saveToRecent) {
      addRecent(folderId, label && label !== "Folder" ? label : `Folder ${folderId.slice(0, 6)}`);
    }
  }

  async function loadCustomGrid(folderId, saveToRecent = false) {
    state.currentFolderId = folderId;
    state.nativeMode = false;
    resetFiltersUI();

    el.nativeContainer.classList.add("hidden");
    el.nativeIframe.src = "";
    el.mediaGrid.classList.remove("hidden");
    el.toolbar.classList.remove("hidden");
    if (el.toolbarBottom) el.toolbarBottom.classList.remove("hidden");
    el.nativeFallbackBtn.classList.remove("hidden");
    el.nativeFallbackBtn.textContent = "Native Grid";
    renderBreadcrumbs();

    const cached = readCache(folderId);
    if (cached) {
      applyFolderResult(folderId, cached, saveToRecent);
      return;
    }

    showStatus("Loading custom grid...", "info");
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

      if (result.items.length > 0) writeCache(folderId, result);
      applyFolderResult(folderId, result, saveToRecent);
    } catch (err) {
      console.error(err);

      if (err.isPrivate) {
        showStatus(err.message, "error");
        return;
      }

      openNativeGrid(folderId, saveToRecent);
      showStatus("Public proxy unavailable — using Native Grid.", "info");
    }
  }

  function applyFolderResult(folderId, result, saveToRecent) {
    if (result.folderName && state.breadcrumbs.length > 0) {
      state.breadcrumbs[state.breadcrumbs.length - 1].name = result.folderName;
      renderBreadcrumbs();
    }

    if (saveToRecent) {
      addRecent(folderId, result.folderName || `Folder ${folderId.slice(0, 6)}`);
    }

    state.items = sortItems(result.items);
    hideStatus();
    applyFiltersAndRender(true);
  }

  async function fetchViaEmbeddedScrape(folderId) {
    const targetUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
    let html = null;

    if (state.settings.workerUrl) {
      const base = state.settings.workerUrl;
      const proxyUrl = base.includes("=")
        ? `${base}${encodeURIComponent(targetUrl)}`
        : `${base}?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetchWithTimeout(proxyUrl, 5000);
      if (res.ok) {
        const text = await res.text();
        if (isValidDriveHtml(text)) html = text;
      }
    }

    if (!html) {
      try {
        html = await raceSuccess(
          PUBLIC_RELAYS.map(async (relay) => {
            const text = await relay(targetUrl, 4000);
            if (!isValidDriveHtml(text)) throw new Error("Invalid Drive HTML");
            return text;
          })
        );
      } catch {
        throw new Error("Public relays timed out.");
      }
    }

    if (
      html.includes("accounts.google.com/ServiceLogin") ||
      html.includes("You need access") ||
      /<title>\s*Sign in/i.test(html)
    ) {
      const err = new Error("Folder is private. Set sharing to 'Anyone with the link (Viewer)'.");
      err.isPrivate = true;
      throw err;
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const rawTitle = (doc.querySelector("title")?.textContent || "")
      .replace(/\s*-\s*Google Drive$/i, "")
      .trim();

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

  function raceSuccess(promises) {
    return new Promise((resolve, reject) => {
      let pending = promises.length;
      if (pending === 0) {
        reject(new Error("No relays configured"));
        return;
      }
      promises.forEach((p) => {
        Promise.resolve(p).then(resolve, () => {
          pending -= 1;
          if (pending === 0) reject(new Error("All relays failed"));
        });
      });
    });
  }

  function isValidDriveHtml(text) {
    if (!text || text.length < 150) return false;
    return (
      text.includes("flip-entry") ||
      text.includes("drive.google.com") ||
      text.includes("accounts.google.com/ServiceLogin") ||
      text.includes("You need access")
    );
  }

  function extractEntryFromHref(href, name, iconSrc) {
    const fileMatch = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch =
      href.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
      href.match(/folderview\?id=([a-zA-Z0-9_-]+)/);

    if (folderMatch) {
      return { id: folderMatch[1], name: name || "Untitled Folder", type: "folder", size: "" };
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
    const res = await fetchWithTimeout(`${scriptUrl}${sep}id=${encodeURIComponent(folderId)}`, 10000);
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

    const res = await fetchWithTimeout(url, 8000);
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

  // ===== Filtering & Grid Rendering =====
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

  function applyFiltersAndRender(autoFocus = false) {
    state.filteredItems = state.items.filter((item) => {
      const matchType = state.activeFilter === "all" || item.type === state.activeFilter;
      const matchSearch = !state.searchQuery || item.name.toLowerCase().includes(state.searchQuery);
      return matchType && matchSearch;
    });

    renderGrid();

    if (autoFocus && document.body.classList.contains("using-remote")) {
      focusFirstCard();
    }
  }

  function renderGrid() {
    if (state.filteredItems.length === 0) {
      el.mediaGrid.innerHTML = `<div class="empty-state">No files found.</div>`;
      return;
    }

    el.mediaGrid.innerHTML = state.filteredItems
      .map((item, idx) => {
        const showThumb = Boolean(item.thumb) || item.type === "video" || item.type === "image";
        const thumbUrl =
          item.thumb ||
          `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w500`;
        const icon = ICONS[item.type] || ICONS.other;

        return `
          <article class="card" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}" data-idx="${idx}">
            <div class="thumb-wrap">
              ${
                showThumb
                  ? `<img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';" />
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

  // ===== Media Player Modal =====
  function openMediaModal(item) {
    const wasHidden = el.playerModal.classList.contains("hidden");
    if (wasHidden) {
      state.lastFocusedEl = document.activeElement;
      try {
        window.history.pushState({ gstreamsModal: "player" }, "");
        state.playerHistoryActive = true;
      } catch {}
    }

    state.activeMedia = item;
    state.videoMode = "preview";

    const id = encodeURIComponent(item.id);
    el.playerTitle.textContent = item.name;
    el.playerBadge.textContent = item.type.toUpperCase();
    el.openDriveLink.href = `https://drive.google.com/file/d/${id}/view`;
    el.downloadLink.href = `https://drive.google.com/uc?export=download&id=${id}`;

    if (el.fullTabLink) {
      el.fullTabLink.href =
        item.type === "image"
          ? `https://drive.google.com/thumbnail?id=${id}&sz=w2400`
          : `https://drive.google.com/file/d/${id}/preview`;
    }

    el.videoModeGroup.classList.toggle("hidden", item.type !== "video");

    const playable = getPlayableSiblings();
    el.navGroup.classList.toggle("hidden", playable.length <= 1);

    renderPlayerStage();
    el.playerModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (wasHidden) {
      focusElement(el.fullTabLink || el.closePlayerBtn);
    }
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

  function closePlayerModal(fromPopstate = false) {
    el.playerStage.innerHTML = "";
    el.playerModal.classList.add("hidden");
    state.activeMedia = null;
    document.body.style.overflow = "";

    if (!fromPopstate && state.playerHistoryActive) {
      state.playerHistoryActive = false;
      popHistorySilently();
    } else {
      state.playerHistoryActive = false;
    }

    if (state.lastFocusedEl && document.body.contains(state.lastFocusedEl)) {
      focusElement(state.lastFocusedEl);
    } else if (document.body.classList.contains("using-remote")) {
      focusFirstCard();
    }
    state.lastFocusedEl = null;
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

  // ===== Cache, Recents & Settings =====
  function readCache(folderId) {
    try {
      const raw = sessionStorage.getItem(`gstreams_cache_${folderId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > 5 * 60 * 1000) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  function writeCache(folderId, data) {
    try {
      sessionStorage.setItem(`gstreams_cache_${folderId}`, JSON.stringify({ ts: Date.now(), data }));
    } catch {}
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
    state.lastFocusedEl = document.activeElement;
    populateSettingsInputs();
    el.settingsModal.classList.remove("hidden");
    try {
      window.history.pushState({ gstreamsModal: "settings" }, "");
      state.settingsHistoryActive = true;
    } catch {}
    focusElement(el.appsScriptInput);
  }

  function closeSettingsModal(fromPopstate = false) {
    el.settingsModal.classList.add("hidden");
    if (!fromPopstate && state.settingsHistoryActive) {
      state.settingsHistoryActive = false;
      popHistorySilently();
    } else {
      state.settingsHistoryActive = false;
    }
    if (state.lastFocusedEl && document.body.contains(state.lastFocusedEl)) {
      focusElement(state.lastFocusedEl);
    }
    state.lastFocusedEl = null;
  }

  function saveSettingsFromUI() {
    state.settings = {
      appsScriptUrl: el.appsScriptInput.value.trim(),
      workerUrl: el.workerInput.value.trim(),
      apiKey: el.apiKeyInput.value.trim(),
    };
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
    sessionStorage.clear();
    closeSettingsModal(false);
    showStatus("Settings saved.", "info");
    if (state.currentFolderId) {
      if (hasCustomBackend()) {
        loadCustomGrid(state.currentFolderId, false);
      } else {
        openNativeGrid(state.currentFolderId, false);
      }
    }
  }

  // ===== Utilities =====
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

  function clearUrlQuery() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("folder");
      url.searchParams.delete("file");
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