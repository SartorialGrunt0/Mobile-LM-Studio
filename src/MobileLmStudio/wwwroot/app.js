const state = {
  bootstrap: null,
  models: [],
  chats: [],
  mcpServers: [],
  currentChatId: null,
  currentChat: null,
  selectedModel: "",
  selectedReasoning: "default",
  defaultMcpServerIds: normalizeSelectedMcpServerIds(loadDefaultMcpServerIds()),
  selectedMcpServerIds: new Set(),
  chatOverrideDraft: null,
  enterKeyBehavior: loadEnterKeyBehavior(),
  chatToolsPopupOpen: false,
  selectedContextLength: "",
  selectedTemperature: "",
  selectedTopK: "",
  selectedTopP: "",
  selectedMinP: "",
  selectedRepeatPenalty: "",
  systemPrompt: "",
  adaptiveMemory: {
    enabled: false,
    maxWords: 500,
    summary: "",
    lastUpdatedUtc: "",
    lastReviewedUtc: "",
    sourceCursorUtc: "",
  },
  statusText: "Ready",
  statusTone: "neutral",
  isSending: false,
  isModelLoading: false,
  isDictating: false,
  speechRecognition: null,
  speakingMessageId: null,
  modelLoadTarget: "",
  theme: "light",
  composerAttachments: [],
  configBannerDismissed: loadBannerDismissal(),
  confirmDialog: null,
  pendingStreamRecoveryChatId: null,
  stickToBottom: true,
  editingMessageId: null,
  editDraftContent: "",
  chatFontScale: 1,
  topBarActionsExpanded: false,
  autoScrollEnabled: loadAutoScrollPreference(),
  contextLengthManual: false,
  pendingScrollFrame: 0,
  modelLoadMode: "load",
  serverStreamPollTimer: null,
  serverStreamPollChatId: null,
  streamingChatIds: new Set(),
  streamControllers: new Map(),
  currentStreamController: null,
  currentStreamChatId: null,
  modelControlSnapshot: null,
  modelControlErrors: {},
  editingChatTitleId: null,
  editingChatTitleDraft: "",
};

const elements = {
  topBar: document.querySelector(".top-bar"),
  chatDrawer: document.getElementById("chat-drawer"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  drawerToggle: document.getElementById("drawer-toggle"),
  drawerClose: document.getElementById("drawer-close"),
  chatList: document.getElementById("chat-list"),
  newChatButton: document.getElementById("new-chat-button"),
  connectionPill: document.getElementById("connection-pill"),
  topBarActions: document.getElementById("top-bar-actions"),
  topActionsToggle: document.getElementById("top-actions-toggle"),
  modelButton: document.getElementById("model-button"),
  topToolsButton: document.getElementById("top-tools-button"),
  themeButton: document.getElementById("theme-button"),
  settingsButton: document.getElementById("settings-button"),
  chatOverrideButton: document.getElementById("chat-override-button"),
  logoutButton: document.getElementById("logout-button"),
  configBanner: document.getElementById("config-banner"),
  configBannerText: document.getElementById("config-banner-text"),
  configBannerDismiss: document.getElementById("config-banner-dismiss"),
  chatToolbar: document.getElementById("chat-toolbar"),
  currentChatTitle: document.getElementById("current-chat-title"),
  exportChatButton: document.getElementById("export-chat-button"),
  deleteChatButton: document.getElementById("delete-chat-button"),
  autoScrollButton: document.getElementById("auto-scroll-button"),
  modelSelect: document.getElementById("model-select"),
  loadModelButton: document.getElementById("load-model-button"),
  unloadModelButton: document.getElementById("unload-model-button"),
  contextLengthInput: document.getElementById("context-length-input"),
  temperatureInput: document.getElementById("temperature-input"),
  topKInput: document.getElementById("top-k-input"),
  topPInput: document.getElementById("top-p-input"),
  minPInput: document.getElementById("min-p-input"),
  repeatPenaltyInput: document.getElementById("repeat-penalty-input"),
  reasoningSelect: document.getElementById("reasoning-select"),
  systemPromptInput: document.getElementById("system-prompt-input"),
  modelAdvancedPanel: document.getElementById("model-advanced-panel"),
  modelToolsSection: document.getElementById("model-tools-section"),
  modelMeta: document.getElementById("model-meta"),
  mcpList: document.getElementById("mcp-list"),
  statusBar: document.getElementById("status-bar"),
  messageScroll: document.getElementById("message-scroll"),
  emptyState: document.getElementById("empty-state"),
  messageList: document.getElementById("message-list"),
  composerForm: document.getElementById("composer-form"),
  composerAttachments: document.getElementById("composer-attachments"),
  composerContextMeter: document.getElementById("composer-context-meter"),
  attachButton: document.getElementById("attach-button"),
  speechInputButton: document.getElementById("speech-input-button"),
  fileInput: document.getElementById("file-input"),
  messageInput: document.getElementById("message-input"),
  sendButton: document.getElementById("send-button"),
  loginScreen: document.getElementById("login-screen"),
  loginForm: document.getElementById("login-form"),
  loginPinInput: document.getElementById("login-pin-input"),
  loginError: document.getElementById("login-error"),
  modelScreen: document.getElementById("model-screen"),
  modelCloseButton: document.getElementById("model-close-button"),
  modelRefreshButton: document.getElementById("model-refresh-button"),
  modelResetButton: document.getElementById("model-reset-button"),
  modelSaveButton: document.getElementById("model-save-button"),
  defaultToolsScreen: document.getElementById("default-tools-screen"),
  defaultToolsCloseButton: document.getElementById("default-tools-close-button"),
  defaultToolsMcpList: document.getElementById("default-tools-mcp-list"),
  settingsScreen: document.getElementById("settings-screen"),
  settingsForm: document.getElementById("settings-form"),
  settingsCloseButton: document.getElementById("settings-close-button"),
  settingsBaseUrl: document.getElementById("settings-base-url"),
  settingsApiToken: document.getElementById("settings-api-token"),
  settingsMcpPath: document.getElementById("settings-mcp-path"),
  settingsMcpUpload: document.getElementById("settings-mcp-upload"),
  settingsMcpUploadButton: document.getElementById("settings-mcp-upload-button"),
  settingsMcpUploadName: document.getElementById("settings-mcp-upload-name"),
  settingsChatFontScale: document.getElementById("settings-chat-font-scale"),
  settingsThemeButton: document.getElementById("settings-theme-button"),
  settingsAutoScrollButton: document.getElementById("settings-auto-scroll-button"),
  settingsAdaptiveMemoryEnabled: document.getElementById("settings-adaptive-memory-enabled"),
  settingsAdaptiveMemoryMaxWords: document.getElementById("settings-adaptive-memory-max-words"),
  settingsDownloadMemoryButton: document.getElementById("settings-download-memory-button"),
  settingsRequireLogin: document.getElementById("settings-require-login"),
  settingsPin: document.getElementById("settings-pin"),
  settingsPinHint: document.getElementById("settings-pin-hint"),
  settingsSaveButton: document.getElementById("settings-save-button"),
  settingsCancelButton: document.getElementById("settings-cancel-button"),
  settingsStatus: document.getElementById("settings-status"),
  settingsEnterKeyBehavior: document.getElementById("settings-enter-key-behavior"),
  chatToolsButton: document.getElementById("chat-tools-button"),
  chatToolsPopup: document.getElementById("chat-tools-popup"),
  chatToolsMcpList: document.getElementById("chat-tools-mcp-list"),
  chatOverrideScreen: document.getElementById("chat-override-screen"),
  chatOverrideForm: document.getElementById("chat-override-form"),
  chatOverrideCloseButton: document.getElementById("chat-override-close-button"),
  chatOverrideSystemPromptInput: document.getElementById("chat-override-system-prompt-input"),
  chatOverrideReasoningSelect: document.getElementById("chat-override-reasoning-select"),
  chatOverrideTemperatureInput: document.getElementById("chat-override-temperature-input"),
  chatOverrideTopKInput: document.getElementById("chat-override-top-k-input"),
  chatOverrideTopPInput: document.getElementById("chat-override-top-p-input"),
  chatOverrideMinPInput: document.getElementById("chat-override-min-p-input"),
  chatOverrideRepeatPenaltyInput: document.getElementById("chat-override-repeat-penalty-input"),
  chatOverrideMcpList: document.getElementById("chat-override-mcp-list"),
  chatOverrideResetButton: document.getElementById("chat-override-reset-button"),
  chatOverrideSaveButton: document.getElementById("chat-override-save-button"),
  confirmScreen: document.getElementById("confirm-screen"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmAcceptButton: document.getElementById("confirm-accept-button"),
  confirmCancelButton: document.getElementById("confirm-cancel-button"),
};

const desktopLayoutMedia = window.matchMedia("(min-width: 960px)");
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const ESTIMATED_CHARS_PER_TOKEN = 4;
const ESTIMATED_MESSAGE_OVERHEAD_TOKENS = 6;
const ESTIMATED_SYSTEM_PROMPT_OVERHEAD_TOKENS = 8;
const ESTIMATED_TOOL_CALL_OVERHEAD_TOKENS = 10;
const ESTIMATED_IMAGE_ATTACHMENT_TOKENS = 256;

applyTheme(loadThemePreference());
renderActionIcons();
bindEvents();
renderConfirmDialog();
void initialize();

async function initialize() {
  autoResizeComposer();

  try {
    await refreshBootstrap();
    // Auto-lock on page reload when a PIN is configured
    if (state.bootstrap.requireLogin && state.bootstrap.authenticated) {
      try {
        const resp = await fetchJson("/api/auth/logout", { method: "POST", suppressAuthRedirect: true });
        state.bootstrap = { ...state.bootstrap, requireLogin: resp.requireLogin, authenticated: resp.authenticated };
      } catch { }
    } else if (state.bootstrap.authenticated) {
      const warnings = await loadAuthenticatedData();
      if (warnings.length === 0 && !state.serverStreamPollTimer) {
        setStatus("Ready", "neutral");
      }
    }
  } catch (error) {
    setStatus(error.message || "Unable to connect.", "error");
  }

  render();
}

function bindEvents() {
  elements.drawerToggle.addEventListener("click", () => {
    collapseTopBarActions();
    setDrawerOpen(true);
  });
  elements.drawerClose.addEventListener("click", () => setDrawerOpen(false));
  elements.drawerBackdrop.addEventListener("click", () => setDrawerOpen(false));
  elements.topActionsToggle?.addEventListener("click", event => {
    event.stopPropagation();
    toggleTopBarActions();
  });
  elements.topBarActions?.addEventListener("click", event => {
    event.stopPropagation();
  });
  if (typeof desktopLayoutMedia.addEventListener === "function") {
    desktopLayoutMedia.addEventListener("change", syncTopBarActionsLayout);
  } else if (typeof desktopLayoutMedia.addListener === "function") {
    desktopLayoutMedia.addListener(syncTopBarActionsLayout);
  }
  document.addEventListener("click", event => {
    if (state.chatToolsPopupOpen) {
      if (!elements.chatToolsButton?.contains(event.target) && !elements.chatToolsPopup?.contains(event.target)) {
        closeChatToolsPopup();
      }
    }

    if (!state.topBarActionsExpanded || isDesktopLayout()) {
      return;
    }

    if (elements.topBar?.contains(event.target) || elements.topBarActions?.contains(event.target)) {
      return;
    }

    collapseTopBarActions();
  });

  elements.modelButton.addEventListener("click", () => openModelMenu());
  elements.topToolsButton?.addEventListener("click", () => openDefaultToolsMenu());
  elements.modelCloseButton.addEventListener("click", () => closeModelMenu());
  elements.modelScreen.addEventListener("click", event => {
    if (event.target === elements.modelScreen) {
      closeModelMenu();
    }
  });
  elements.defaultToolsCloseButton?.addEventListener("click", () => closeDefaultToolsMenu());
  elements.defaultToolsScreen?.addEventListener("click", event => {
    if (event.target === elements.defaultToolsScreen) {
      closeDefaultToolsMenu();
    }
  });
  elements.themeButton.addEventListener("click", () => toggleTheme());
  elements.newChatButton.addEventListener("click", () => {
    collapseTopBarActions();
    startNewDraft({ resetConversationSettings: true });
    clearComposerDraft();
    setStatus("Ready", "neutral");
    render();
    syncMessageScroll(true);
    setDrawerOpen(false);
  });
  elements.configBannerDismiss?.addEventListener("click", () => dismissConfigBanner());
  elements.messageScroll.addEventListener("scroll", () => updateStickToBottom());
  elements.messageList.addEventListener("load", event => handleDeferredMediaLoad(event), true);
  elements.composerAttachments.addEventListener("load", event => handleDeferredMediaLoad(event), true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void recoverInterruptedStream();
    }
  });
  window.addEventListener("focus", () => {
    void recoverInterruptedStream();
  });
  window.addEventListener("pageshow", () => {
    void recoverInterruptedStream();
  });
  window.addEventListener("load", () => renderMathInMarkdown(elements.messageList));

  elements.chatList.addEventListener("click", event => {
    const renameButton = event.target.closest("button[data-rename-chat-id]");
    if (renameButton?.dataset.renameChatId) {
      startRenameChat(renameButton.dataset.renameChatId);
      return;
    }

    const cancelRenameButton = event.target.closest("button[data-cancel-rename-chat-id]");
    if (cancelRenameButton?.dataset.cancelRenameChatId) {
      cancelRenameChat(cancelRenameButton.dataset.cancelRenameChatId);
      return;
    }

    const deleteButton = event.target.closest("button[data-delete-chat-id]");
    if (deleteButton?.dataset.deleteChatId) {
      promptDeleteChat(deleteButton.dataset.deleteChatId);
      return;
    }

    const button = event.target.closest("button[data-chat-id]");
    if (!button) {
      return;
    }

    void openChat(button.dataset.chatId);
  });

  elements.chatList.addEventListener("input", event => {
    const renameInput = event.target.closest("input[data-rename-chat-input]");
    if (!renameInput?.dataset.renameChatInput) {
      return;
    }

    if (state.editingChatTitleId === renameInput.dataset.renameChatInput) {
      state.editingChatTitleDraft = renameInput.value;
    }
  });

  elements.chatList.addEventListener("keydown", event => {
    const renameInput = event.target.closest("input[data-rename-chat-input]");
    if (!renameInput?.dataset.renameChatInput) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRenameChat(renameInput.dataset.renameChatInput);
    }
  });

  elements.chatList.addEventListener("submit", event => {
    const renameForm = event.target.closest("form[data-rename-chat-form]");
    if (!renameForm?.dataset.renameChatForm) {
      return;
    }

    event.preventDefault();
    void saveRenamedChat(renameForm.dataset.renameChatForm);
  });

  elements.messageList.addEventListener("click", event => {
    const retryButton = event.target.closest("button[data-retry-chat]");
    if (retryButton) {
      void retryLatestPrompt();
      return;
    }

    const copyCodeButton = event.target.closest("button[data-copy-code-block]");
    if (copyCodeButton) {
      void copyCodeBlockRaw(copyCodeButton);
      return;
    }

    const copyButton = event.target.closest("button[data-copy-message-id]");
    if (copyButton?.dataset.copyMessageId) {
      void copyMessageMarkdown(copyButton.dataset.copyMessageId);
      return;
    }

    const speakButton = event.target.closest("button[data-speak-message-id]");
    if (speakButton?.dataset.speakMessageId) {
      toggleMessageSpeech(speakButton.dataset.speakMessageId);
      return;
    }

    const exportButton = event.target.closest("button[data-export-message-id]");
    if (exportButton?.dataset.exportMessageId) {
      void exportMessage(exportButton.dataset.exportMessageId);
      return;
    }

    const editButton = event.target.closest("button[data-edit-message-id]");
    if (editButton?.dataset.editMessageId) {
      startEditMessage(editButton.dataset.editMessageId);
      return;
    }

    const cancelEditButton = event.target.closest("button[data-cancel-edit]");
    if (cancelEditButton) {
      cancelEditMessage();
      return;
    }

    const saveEditButton = event.target.closest("button[data-save-edit]");
    if (saveEditButton) {
      const textarea = elements.messageList.querySelector(".message-edit-textarea");
      const content = textarea ? textarea.value.trim() : state.editDraftContent.trim();
      void saveAndRegenerateMessage(state.editingMessageId, content);
      return;
    }
  });

  elements.composerAttachments.addEventListener("click", event => {
    const removeAttachmentButton = event.target.closest("button[data-remove-attachment-index]");
    if (removeAttachmentButton?.dataset.removeAttachmentIndex) {
      removeComposerAttachment(Number.parseInt(removeAttachmentButton.dataset.removeAttachmentIndex, 10));
    }
  });

  elements.mcpList?.addEventListener("click", event => {
    const button = event.target.closest("button[data-mcp-id]");
    if (!button) {
      return;
    }

    const { mcpId } = button.dataset;
    if (!mcpId) {
      return;
    }

    toggleDefaultMcpServer(mcpId);
    renderMcpServers();
    renderDefaultToolsMenu();
    renderChatToolsButton();
  });

  elements.defaultToolsMcpList?.addEventListener("click", event => {
    const button = event.target.closest("button[data-mcp-id]");
    if (!button?.dataset.mcpId) {
      return;
    }

    toggleDefaultMcpServer(button.dataset.mcpId);
    renderDefaultToolsMenu();
    renderMcpServers();
    renderChatToolsButton();
    if (!elements.chatOverrideScreen?.hidden) {
      renderChatOverrideMenu();
    }
  });

  elements.chatToolsButton?.addEventListener("click", event => {
    event.stopPropagation();
    toggleChatToolsPopup();
  });

  elements.chatToolsMcpList?.addEventListener("click", event => {
    const button = event.target.closest("button[data-mcp-id]");
    if (!button) {
      return;
    }

    const { mcpId } = button.dataset;
    if (!mcpId) {
      return;
    }

    toggleActiveMcpServer(mcpId);

    renderChatToolsPopup();
    renderChatToolsButton();
    if (!elements.chatOverrideScreen?.hidden) {
      renderChatOverrideMenu();
    }
    void persistCurrentChatOverrides({ silent: true, rerender: false });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.chatToolsPopupOpen) {
      closeChatToolsPopup();
      return;
    }

    if (event.key === "Escape" && !elements.modelScreen?.hidden) {
      closeModelMenu();
      return;
    }

    if (event.key === "Escape" && !elements.chatOverrideScreen?.hidden) {
      closeChatOverrideMenu();
      return;
    }

    if (event.key === "Escape" && !elements.defaultToolsScreen?.hidden) {
      closeDefaultToolsMenu();
    }
  });

  elements.modelSelect.addEventListener("change", () => {
    const previousModel = findSelectedModel();
    const shouldFollowSuggestion = shouldUseSuggestedContext(previousModel);
    state.selectedModel = elements.modelSelect.value;
    if (shouldFollowSuggestion) {
      applySuggestedContextLength(findSelectedModel());
    }
    normalizeReasoningSelection();
    renderControls();
  });

  elements.contextLengthInput.addEventListener("input", () => {
    syncContextLengthInput(elements.contextLengthInput.value.trim());
    renderModelDetails();
    updateModelControlValidation();
  });

  elements.temperatureInput?.addEventListener("input", () => {
    state.selectedTemperature = elements.temperatureInput.value.trim();
    updateModelControlValidation();
  });

  elements.topKInput?.addEventListener("input", () => {
    state.selectedTopK = elements.topKInput.value.trim();
    updateModelControlValidation();
  });

  elements.topPInput?.addEventListener("input", () => {
    state.selectedTopP = elements.topPInput.value.trim();
    updateModelControlValidation();
  });

  elements.minPInput?.addEventListener("input", () => {
    state.selectedMinP = elements.minPInput.value.trim();
    updateModelControlValidation();
  });

  elements.repeatPenaltyInput?.addEventListener("input", () => {
    state.selectedRepeatPenalty = elements.repeatPenaltyInput.value.trim();
    updateModelControlValidation();
  });

  elements.reasoningSelect.addEventListener("change", () => {
    state.selectedReasoning = elements.reasoningSelect.value;
  });

  elements.systemPromptInput.addEventListener("input", () => {
    state.systemPrompt = elements.systemPromptInput.value;
  });

  elements.sendButton.addEventListener("click", event => {
    if (isCurrentChatActivelyStreaming()) {
      event.preventDefault();
      stopStream();
    }
  });

  elements.composerForm.addEventListener("submit", event => {
    event.preventDefault();
    void sendMessage();
  });

  elements.attachButton.addEventListener("click", () => elements.fileInput.click());
  elements.speechInputButton?.addEventListener("click", () => void toggleSpeechInput());
  elements.fileInput.addEventListener("change", event => {
    void addComposerAttachments(event.target.files, "file");
    event.target.value = "";
  });
  elements.settingsMcpUploadButton?.addEventListener("click", () => elements.settingsMcpUpload?.click());
  elements.settingsMcpUpload?.addEventListener("change", () => renderSelectedMcpConfigLabel());

  elements.messageInput.addEventListener("input", autoResizeComposer);
  elements.messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      if (state.enterKeyBehavior !== "newline") {
        event.preventDefault();
        void sendMessage();
      }
    }
  });

  elements.loadModelButton.addEventListener("click", () => void loadSelectedModel());
  elements.unloadModelButton.addEventListener("click", () => void unloadSelectedModel());
  elements.modelRefreshButton?.addEventListener("click", () => void refreshModels());
  elements.modelResetButton?.addEventListener("click", () => resetModelMenu());
  elements.modelSaveButton?.addEventListener("click", () => void saveModelMenu());
  elements.exportChatButton.addEventListener("click", () => void exportCurrentChat());
  elements.deleteChatButton.addEventListener("click", () => promptDeleteChat(state.currentChatId));
  elements.autoScrollButton?.addEventListener("click", () => toggleAutoScroll());
  elements.logoutButton.addEventListener("click", () => void logout());

  elements.loginForm.addEventListener("submit", event => {
    event.preventDefault();
    void login();
  });

  elements.settingsCancelButton.addEventListener("click", () => closeSettings());
  elements.settingsCloseButton?.addEventListener("click", () => closeSettings());
  elements.settingsScreen.addEventListener("click", event => {
    if (event.target === elements.settingsScreen) {
      closeSettings();
    }
  });
  elements.settingsForm.addEventListener("submit", event => {
    event.preventDefault();
    void saveSettings();
  });
  elements.settingsRequireLogin?.addEventListener("change", () => renderSettingsSecurityState());
  elements.settingsAdaptiveMemoryEnabled?.addEventListener("change", () => renderAdaptiveMemorySettingsState());
  elements.settingsThemeButton?.addEventListener("click", () => toggleTheme());
  elements.settingsAutoScrollButton?.addEventListener("click", () => toggleAutoScroll());
  elements.settingsDownloadMemoryButton?.addEventListener("click", () => downloadAdaptiveMemoryFile());

  elements.settingsApiToken.addEventListener("focus", () => {
    elements.settingsApiToken.type = "text";
  });
  elements.settingsApiToken.addEventListener("blur", () => {
    if (elements.settingsApiToken.value) {
      elements.settingsApiToken.type = "password";
    }
  });
  elements.settingsApiToken.addEventListener("input", () => {
    elements.settingsApiToken.dataset.modified = "true";
  });

  elements.settingsButton.addEventListener("click", () => openSettings());
  elements.chatOverrideButton?.addEventListener("click", () => openChatOverrideMenu());
  elements.chatOverrideCloseButton?.addEventListener("click", () => closeChatOverrideMenu());
  elements.chatOverrideScreen?.addEventListener("click", event => {
    if (event.target === elements.chatOverrideScreen) {
      closeChatOverrideMenu();
    }
  });
  elements.chatOverrideResetButton?.addEventListener("click", () => resetChatOverrides());
  elements.chatOverrideForm?.addEventListener("submit", event => {
    event.preventDefault();
    void saveChatOverrides();
  });
  elements.chatOverrideMcpList?.addEventListener("click", event => {
    const button = event.target.closest("button[data-mcp-id]");
    if (!button?.dataset.mcpId) {
      return;
    }

    toggleActiveMcpServer(button.dataset.mcpId);
    renderChatOverrideMenu();
    renderChatToolsPopup();
    renderChatToolsButton();
  });
  elements.confirmCancelButton?.addEventListener("click", () => closeConfirmDialog());
  elements.confirmAcceptButton?.addEventListener("click", () => void confirmPendingAction());
  elements.confirmScreen?.addEventListener("click", event => {
    if (event.target === elements.confirmScreen) {
      closeConfirmDialog();
    }
  });
}

async function refreshBootstrap() {
  state.bootstrap = await fetchJson("/api/bootstrap", { suppressAuthRedirect: true });
  state.chatFontScale = normalizeChatFontScale(state.bootstrap?.chatFontScale);
  applyChatFontScale(state.chatFontScale);
}

async function loadAuthenticatedData() {
  const [modelsResult, chatsResult, mcpServersResult, chatDefaultsResult] = await Promise.allSettled([
    fetchJson("/api/models"),
    fetchJson("/api/chats"),
    fetchJson("/api/mcp/servers"),
    fetchJson("/api/chat-defaults"),
  ]);

  const warnings = [];

  if (modelsResult.status === "fulfilled") {
    state.models = modelsResult.value.models || [];
  } else {
    state.models = [];
    warnings.push(`LM Studio is unavailable: ${modelsResult.reason?.message || "Unable to load models."}`);
  }

  if (chatsResult.status === "fulfilled") {
    state.chats = chatsResult.value || [];
  } else {
    state.chats = [];
    warnings.push(chatsResult.reason?.message || "Unable to load chats.");
  }

  if (mcpServersResult.status === "fulfilled") {
    state.mcpServers = mcpServersResult.value || [];
  } else {
    state.mcpServers = [];
    warnings.push(mcpServersResult.reason?.message || "Unable to load MCP servers.");
  }

  if (chatDefaultsResult.status === "fulfilled") {
    applyChatDefaultsPayload(chatDefaultsResult.value);
  } else {
    warnings.push(chatDefaultsResult.reason?.message || "Unable to load saved model defaults.");
  }

  ensureSelectionDefaults();

  if (state.currentChatId) {
    try {
      await openChat(state.currentChatId, true);
    } catch (error) {
      warnings.push(error.message || "Unable to open the current chat.");
      startNewDraft({ resetConversationSettings: true });
      clearComposerDraft();
      render();
    }
  } else if (state.chats.length > 0) {
    try {
      await openChat(state.chats[0].id, true);
    } catch (error) {
      warnings.push(error.message || "Unable to open the latest chat.");
      startNewDraft({ resetConversationSettings: true });
      clearComposerDraft();
      render();
    }
  } else {
    startNewDraft({ resetConversationSettings: true });
    clearComposerDraft();
    render();
  }

  if (state.currentChatId) {
    try {
      const streamsData = await fetchJson("/api/chats/active-streams");
      if ((streamsData.chatIds || []).includes(state.currentChatId)) {
        startStreamWaitPolling(state.currentChatId);
      }
    } catch {
    }
  }

  if (warnings.length > 0) {
    setStatus(warnings[0], "error");
  }

  return warnings;
}

async function login() {
  elements.loginError.hidden = true;

  try {
    const response = await fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ pin: elements.loginPinInput.value }),
      suppressAuthRedirect: true,
    });

    state.bootstrap = {
      ...state.bootstrap,
      requireLogin: response.requireLogin,
      authenticated: response.authenticated,
    };

    elements.loginPinInput.value = "";
    render();

    const warnings = await loadAuthenticatedData();
    if (warnings.length === 0) {
      setStatus("Unlocked.", "neutral");
    }

    render();
  } catch (error) {
    elements.loginError.hidden = false;
    elements.loginError.textContent = error.message || "PIN was not accepted.";
  }
}

async function logout() {
  try {
    const response = await fetchJson("/api/auth/logout", {
      method: "POST",
      suppressAuthRedirect: true,
    });

    state.bootstrap = {
      ...state.bootstrap,
      requireLogin: response.requireLogin,
      authenticated: response.authenticated,
    };
    state.currentChatId = null;
    state.currentChat = null;
    setStatus("Locked.", "neutral");
    render();
  } catch (error) {
    setStatus(error.message || "Unable to lock the app.", "error");
  }
}

function ensureSelectionDefaults() {
  if (!state.selectedModel || !state.models.some(model => model.key === state.selectedModel)) {
    const loadedModel = state.models.find(model => (model.loadedInstances || []).length > 0);
    const firstChatModel = state.chats.find(chat => state.models.some(model => model.key === chat.modelKey));
    const firstLlm = state.models.find(model => model.type === "llm");
    state.selectedModel = loadedModel?.key || firstChatModel?.modelKey || firstLlm?.key || state.models[0]?.key || "";
  }

  if (!state.selectedContextLength) {
    applySuggestedContextLength(findSelectedModel());
  }

  normalizeReasoningSelection();
}

function startNewDraft(options = {}) {
  const { resetConversationSettings = false } = options;
  stopStreamWaitPolling();
  cancelMessageSpeech();
  closeChatOverrideMenu();
  closeDefaultToolsMenu();
  ensureSelectionDefaults();
  if (resetConversationSettings) {
    resetDraftConversationState();
  }
  state.currentChatId = null;
  state.pendingStreamRecoveryChatId = null;
  state.stickToBottom = state.autoScrollEnabled;
  state.currentChat = {
    id: null,
    title: "New Chat",
    modelKey: state.selectedModel,
    systemPrompt: state.systemPrompt,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
    temperature: parseOptionalFloat(state.selectedTemperature),
    topK: parseOptionalNumber(state.selectedTopK),
    topP: parseOptionalFloat(state.selectedTopP),
    minP: parseOptionalFloat(state.selectedMinP),
    repeatPenalty: parseOptionalFloat(state.selectedRepeatPenalty),
    selectedMcpServerIds: Array.from(state.selectedMcpServerIds),
    chatOverrides: null,
    messages: [],
  };
}

function resetDraftConversationState() {
  state.selectedMcpServerIds = cloneSelectedMcpServerIds(state.defaultMcpServerIds);
}

function clearComposerDraft() {
  elements.messageInput.value = "";
  elements.messageInput.style.overflowY = "hidden";
  state.composerAttachments = [];
  renderComposerAttachments();
  autoResizeComposer();
}

async function openChat(chatId, suppressStatus = false) {
  stopStreamWaitPolling();
  cancelMessageSpeech();
  closeChatOverrideMenu();
  closeDefaultToolsMenu();
  try {
    state.currentChat = normalizeChatRecord(await fetchJson(`/api/chats/${encodeURIComponent(chatId)}`));
    state.currentChatId = state.currentChat.id;
    state.selectedMcpServerIds = normalizeSelectedMcpServerIds(state.currentChat.selectedMcpServerIds || []);
    state.stickToBottom = state.autoScrollEnabled;
    normalizeReasoningSelection();
    render();
    syncMessageScroll(true);
    autoResizeComposer();
    setDrawerOpen(false);

    if (!state.streamingChatIds.has(chatId)) {
      try {
        const streamsData = await fetchJson("/api/chats/active-streams");
        if ((streamsData.chatIds || []).includes(chatId)) {
          startStreamWaitPolling(chatId);
        }
      } catch { }
    }

    if (!suppressStatus) {
      setStatus(`Opened ${state.currentChat.title}.`, "neutral");
    }

    void ensureChatHasAutoTitle(state.currentChat);
  } catch (error) {
    setStatus(error.message || "Unable to open chat.", "error");
  }
}

async function loadSelectedModel() {
  if (!state.selectedModel || state.isModelLoading) {
    setStatus("Choose a model first.", "error");
    return;
  }

  const selectedModel = findSelectedModel();
  if (!selectedModel) {
    setStatus("Selected model was not found.", "error");
    return;
  }

  const loadedInstances = selectedModel.loadedInstances || [];
  if (loadedInstances.length > 0) {
    if (doesSelectedContextRequireReload(selectedModel)) {
      await executeModelLoad(selectedModel.key, loadedInstances.map(instance => instance.id), "reload");
      return;
    }

    renderModelDetails();
    return;
  }

  const loadedElsewhere = getLoadedModels(selectedModel.key);
  if (loadedElsewhere.length > 0) {
    openConfirmDialog({
      kind: "swap-model",
      title: "Unload the current model first?",
      message: `${loadedElsewhere.map(model => model.key).join(", ")} is already loaded. Unload it before loading ${selectedModel.key}?`,
      confirmText: "Unload and Load",
      danger: false,
      payload: {
        targetModel: selectedModel.key,
        unloadInstanceIds: loadedElsewhere.flatMap(model => (model.loadedInstances || []).map(instance => instance.id)),
      },
    });
    return;
  }

  await executeModelLoad(selectedModel.key);
}

async function executeModelLoad(modelKey, unloadInstanceIds = [], loadMode = unloadInstanceIds.length > 0 ? "switch" : "load") {
  state.isModelLoading = true;
  state.modelLoadTarget = modelKey;
  state.modelLoadMode = loadMode;
  renderControls();

  try {
    const statusText = loadMode === "reload"
      ? "Reloading model..."
      : unloadInstanceIds.length > 0
        ? "Switching models..."
        : "Loading model...";
    setStatus(statusText, "busy");
    for (const instanceId of unloadInstanceIds) {
      await fetchJson("/api/models/unload", {
        method: "POST",
        body: JSON.stringify({ instanceId }),
      });
    }

    await fetchJson("/api/models/load", {
      method: "POST",
      body: JSON.stringify({
        model: modelKey,
        contextLength: parseOptionalNumber(state.selectedContextLength),
        flashAttention: true,
      }),
    });

    await refreshModels();
    setStatus(loadMode === "reload" ? "Model reloaded." : "Model loaded.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to load the selected model.", "error");
  } finally {
    state.isModelLoading = false;
    state.modelLoadTarget = "";
    state.modelLoadMode = "load";
    renderControls();
  }
}

async function unloadSelectedModel() {
  const model = findSelectedModel();
  const instances = model?.loadedInstances || [];
  if (instances.length === 0) {
    setStatus("Selected model is not loaded.", "error");
    return;
  }

  try {
    setStatus("Unloading model...", "busy");
    for (const instance of instances) {
      await fetchJson("/api/models/unload", {
        method: "POST",
        body: JSON.stringify({ instanceId: instance.id }),
      });
    }

    await refreshModels();
    setStatus("Model unloaded.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to unload the selected model.", "error");
  }
}

async function refreshModels() {
  const previousModelKey = state.selectedModel;
  const shouldFollowSuggestion = shouldUseSuggestedContext(findSelectedModel());
  const payload = await fetchJson("/api/models");
  state.models = payload.models || [];
  ensureSelectionDefaults();
  if (shouldFollowSuggestion || previousModelKey !== state.selectedModel) {
    applySuggestedContextLength(findSelectedModel());
  }
  render();
}

async function refreshChats() {
  state.chats = await fetchJson("/api/chats");
  if (state.editingChatTitleId && !state.chats.some(chat => chat.id === state.editingChatTitleId)) {
    state.editingChatTitleId = null;
    state.editingChatTitleDraft = "";
  }
  renderChatList();
}

async function sendMessage() {
  if (isCurrentChatActivelyStreaming()) {
    return;
  }

  const input = elements.messageInput.value.trim();
  const attachments = cloneAttachments(state.composerAttachments);
  if (!input && attachments.length === 0) {
    return;
  }

  if (!resolveActiveChatRequestSettings().modelKey) {
    setStatus("Choose a model first.", "error");
    return;
  }

  const requestBody = buildChatRequestBody({ chatId: state.currentChatId, input, attachments });

  if (!state.currentChat) {
    startNewDraft();
  }

  const pendingAssistant = {
    id: `pending_${Date.now()}`,
    role: "assistant",
    content: "",
    reasoning: "",
    thinkingActive: false,
    requestStartedAtMs: Date.now(),
    toolCalls: [],
    invalidToolCalls: [],
    stats: null,
    attachments: [],
    modelKey: requestBody.model,
    createdAt: new Date().toISOString(),
    pending: true,
  };

  state.currentChat.messages = state.currentChat.messages || [];
  const expectedMessageCount = state.currentChat.messages.length + 2;
  state.currentChat.messages.push({
    id: `local_${Date.now()}`,
    role: "user",
    content: input,
    reasoning: null,
    toolCalls: [],
    invalidToolCalls: [],
    attachments,
    modelKey: requestBody.model,
    stats: null,
    createdAt: new Date().toISOString(),
  });
  state.currentChat.messages.push(pendingAssistant);
  state.currentChat.title = summarizeTitle(input || attachments[0]?.name || "New Chat");
  state.currentChat.modelKey = requestBody.model;
  state.currentChat.systemPrompt = requestBody.systemPrompt;
  state.currentChat.reasoning = requestBody.reasoning;
  state.currentChat.contextLength = requestBody.contextLength;
  state.currentChat.temperature = requestBody.temperature;
  state.currentChat.topK = requestBody.topK;
  state.currentChat.topP = requestBody.topP;
  state.currentChat.minP = requestBody.minP;
  state.currentChat.repeatPenalty = requestBody.repeatPenalty;
  state.currentChat.selectedMcpServerIds = Array.from(normalizeSelectedMcpServerIds(requestBody.mcpServerIds));
  state.isSending = true;
  state.stickToBottom = state.autoScrollEnabled;
  state.streamingChatIds.add(state.currentChatId);
  initializePendingUsageEstimate(pendingAssistant);
  elements.messageInput.value = "";
  state.composerAttachments = [];
  autoResizeComposer();
  setStatus("Waiting for LM Studio...", "busy");
  render();

  const streamController = new AbortController();
  state.currentStreamController = streamController;
  state.currentStreamChatId = state.currentChatId || null;
  state.streamControllers.set(state.currentChatId, streamController);

  try {
    const response = await fetch("/api/chats/stream", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: streamController.signal,
    });

    if (response.status === 401) {
      await handleUnauthorized();
      throw new Error("Authentication required.");
    }

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const newChatId = response.headers.get("X-Chat-Id");
    if (newChatId) {
      state.streamingChatIds.delete(state.currentChatId);
      state.streamControllers.delete(state.currentChatId);
      state.currentChatId = newChatId;
      state.currentChat.id = newChatId;
      state.currentStreamChatId = newChatId;
      state.streamingChatIds.add(newChatId);
      state.streamControllers.set(newChatId, streamController);
    }

    const wasNewChat = requestBody.chatId === null;
    const chatIdForTitle = state.currentChatId;

    await consumeEventStream(response.body, event => applyStreamEvent(event, pendingAssistant));
    if (wasNewChat && state.currentChatId && state.currentChat?.chatOverrides) {
      await persistCurrentChatOverrides({ silent: true, rerender: false });
    }
    await Promise.all([refreshChats(), refreshModels()]);

    if (state.currentChatId) {
      await openChat(state.currentChatId, true);
    }

    if (wasNewChat && chatIdForTitle) {
      void autoTitleChat(chatIdForTitle, input);
    }

    setStatus("Response complete.", "neutral");
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Stopped.", "neutral");
      if (state.currentChatId) {
        try { await openChat(state.currentChatId, true); } catch { }
      } else if (state.currentChat?.messages) {
        state.currentChat.messages = state.currentChat.messages.filter(m => m.id !== pendingAssistant.id);
      }
      return;
    }
    if (await tryRecoverStreamFailure(error, expectedMessageCount)) {
      return;
    }

    pendingAssistant.content = describeStreamFailure(error);
    pendingAssistant.isError = !looksLikeTransientStreamFailure(error);
    pendingAssistant.pending = false;
    setStatus(error.message || "The request failed.", "error");
    renderMessages();
  } finally {
    const finalStreamId = state.currentStreamChatId;
    state.currentStreamController = null;
    state.currentStreamChatId = null;
    state.streamingChatIds.delete(finalStreamId);
    state.streamingChatIds.delete(null);
    state.streamControllers.delete(finalStreamId);
    state.streamControllers.delete(null);
    state.isSending = state.streamingChatIds.size > 0 || state.serverStreamPollChatId !== null;
    render();
  }
}

function applyStreamEvent(event, pendingAssistant) {
  switch (event.type) {
    case "chat.start":
      pendingAssistant.modelKey = resolveModelKeyFromInstanceId(event.data.model_instance_id) || pendingAssistant.modelKey || state.selectedModel;
      pendingAssistant.thinkingActive = false;
      setStatus("Connected to LM Studio.", "busy");
      break;
    case "model_load.start":
      setStatus("Loading model...", "busy");
      break;
    case "model_load.progress":
      setStatus(`Loading model ${Math.round((event.data.progress || 0) * 100)}%.`, "busy");
      break;
    case "model_load.end":
      setStatus(`Model loaded in ${formatNumber(event.data.loadTimeSeconds)}s.`, "busy");
      break;
    case "prompt_processing.start":
      setStatus("Processing prompt...", "busy");
      break;
    case "prompt_processing.progress":
      setStatus(`Processing prompt ${Math.round((event.data.progress || 0) * 100)}%.`, "busy");
      break;
    case "reasoning.delta":
      pendingAssistant.thinkingActive = true;
      pendingAssistant.reasoning = `${pendingAssistant.reasoning || ""}${event.data.content || ""}`;
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    case "message.delta":
      pendingAssistant.thinkingActive = false;
      pendingAssistant.content = `${pendingAssistant.content || ""}${event.data.content || ""}`;
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    case "tool_call.start":
      pendingAssistant.thinkingActive = false;
      pendingAssistant.toolCalls.push({
        tool: event.data.tool || "tool",
        argumentsJson: "{}",
        output: "",
        provider: event.data.providerInfo || null,
      });
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    case "tool_call.arguments": {
      const currentTool = pendingAssistant.toolCalls[pendingAssistant.toolCalls.length - 1];
      if (currentTool) {
        currentTool.argumentsJson = JSON.stringify(event.data.arguments || {}, null, 2);
      }
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    }
    case "tool_call.success": {
      pendingAssistant.thinkingActive = false;
      const currentTool = pendingAssistant.toolCalls[pendingAssistant.toolCalls.length - 1];
      if (currentTool) {
        currentTool.output = event.data.output || "";
      }
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    }
    case "tool_call.failure":
      pendingAssistant.thinkingActive = false;
      pendingAssistant.invalidToolCalls.push({
        reason: "Tool call failed",
        metadataJson: JSON.stringify(event.data, null, 2),
      });
      refreshPendingUsageEstimate(pendingAssistant);
      renderMessages();
      break;
    case "chat.end":
      applyFinalResponse(pendingAssistant, event.data);
      renderMessages();
      break;
    case "error":
      throw new Error(describeLmStudioError(event.data?.message || "The LM Studio stream returned an error."));
    default:
      break;
  }
}

function applyFinalResponse(message, data) {
  const result = data.result || data;
  const outputs = result.output || [];
  const contentParts = [];
  const reasoningParts = [];
  const toolCalls = [];
  const invalidToolCalls = [];

  for (const item of outputs) {
    if (item.type === "message" && item.content) {
      contentParts.push(item.content);
    }

    if (item.type === "reasoning" && item.content) {
      reasoningParts.push(item.content);
    }

    if (item.type === "tool_call") {
      toolCalls.push({
        tool: item.tool || "tool",
        argumentsJson: item.arguments ? JSON.stringify(item.arguments, null, 2) : "{}",
        output: item.output || "",
        provider: item.providerInfo || null,
      });
    }

    if (item.type === "invalid_tool_call") {
      invalidToolCalls.push({
        reason: item.reason || "Invalid tool call",
        metadataJson: item.metadata ? JSON.stringify(item.metadata, null, 2) : "{}",
      });
    }
  }

  message.content = contentParts.length > 0 ? contentParts.join("\n\n") : message.content;
  message.reasoning = reasoningParts.length > 0 ? reasoningParts.join("\n\n") : message.reasoning;
  message.toolCalls = toolCalls.length > 0 ? toolCalls : message.toolCalls;
  message.invalidToolCalls = invalidToolCalls.length > 0 ? invalidToolCalls : message.invalidToolCalls;
  message.modelKey = resolveModelKeyFromInstanceId(result.model_instance_id) || message.modelKey || state.selectedModel;
  message.stats = normalizeStreamStats(result, message.modelKey || state.selectedModel);
  if (message.stats && typeof message.stats.totalTimeSeconds !== "number" && typeof message.requestStartedAtMs === "number") {
    message.stats.totalTimeSeconds = Math.max((Date.now() - message.requestStartedAtMs) / 1000, 0);
  }
  message.thinkingActive = false;
  message.pending = false;

  if (message.stats) {
    setStatus(`Response complete at ${formatNumber(message.stats.tokensPerSecond)} tok/s.`, "neutral");
  } else {
    setStatus("Response complete.", "neutral");
  }
}

function render() {
  renderAuthState();
  renderBanner();
  renderControls();
  renderChatToolbar();
  renderTopBarActions();
  renderDefaultToolsMenu();
  renderChatOverrideMenu();
  renderChatList();
  renderMessages();
  renderComposerAttachments();
  renderConfirmDialog();
  renderStatus();
}

function renderAuthState() {
  const authenticated = !state.bootstrap?.requireLogin || state.bootstrap?.authenticated;
  elements.loginScreen.hidden = authenticated;
  elements.logoutButton.hidden = true;
  elements.connectionPill.className = `connection-pill${state.isSending ? " busy" : authenticated ? " online" : ""}`;
  elements.connectionPill.textContent = state.isSending ? "Streaming" : authenticated ? "Connected" : "Locked";
}

function renderBanner() {
  if (!state.bootstrap) {
    elements.configBanner.hidden = true;
    return;
  }

  const warnings = [];
  if (!state.bootstrap.lmStudioConfigured) {
    warnings.push("Set the LM Studio base URL before using the chat or model controls.");
  }
  if (!state.bootstrap.mcpConfigured) {
    warnings.push("Set or upload an MCP config to list MCP servers inside the client.");
  }
  if (!state.bootstrap.hasApiToken) {
    warnings.push("Set the LM Studio API token if you want plugin-based MCP tools available in chat.");
  }

  if (warnings.length === 0) {
    elements.configBanner.hidden = true;
    if (elements.configBannerText) {
      elements.configBannerText.textContent = "";
    } else {
      elements.configBanner.textContent = "";
    }
    elements.configBanner.classList.remove("warning");
    return;
  }

  if (state.configBannerDismissed) {
    elements.configBanner.hidden = true;
    return;
  }

  elements.configBanner.hidden = false;
  elements.configBanner.classList.add("warning");
  if (elements.configBannerText) {
    elements.configBannerText.textContent = warnings.join(" ");
  } else {
    elements.configBanner.textContent = warnings.join(" ");
  }
}

function renderControls() {
  renderModelOptions();
  renderReasoningOptions();
  renderModelDetails();
  renderMcpServers();
  const mcpSection = elements.mcpList?.closest(".mcp-section");
  if (mcpSection) {
    mcpSection.hidden = !state.bootstrap?.mcpConfigured;
  }
  elements.systemPromptInput.value = state.systemPrompt;
  elements.contextLengthInput.value = state.selectedContextLength;
  if (elements.temperatureInput) {
    elements.temperatureInput.value = state.selectedTemperature;
  }
  if (elements.topKInput) {
    elements.topKInput.value = state.selectedTopK;
  }
  if (elements.topPInput) {
    elements.topPInput.value = state.selectedTopP;
  }
  if (elements.minPInput) {
    elements.minPInput.value = state.selectedMinP;
  }
  if (elements.repeatPenaltyInput) {
    elements.repeatPenaltyInput.value = state.selectedRepeatPenalty;
  }
  const locked = !state.bootstrap?.authenticated && state.bootstrap?.requireLogin;
  const isActive = isCurrentChatActivelyStreaming();
  renderModelControlValidation();
  renderSendButton(locked, isActive);
  elements.messageInput.disabled = isActive || locked;
  elements.attachButton.disabled = isActive || locked;
  if (elements.modelResetButton) {
    elements.modelResetButton.disabled = locked;
  }
  if (elements.modelSaveButton) {
    elements.modelSaveButton.disabled = locked;
  }
  elements.themeButton.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
  renderThemeButton();
  renderAutoScrollButton();
  renderChatToolsButton();
  renderSpeechInputButton();
}

function renderChatToolbar() {
  const title = state.currentChat?.title || "New Chat";
  elements.currentChatTitle.textContent = title;

  const hasSavedChat = Boolean(state.currentChatId);
  elements.exportChatButton.disabled = !hasSavedChat;
  elements.deleteChatButton.disabled = !hasSavedChat;
  elements.chatToolbar?.classList.toggle("is-draft", !hasSavedChat);
}

function renderTopBarActions() {
  const expanded = !isDesktopLayout() && state.topBarActionsExpanded;
  elements.topBar?.classList.toggle("actions-expanded", expanded);

  if (!elements.topActionsToggle) {
    return;
  }

  const label = expanded ? "Hide top actions" : "Show top actions";
  setButtonIcon(elements.topActionsToggle, expanded ? "chevronUp" : "chevronDown");
  elements.topActionsToggle.title = label;
  elements.topActionsToggle.setAttribute("aria-label", label);
  elements.topActionsToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function renderModelOptions() {
  elements.modelSelect.innerHTML = buildModelSelectMarkup(state.selectedModel);
}

function renderReasoningOptions() {
  state.selectedReasoning = renderReasoningSelect(elements.reasoningSelect, state.selectedModel, state.selectedReasoning, "default");
}

function renderModelDetails() {
  const model = findSelectedModel();
  if (!model) {
    elements.modelMeta.textContent = "No model selected.";
    elements.loadModelButton.innerHTML = "Load";
    elements.loadModelButton.disabled = true;
    elements.unloadModelButton.disabled = true;
    return;
  }

  const loadedCount = (model.loadedInstances || []).length;
  const loadedContextLength = getLoadedContextLength(model);
  const reloadRequired = doesSelectedContextRequireReload(model);
  const isLoadingSelected = state.isModelLoading && state.modelLoadTarget === model.key;
  const otherLoadedModels = getLoadedModels(model.key);
  const capabilityParts = [];
  if (model.capabilities?.trainedForToolUse) {
    capabilityParts.push("tool use");
  }
  if (model.capabilities?.vision) {
    capabilityParts.push("vision");
  }
  if (model.capabilities?.reasoning) {
    capabilityParts.push(`reasoning: ${model.capabilities.reasoning.allowedOptions.join(", ")}`);
  }

  const metaParts = [
    model.displayName && model.displayName !== model.key ? model.displayName : model.key,
    model.displayName && model.displayName !== model.key ? `key: ${model.key}` : null,
    loadedCount > 0 ? `${loadedCount} instance loaded` : otherLoadedModels.length > 0 ? `${otherLoadedModels.length} other model loaded` : "auto-load on send",
    model.paramsString || model.architecture || "",
    loadedContextLength ? `${formatInteger(loadedContextLength)} loaded ctx` : null,
    `${formatInteger(model.maxContextLength)} max ctx`,
    capabilityParts.join(" • "),
  ].filter(Boolean);

  elements.modelMeta.textContent = metaParts.join(" • ");
  elements.loadModelButton.disabled = state.isModelLoading || (loadedCount > 0 && !reloadRequired);
  elements.loadModelButton.innerHTML = isLoadingSelected
    ? `<span class="button-content"><span class="button-spinner" aria-hidden="true"></span><span>${escapeHtml(state.modelLoadMode === "reload" ? "Reloading..." : "Loading...")}</span></span>`
    : loadedCount > 0
      ? reloadRequired
        ? "Reload"
        : "Loaded"
      : "Load";
  elements.unloadModelButton.disabled = state.isModelLoading || loadedCount === 0;
}

function renderMcpServers() {
  if (!elements.mcpList) {
    return;
  }

  const mcpSection = elements.mcpList?.closest(".mcp-section");
  if (mcpSection) {
    mcpSection.hidden = !state.bootstrap?.mcpConfigured;
  }

  if (!state.bootstrap?.mcpConfigured) {
    elements.mcpList.innerHTML = "";
    return;
  }

  if (state.mcpServers.length === 0) {
    elements.mcpList.innerHTML = '<p class="chat-preview">No MCP servers were found in the configured or uploaded mcp.json file.</p>';
    return;
  }

  elements.mcpList.innerHTML = state.mcpServers
    .map(server => {
      const active = state.defaultMcpServerIds.has(server.id);
      return `
        <button type="button" class="chip${active ? " active" : ""}" data-mcp-id="${escapeAttribute(server.id)}">
          ${escapeHtml(server.label)}
          <small>${escapeHtml(server.transport || server.description || "configured server")}</small>
        </button>`;
    })
    .join("");
}

function renderDefaultToolsMenu() {
  if (!elements.defaultToolsMcpList) {
    return;
  }

  if (!state.bootstrap?.mcpConfigured) {
    elements.defaultToolsMcpList.innerHTML = '<p class="chat-preview">Set or upload an MCP config to choose default tools.</p>';
    return;
  }

  if (state.mcpServers.length === 0) {
    elements.defaultToolsMcpList.innerHTML = '<p class="chat-preview">No MCP servers were found in the configured or uploaded mcp.json file.</p>';
    return;
  }

  elements.defaultToolsMcpList.innerHTML = state.mcpServers
    .map(server => {
      const active = state.defaultMcpServerIds.has(server.id);
      return `
        <button type="button" class="chip${active ? " active" : ""}" data-mcp-id="${escapeAttribute(server.id)}">
          ${escapeHtml(server.label)}
          <small>${escapeHtml(server.transport || server.description || "configured server")}</small>
        </button>`;
    })
    .join("");
}

function renderChatList() {
  if (state.chats.length === 0) {
    state.editingChatTitleId = null;
    state.editingChatTitleDraft = "";
    elements.chatList.innerHTML = '<p class="chat-preview">No chats saved yet.</p>';
    return;
  }

  elements.chatList.innerHTML = state.chats
    .map(chat => {
      const isStreaming = state.streamingChatIds.has(chat.id) || state.serverStreamPollChatId === chat.id;
      const editingTitle = state.editingChatTitleId === chat.id;
      return `
      <article class="chat-item${chat.id === state.currentChatId ? " active" : ""}${isStreaming ? " streaming" : ""}">
        <div class="chat-main">
          ${editingTitle ? `
            <form class="chat-title-edit-form" data-rename-chat-form="${escapeAttribute(chat.id)}">
              <input class="chat-title-edit-input" data-rename-chat-input="${escapeAttribute(chat.id)}" type="text" value="${escapeAttribute(state.editingChatTitleDraft)}" maxlength="120" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" aria-label="Rename ${escapeAttribute(chat.title)}" />
              <div class="chat-title-edit-actions">
                <button type="submit" class="primary-button">Save</button>
                <button type="button" class="ghost-button" data-cancel-rename-chat-id="${escapeAttribute(chat.id)}">Cancel</button>
              </div>
            </form>` : `
            <div class="chat-title-row">
              <button type="button" class="chat-open chat-open-title" data-chat-id="${escapeAttribute(chat.id)}" aria-label="Open ${escapeAttribute(chat.title)}">
                <span class="chat-title">${escapeHtml(chat.title)}</span>
              </button>
              <button type="button" class="chat-rename" data-rename-chat-id="${escapeAttribute(chat.id)}" aria-label="Rename ${escapeAttribute(chat.title)}" title="Rename ${escapeAttribute(chat.title)}">${renderIcon("pencil")}</button>
            </div>`}
          <button type="button" class="chat-open chat-open-body" data-chat-id="${escapeAttribute(chat.id)}" aria-label="Open ${escapeAttribute(chat.title)} details">
            <span class="chat-meta">${escapeHtml(chat.modelKey)} • ${escapeHtml(formatRelativeDate(chat.updatedAt))}</span>
            <span class="chat-preview">${escapeHtml(chat.preview || "Saved chat")}</span>
          </button>
        </div>
        <button type="button" class="chat-delete" data-delete-chat-id="${escapeAttribute(chat.id)}" aria-label="Delete ${escapeAttribute(chat.title)}" title="Delete ${escapeAttribute(chat.title)}">${renderIcon("trash")}</button>
      </article>`;
    })
    .join("");
}

function renderMessages(forceScroll = false) {
  const messages = state.currentChat?.messages || [];
  const hasMessages = messages.length > 0;
  const shouldStick = forceScroll || (state.autoScrollEnabled && (state.stickToBottom || isMessageScrollNearBottom()));

  if (state.editingMessageId) {
    const editTextarea = elements.messageList.querySelector(".message-edit-textarea");
    if (editTextarea) {
      state.editDraftContent = editTextarea.value;
    }
  }

  const openDetailsStates = captureOpenDetails();
  elements.messageScroll.classList.toggle("empty", !hasMessages);
  elements.emptyState.hidden = hasMessages;
  elements.messageList.innerHTML = hasMessages ? messages.map(renderMessageCard).join("") : "";
  restoreOpenDetails(openDetailsStates);
  renderMathInMarkdown(elements.messageList);

  if (state.editingMessageId) {
    const editTextarea = elements.messageList.querySelector(".message-edit-textarea");
    if (editTextarea) {
      editTextarea.value = state.editDraftContent;
    }
  }

  syncMessageScroll(shouldStick);

  // Update context meter in composer
  if (elements.composerContextMeter) {
    const latestWithStats = [...messages].reverse().find(m => m.role === "assistant" && m.stats);
    const meterHtml = renderContextMeter(latestWithStats || null);
    elements.composerContextMeter.hidden = !meterHtml;
    elements.composerContextMeter.innerHTML = meterHtml;
  }
}

function renderStatus() {
  elements.statusBar.dataset.tone = state.statusTone;
  elements.statusBar.textContent = state.statusText;
  elements.statusBar.title = state.statusText;
}

function renderMessageCard(message) {
  const roleLabel = message.role === "user" ? "You" : resolveAssistantLabel(message);

  if (state.editingMessageId === message.id) {
    const attachmentsBlock = message.attachments?.length
      ? `<div class="attachment-list">${message.attachments.map(renderMessageAttachment).join("")}</div>`
      : "";
    return `
    <article class="message-card user">
      <div class="message-head">
        <span class="message-role">${escapeHtml(roleLabel)}</span>
        <time class="message-time">${escapeHtml(formatClock(message.createdAt))}</time>
      </div>
      ${attachmentsBlock}
      <div class="message-edit-form">
        <textarea class="message-edit-textarea" rows="3" autocorrect="off" autocapitalize="sentences" spellcheck="false"></textarea>
        <div class="message-edit-actions">
          <button type="button" class="primary-button" data-save-edit>Save and Regenerate</button>
          <button type="button" class="ghost-button" data-cancel-edit>Cancel</button>
        </div>
      </div>
    </article>`;
  }

  const contentBlock = message.isError
    ? `<div class="message-error">${escapeHtml(message.content || "An error occurred.")}</div>`
    : message.content
      ? `<div class="message-body markdown-body">${renderMarkdown(message.content, { allowCodeCopy: message.role === "assistant" })}</div>`
      : message.pending
        ? `<div class="message-body">${message.thinkingActive ? "Generating reasoning..." : "Waiting for tokens..."}</div>`
        : "";

  const reasoningBlock = message.reasoning
    ? `
      <details class="details-block thinking-block${message.thinkingActive ? " active" : ""}" data-details-id="${escapeAttribute(message.id)}-reasoning">
        <summary><span>Thinking</span>${message.thinkingActive ? '<span class="thinking-indicator"><span class="thinking-indicator-dot" aria-hidden="true"></span>Live</span>' : ""}</summary>
        <div class="details-body markdown-body">${renderMarkdown(message.reasoning, { allowCodeCopy: true })}</div>
      </details>`
    : "";

  const attachmentsBlock = message.attachments?.length
    ? `
      <div class="attachment-list">
        ${message.attachments.map(renderMessageAttachment).join("")}
      </div>`
    : "";

  const toolCallsBlock = message.toolCalls?.length
    ? `
      <details class="details-block" data-details-id="${escapeAttribute(message.id)}-tools">
        <summary>Tools Used (${message.toolCalls.length})</summary>
        ${message.toolCalls.map(renderToolCall).join("")}
      </details>`
    : "";

  const invalidToolCallsBlock = message.invalidToolCalls?.length
    ? `
      <details class="details-block" data-details-id="${escapeAttribute(message.id)}-errors">
        <summary>Tool Errors (${message.invalidToolCalls.length})</summary>
        ${message.invalidToolCalls.map(renderInvalidToolCall).join("")}
      </details>`
    : "";

  const statsBlock = message.stats && !message.pending && !message.stats.isEstimated ? renderMessageStats(message.stats) : "";

  const contextBlock = "";
  const canExport = Boolean(state.currentChatId) && !message.pending;
  const canRetry = Boolean(state.currentChatId) && !message.pending && message.role === "assistant" && isLatestAssistantMessage(message);
  const canEdit = Boolean(state.currentChatId) && !message.pending && message.role === "user" && !isCurrentChatActivelyStreaming() && !state.editingMessageId;
  const canSpeak = message.role === "assistant" && !message.pending && Boolean(getSpeakableMessageText(message));
  const canCopy = message.role === "assistant" && !message.pending && Boolean(String(message.content || ""));
  const actionsBlock = canExport || canRetry || canEdit || canSpeak || canCopy
    ? `
      <div class="message-actions">
        ${canRetry ? `<button type="button" class="ghost-button icon-button message-action-icon" data-retry-chat="true" aria-label="Retry prompt" title="Retry prompt">${renderIcon("retry")}</button>` : ""}
        ${canEdit ? `<button type="button" class="ghost-button icon-button message-action-icon" data-edit-message-id="${escapeAttribute(message.id)}" aria-label="Edit message" title="Edit message">${renderIcon("pencil")}</button>` : ""}
        ${canCopy ? `<button type="button" class="ghost-button icon-button message-action-icon" data-copy-message-id="${escapeAttribute(message.id)}" aria-label="Copy raw markdown" title="Copy raw markdown">${renderIcon("copy")}</button>` : ""}
        ${canSpeak ? `<button type="button" class="ghost-button icon-button message-action-icon${state.speakingMessageId === message.id ? " is-active" : ""}" data-speak-message-id="${escapeAttribute(message.id)}" aria-label="${escapeAttribute(state.speakingMessageId === message.id ? "Stop reading aloud" : "Read aloud")}" title="${escapeAttribute(state.speakingMessageId === message.id ? "Stop reading aloud" : "Read aloud")}">${renderIcon(state.speakingMessageId === message.id ? "speakerOff" : "speaker")}</button>` : ""}
        ${canExport ? `<button type="button" class="ghost-button icon-button message-action-icon" data-export-message-id="${escapeAttribute(message.id)}" aria-label="Export Markdown" title="Export Markdown">${renderIcon("download")}</button>` : ""}
      </div>`
    : "";

  return `
    <article class="message-card ${message.role === "user" ? "user" : "assistant"}">
      <div class="message-head">
        <span class="message-role">${escapeHtml(roleLabel)}</span>
        <time class="message-time">${escapeHtml(formatClock(message.createdAt))}</time>
      </div>
      ${reasoningBlock}
      ${contentBlock}
      ${attachmentsBlock}
      ${toolCallsBlock}
      ${invalidToolCallsBlock}
      ${contextBlock}
      ${statsBlock}
      ${actionsBlock}
    </article>`;
}

function renderToolCall(toolCall) {
  return `
    <div class="tool-call">
      <div class="tool-name">${escapeHtml(toolCall.tool)}</div>
      <pre class="tool-json">${escapeHtml(toolCall.argumentsJson || "{}")}</pre>
      ${toolCall.output ? `<pre class="tool-output">${escapeHtml(toolCall.output)}</pre>` : ""}
    </div>`;
}

function renderInvalidToolCall(toolCall) {
  return `
    <div class="tool-call">
      <div class="tool-name">${escapeHtml(toolCall.reason)}</div>
      <pre class="tool-json">${escapeHtml(toolCall.metadataJson || "{}")}</pre>
    </div>`;
}

function setStatus(text, tone = "neutral") {
  state.statusText = text;
  state.statusTone = tone;
  renderStatus();
}

function setDrawerOpen(open) {
  document.body.classList.toggle("drawer-open", open);
}

function normalizeReasoningSelection() {
  const allowed = findSelectedModel()?.capabilities?.reasoning?.allowedOptions || [];
  if (state.selectedReasoning === "default") {
    return;
  }

  if (allowed.length === 0) {
    state.selectedReasoning = state.selectedReasoning === "off" ? "off" : "default";
    return;
  }

  if (!allowed.includes(state.selectedReasoning)) {
    state.selectedReasoning = "default";
  }
}

function normalizeReasoningValue() {
  return state.selectedReasoning === "default" ? null : state.selectedReasoning;
}

function getLoadedModels(excludeKey = "") {
  return state.models.filter(model => model.key !== excludeKey && (model.loadedInstances || []).length > 0);
}

function normalizeSelectedMcpServerIds(serverIds) {
  const normalizedIds = new Set();

  for (const serverId of serverIds || []) {
    if (!serverId) {
      continue;
    }

    const matchingServer = state.mcpServers.find(server => server.id === serverId || server.label === serverId);
    normalizedIds.add(matchingServer?.id || serverId);
  }

  return normalizedIds;
}

function cloneSelectedMcpServerIds(serverIds) {
  return normalizeSelectedMcpServerIds(Array.from(serverIds || []));
}

function selectedMcpServerSetsEqual(left, right) {
  const leftIds = Array.from(left || []);
  const rightIds = Array.from(right || []);
  if (leftIds.length !== rightIds.length) {
    return false;
  }

  return leftIds.every(serverId => right.has(serverId));
}

function toggleDefaultMcpServer(serverId) {
  const previousDefaults = cloneSelectedMcpServerIds(state.defaultMcpServerIds);
  if (state.defaultMcpServerIds.has(serverId)) {
    state.defaultMcpServerIds.delete(serverId);
  } else {
    state.defaultMcpServerIds.add(serverId);
  }

  saveDefaultMcpServerIds(state.defaultMcpServerIds);
  if (!state.currentChatId && selectedMcpServerSetsEqual(state.selectedMcpServerIds, previousDefaults)) {
    state.selectedMcpServerIds = cloneSelectedMcpServerIds(state.defaultMcpServerIds);
  }
}

function toggleActiveMcpServer(serverId) {
  if (state.selectedMcpServerIds.has(serverId)) {
    state.selectedMcpServerIds.delete(serverId);
  } else {
    state.selectedMcpServerIds.add(serverId);
  }

  if (state.currentChat) {
    state.currentChat.selectedMcpServerIds = Array.from(state.selectedMcpServerIds);
  }
}

function buildModelSelectMarkup(selectedModelKey) {
  const llmModels = state.models.filter(model => model.type === "llm");
  const models = llmModels.length > 0 ? llmModels : state.models;

  if (models.length === 0) {
    return '<option value="">No models found</option>';
  }

  return models
    .map(model => `<option value="${escapeAttribute(model.key)}" ${model.key === selectedModelKey ? "selected" : ""}>${escapeHtml(buildModelOptionLabel(model))}</option>`)
    .join("");
}

function renderReasoningSelect(selectElement, modelKey, selectedValue, defaultValue = "default") {
  if (!selectElement) {
    return selectedValue;
  }

  const allowedOptions = findModelByKey(modelKey)?.capabilities?.reasoning?.allowedOptions || [];
  const options = [{ value: defaultValue, label: "Default" }, ...allowedOptions.map(option => ({ value: option, label: capitalize(option) }))];
  const resolvedValue = options.some(option => option.value === selectedValue) ? selectedValue : defaultValue;

  selectElement.innerHTML = options
    .map(option => `<option value="${escapeAttribute(option.value)}" ${option.value === resolvedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");

  const reasoningField = selectElement.closest("label.field");
  if (reasoningField) {
    reasoningField.hidden = false;
  }
  selectElement.disabled = allowedOptions.length === 0;
  return resolvedValue;
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeChatOverrideState(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const normalized = {};
  if (hasOwn(payload, "systemPrompt")) {
    normalized.systemPrompt = String(payload.systemPrompt || "");
  }
  if (hasOwn(payload, "reasoning")) {
    normalized.reasoning = payload.reasoning === null ? null : String(payload.reasoning || "").trim() || null;
  }
  if (hasOwn(payload, "temperature")) {
    normalized.temperature = typeof payload.temperature === "number" ? payload.temperature : null;
  }
  if (hasOwn(payload, "topK")) {
    normalized.topK = typeof payload.topK === "number" ? payload.topK : null;
  }
  if (hasOwn(payload, "topP")) {
    normalized.topP = typeof payload.topP === "number" ? payload.topP : null;
  }
  if (hasOwn(payload, "minP")) {
    normalized.minP = typeof payload.minP === "number" ? payload.minP : null;
  }
  if (hasOwn(payload, "repeatPenalty")) {
    normalized.repeatPenalty = typeof payload.repeatPenalty === "number" ? payload.repeatPenalty : null;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeChatRecord(chat) {
  if (!chat || typeof chat !== "object") {
    return chat;
  }

  return {
    ...chat,
    chatOverrides: normalizeChatOverrideState(chat.chatOverrides),
    selectedMcpServerIds: Array.isArray(chat.selectedMcpServerIds) ? chat.selectedMcpServerIds : [],
  };
}

function findSelectedModel() {
  return state.models.find(model => model.key === state.selectedModel) || null;
}

function findModelByKey(modelKey) {
  return state.models.find(model => model.key === modelKey) || null;
}

function getLoadedContextLength(model) {
  return firstFiniteNumber(...(model?.loadedInstances || []).map(instance => instance?.config?.contextLength));
}

function resolveModelContextLimit(model) {
  return firstFiniteNumber(getLoadedContextLength(model), model?.maxContextLength);
}

function suggestContextLength(model) {
  const resolved = resolveModelContextLimit(model);
  if (!resolved) {
    return 8192;
  }

  return resolved;
}

function shouldUseSuggestedContext(model) {
  if (!state.selectedContextLength || !state.contextLengthManual) {
    return true;
  }

  return state.selectedContextLength === String(suggestContextLength(model));
}

function setContextLengthValue(value, options = {}) {
  const manual = options.manual === true;
  state.selectedContextLength = value === null || value === undefined || value === "" ? "" : String(value);
  state.contextLengthManual = manual && Boolean(state.selectedContextLength);
}

function applySuggestedContextLength(model) {
  setContextLengthValue(suggestContextLength(model), { manual: false });
}

function syncContextLengthInput(value) {
  state.selectedContextLength = value;
  state.contextLengthManual = Boolean(value) && value !== String(suggestContextLength(findSelectedModel()));
}

async function consumeEventStream(stream, onEvent) {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      const parsedEvent = parseSseEvent(rawEvent);
      if (parsedEvent) {
        onEvent(parsedEvent);
      }
      boundaryIndex = buffer.indexOf("\n\n");
    }
  }
}

function parseSseEvent(rawEvent) {
  if (!rawEvent.trim()) {
    return null;
  }

  let type = "message";
  const dataLines = [];
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      type = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const dataText = dataLines.join("\n");
  let data = dataText;
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      data = { message: dataText };
    }
  }

  return { type, data };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    method: options.method || "GET",
    body: options.body,
  });

  if (response.status === 401) {
    if (!options.suppressAuthRedirect) {
      await handleUnauthorized();
    }
    throw new Error("Authentication required.");
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function handleUnauthorized() {
  state.bootstrap = {
    ...state.bootstrap,
    authenticated: false,
  };
  render();
}

async function readError(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("json")) {
    const payload = await response.json();
    if (payload.errors && typeof payload.errors === "object") {
      const firstError = Object.values(payload.errors).find(value => Array.isArray(value) && value.length > 0);
      if (firstError) {
        return firstError[0];
      }
    }
    const value = payload.detail || payload.error || payload.title || "The request failed.";
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  return (await response.text()) || `Request failed with ${response.status}.`;
}

function autoResizeComposer() {
  const maxComposerHeight = 124;
  elements.messageInput.style.height = "auto";
  const nextHeight = Math.min(Math.max(elements.messageInput.scrollHeight, 38), maxComposerHeight);
  elements.messageInput.style.height = `${nextHeight}px`;
  elements.messageInput.style.overflowY = elements.messageInput.scrollHeight > maxComposerHeight ? "auto" : "hidden";
}

function parseOptionalNumber(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalFloat(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildChatDefaultsPayload() {
  return {
    modelKey: state.selectedModel,
    systemPrompt: state.systemPrompt,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
    temperature: parseOptionalFloat(state.selectedTemperature),
    topK: parseOptionalNumber(state.selectedTopK),
    topP: parseOptionalFloat(state.selectedTopP),
    minP: parseOptionalFloat(state.selectedMinP),
    repeatPenalty: parseOptionalFloat(state.selectedRepeatPenalty),
  };
}

function buildDefaultChatRequestSettings() {
  return {
    modelKey: state.selectedModel,
    systemPrompt: state.systemPrompt.trim() || null,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
    temperature: parseOptionalFloat(state.selectedTemperature),
    topK: parseOptionalNumber(state.selectedTopK),
    topP: parseOptionalFloat(state.selectedTopP),
    minP: parseOptionalFloat(state.selectedMinP),
    repeatPenalty: parseOptionalFloat(state.selectedRepeatPenalty),
  };
}

function resolveActiveChatRequestSettings() {
  const defaultSettings = buildDefaultChatRequestSettings();
  const activeOverrides = normalizeChatOverrideState(state.currentChat?.chatOverrides);

  if (!activeOverrides) {
    return defaultSettings;
  }

  return {
    ...defaultSettings,
    systemPrompt: hasOwn(activeOverrides, "systemPrompt")
      ? String(activeOverrides.systemPrompt || "").trim() || null
      : defaultSettings.systemPrompt,
    reasoning: hasOwn(activeOverrides, "reasoning")
      ? activeOverrides.reasoning
      : defaultSettings.reasoning,
    temperature: hasOwn(activeOverrides, "temperature")
      ? activeOverrides.temperature
      : defaultSettings.temperature,
    topK: hasOwn(activeOverrides, "topK")
      ? activeOverrides.topK
      : defaultSettings.topK,
    topP: hasOwn(activeOverrides, "topP")
      ? activeOverrides.topP
      : defaultSettings.topP,
    minP: hasOwn(activeOverrides, "minP")
      ? activeOverrides.minP
      : defaultSettings.minP,
    repeatPenalty: hasOwn(activeOverrides, "repeatPenalty")
      ? activeOverrides.repeatPenalty
      : defaultSettings.repeatPenalty,
  };
}

function buildChatRequestBody(options = {}) {
  const resolvedSettings = resolveActiveChatRequestSettings();
  const payload = {
    chatId: options.chatId ?? state.currentChatId,
    model: resolvedSettings.modelKey,
    systemPrompt: resolvedSettings.systemPrompt,
    reasoning: resolvedSettings.reasoning,
    contextLength: resolvedSettings.contextLength,
    temperature: resolvedSettings.temperature,
    topK: resolvedSettings.topK,
    topP: resolvedSettings.topP,
    minP: resolvedSettings.minP,
    repeatPenalty: resolvedSettings.repeatPenalty,
    mcpServerIds: Array.from(normalizeSelectedMcpServerIds(Array.from(state.selectedMcpServerIds))),
  };

  if (!options.omitInput) {
    payload.input = options.input ?? "";
  }

  if (!options.omitAttachments) {
    payload.attachments = options.attachments ?? [];
  }

  return payload;
}

function buildEffectiveSystemPromptPreview() {
  const basePrompt = String(resolveActiveChatRequestSettings().systemPrompt || "").trim();
  const memorySummary = state.adaptiveMemory.enabled ? String(state.adaptiveMemory.summary || "").trim() : "";
  if (!memorySummary) {
    return basePrompt;
  }

  const memoryBlock = [
    "Adaptive user memory:",
    "Use this as compact, soft guidance about the user's preferences and interests. Do not quote it unless directly relevant.",
    memorySummary
  ].join("\n");

  return basePrompt ? `${basePrompt}\n\n${memoryBlock}` : memoryBlock;
}

function applyChatDefaultsPayload(payload) {
  const chatDefaults = payload?.chatDefaults || {};
  if (chatDefaults.modelKey) {
    state.selectedModel = chatDefaults.modelKey;
  }

  state.systemPrompt = String(chatDefaults.systemPrompt || "");
  state.selectedReasoning = chatDefaults.reasoning || "default";
  if (typeof chatDefaults.contextLength === "number") {
    setContextLengthValue(chatDefaults.contextLength, { manual: true });
  } else if (!state.selectedContextLength || !state.contextLengthManual) {
    applySuggestedContextLength(findSelectedModel());
  }
  state.selectedTemperature = typeof chatDefaults.temperature === "number" ? String(chatDefaults.temperature) : "";
  state.selectedTopK = typeof chatDefaults.topK === "number" ? String(chatDefaults.topK) : "";
  state.selectedTopP = typeof chatDefaults.topP === "number" ? String(chatDefaults.topP) : "";
  state.selectedMinP = typeof chatDefaults.minP === "number" ? String(chatDefaults.minP) : "";
  state.selectedRepeatPenalty = typeof chatDefaults.repeatPenalty === "number" ? String(chatDefaults.repeatPenalty) : "";
  state.adaptiveMemory = normalizeAdaptiveMemoryState(payload?.adaptiveMemory);
}

function normalizeAdaptiveMemoryState(adaptiveMemory) {
  return {
    enabled: adaptiveMemory?.enabled === true,
    maxWords: Math.max(50, Number.parseInt(adaptiveMemory?.maxWords, 10) || 500),
    summary: String(adaptiveMemory?.summary || "").trim(),
    lastUpdatedUtc: String(adaptiveMemory?.lastUpdatedUtc || ""),
    lastReviewedUtc: String(adaptiveMemory?.lastReviewedUtc || ""),
    sourceCursorUtc: String(adaptiveMemory?.sourceCursorUtc || ""),
  };
}

async function persistChatDefaults() {
  if (state.bootstrap?.requireLogin && !state.bootstrap?.authenticated) {
    return null;
  }

  try {
    const payload = await fetchJson("/api/chat-defaults", {
      method: "POST",
      body: JSON.stringify({ chatDefaults: buildChatDefaultsPayload() }),
    });
    applyChatDefaultsPayload(payload);
    renderControls();
    return payload;
  } catch (error) {
    setStatus(error.message || "Unable to save model defaults.", "error");
    return null;
  }
}

function summarizeTitle(input) {
  const trimmed = input.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
}

async function autoTitleChat(chatId, input) {
  try {
    const result = await fetchJson(`/api/chats/${encodeURIComponent(chatId)}/auto-title`, {
      method: "POST",
      body: JSON.stringify({ input }),
    });
    if (result?.title) {
      if (state.currentChat?.id === chatId) {
        state.currentChat.title = result.title;
        renderChatToolbar();
      }
      state.chats = await fetchJson("/api/chats");
      renderChatList();
    }
  } catch {
    // Non-critical — silently ignore
  }
}

async function ensureChatHasAutoTitle(chat) {
  if (!shouldAutoTitleChat(chat?.title)) {
    return;
  }

  const firstUserMessage = (chat?.messages || []).find(message => message.role === "user" && String(message.content || "").trim());
  if (!firstUserMessage?.content || !chat?.id) {
    return;
  }

  await autoTitleChat(chat.id, firstUserMessage.content);
}

function shouldAutoTitleChat(title) {
  const normalized = String(title || "").trim().toLowerCase();
  return !normalized || normalized === "new chat";
}

function formatClock(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeDate(value) {
  if (!value) {
    return "now";
  }

  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatNumber(value) {
  if (typeof value !== "number") {
    return "0.00";
  }

  return value.toFixed(2);
}

function formatInteger(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function renderComposerAttachments() {
  if (state.composerAttachments.length === 0) {
    elements.composerAttachments.hidden = true;
    elements.composerAttachments.innerHTML = "";
    return;
  }

  elements.composerAttachments.hidden = false;
  elements.composerAttachments.innerHTML = state.composerAttachments
    .map((attachment, index) => `
      <article class="composer-attachment${attachment.kind === "image" ? " image" : ""}">
        ${attachment.kind === "image" && attachment.dataUrl ? `<img src="${escapeAttribute(attachment.dataUrl)}" alt="${escapeAttribute(attachment.name)}" loading="eager" />` : ""}
        <div class="composer-attachment-meta">
          <strong>${escapeHtml(attachment.name)}</strong>
          <span>${escapeHtml(formatAttachmentMeta(attachment))}</span>
        </div>
        <button type="button" class="ghost-button attachment-remove-button" data-remove-attachment-index="${index}">Remove</button>
      </article>`)
    .join("");
}

function renderMessageAttachment(attachment) {
  return `
    <article class="message-attachment${attachment.kind === "image" ? " image" : ""}">
      ${attachment.kind === "image" && attachment.dataUrl ? `<img src="${escapeAttribute(attachment.dataUrl)}" alt="${escapeAttribute(attachment.name)}" loading="eager" />` : ""}
      <div class="message-attachment-meta">
        <strong>${escapeHtml(attachment.name)}</strong>
        <span>${escapeHtml(formatAttachmentMeta(attachment))}</span>
      </div>
    </article>`;
}

function renderContextMeter(message) {
  const limit = message?.stats?.contextLimit;
  const used = resolveUsedContextTokens(message?.stats);
  if (typeof limit !== "number" || typeof used !== "number") {
    return "";
  }

  const remaining = Math.max(limit - used, 0);
  const percent = Math.max(4, Math.min(100, (used / limit) * 100));
  const prefix = message?.stats?.isEstimated ? "~" : "";

  return `
    <div class="context-meter">
      <div class="context-meter-head">
        <span>${escapeHtml(`${prefix}${formatInteger(used)} used total`)}</span>
        <span>${escapeHtml(`${prefix}${formatInteger(remaining)} remaining`)}</span>
      </div>
      <div class="context-meter-bar" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
    </div>`;
}

function renderMessageStats(stats) {
  const parts = [];
  const usedContextTokens = resolveUsedContextTokens(stats);
  if (typeof stats.tokensPerSecond === "number") {
    parts.push(`${formatNumber(stats.tokensPerSecond)} tok/s`);
  }
  if (typeof stats.totalTimeSeconds === "number") {
    parts.push(`${formatDuration(stats.totalTimeSeconds)} total`);
  }
  if (typeof usedContextTokens === "number") {
    parts.push(`${formatInteger(usedContextTokens)} used`);
  }
  if (typeof stats.inputTokens === "number") {
    parts.push(`${formatInteger(stats.inputTokens)} prompt`);
  }
  if (typeof stats.totalOutputTokens === "number") {
    parts.push(`${formatInteger(stats.totalOutputTokens)} generated`);
  }
  if (typeof stats.answerOutputTokens === "number" && typeof stats.reasoningOutputTokens === "number" && stats.reasoningOutputTokens > 0) {
    parts.push(`${formatInteger(stats.answerOutputTokens)} answer`);
  }
  if (typeof stats.reasoningOutputTokens === "number" && stats.reasoningOutputTokens > 0) {
    parts.push(`${formatInteger(stats.reasoningOutputTokens)} think`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `
      <div class="stats-row">
        ${parts.map((part, index) => `${index > 0 ? '<span class="divider">•</span>' : ""}<span>${escapeHtml(part)}</span>`).join("")}
      </div>`;
}

function resolveUsedContextTokens(stats) {
  if (!stats || typeof stats.inputTokens !== "number") {
    return null;
  }

  const generatedTokens = typeof stats.totalOutputTokens === "number" ? stats.totalOutputTokens : 0;
  return stats.inputTokens + Math.max(generatedTokens, 0);
}

function doesSelectedContextRequireReload(model) {
  const loadedContextLength = getLoadedContextLength(model);
  const selectedContextLength = parseOptionalNumber(state.selectedContextLength);
  if (typeof loadedContextLength !== "number" || typeof selectedContextLength !== "number") {
    return false;
  }

  return selectedContextLength !== loadedContextLength;
}

function initializePendingUsageEstimate(pendingAssistant) {
  if (!pendingAssistant) {
    return;
  }

  pendingAssistant.stats = buildEstimatedPendingStats(pendingAssistant);
}

function refreshPendingUsageEstimate(pendingAssistant) {
  if (!pendingAssistant?.pending) {
    return;
  }

  pendingAssistant.stats = buildEstimatedPendingStats(pendingAssistant);
}

function buildEstimatedPendingStats(pendingAssistant) {
  const inputTokens = estimatePendingInputTokens(pendingAssistant);
  const reasoningOutputTokens = estimateTextTokens(pendingAssistant?.reasoning || "");
  const answerOutputTokens = estimateTextTokens(pendingAssistant?.content || "");
  const toolCallTokens = estimatePendingToolCallTokens(pendingAssistant);
  const totalOutputTokens = reasoningOutputTokens + answerOutputTokens + toolCallTokens;

  return {
    inputTokens,
    totalOutputTokens,
    answerOutputTokens,
    reasoningOutputTokens,
    tokensPerSecond: null,
    timeToFirstTokenSeconds: null,
    modelLoadTimeSeconds: null,
    contextLimit: resolveResponseContextLimit(null, pendingAssistant?.modelKey || state.selectedModel),
    isEstimated: true,
  };
}

function estimatePendingInputTokens(pendingAssistant) {
  const messages = (state.currentChat?.messages || []).filter(message => message.id !== pendingAssistant?.id);
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }

  if (latestUserIndex === -1) {
    return null;
  }

  const anchorUsedTokens = resolveAnchorUsedTokens(messages, latestUserIndex);
  const latestUserTokens = estimateUserPromptTokens(messages[latestUserIndex]);
  if (typeof anchorUsedTokens === "number") {
    return anchorUsedTokens + latestUserTokens;
  }

  let total = estimateSystemPromptTokens(buildEffectiveSystemPromptPreview());
  for (let index = 0; index <= latestUserIndex; index += 1) {
    total += estimateVisibleMessageTokens(messages[index]);
  }

  return total;
}

function resolveAnchorUsedTokens(messages, latestUserIndex) {
  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant" || !message.stats || message.pending || message.stats.isEstimated) {
      continue;
    }

    const usedTokens = resolveUsedContextTokens(message.stats);
    if (typeof usedTokens === "number") {
      return usedTokens;
    }
  }

  return null;
}

function estimateVisibleMessageTokens(message) {
  if (!message) {
    return 0;
  }

  if (message.role === "user") {
    return estimateUserPromptTokens(message);
  }

  return ESTIMATED_MESSAGE_OVERHEAD_TOKENS
    + estimateTextTokens(message.content || "")
    + estimateTextTokens(message.reasoning || "")
    + estimatePendingToolCallTokens(message);
}

function estimateUserPromptTokens(message) {
  if (!message) {
    return 0;
  }

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const imageAttachments = attachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = attachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");

  let promptText = String(message.content || "").trim();
  if (!promptText && attachments.length > 0) {
    if (imageAttachments.length > 0 && fileAttachments.length > 0) {
      promptText = "Please analyze the attached content and files.";
    } else if (imageAttachments.length > 0) {
      promptText = "Please analyze the attached image.";
    } else {
      promptText = "Please use the attached file as context.";
    }
  }

  let total = ESTIMATED_MESSAGE_OVERHEAD_TOKENS + estimateTextTokens(promptText);
  if (fileAttachments.length > 0) {
    total += estimateTextTokens("Attached file context:");
    for (const attachment of fileAttachments) {
      total += estimateTextTokens(buildEstimatedFileAttachmentPromptBlock(attachment));
    }
  }

  total += imageAttachments.length * ESTIMATED_IMAGE_ATTACHMENT_TOKENS;
  return total;
}

function buildEstimatedFileAttachmentPromptBlock(attachment) {
  const lines = [`File: ${attachment.name}${attachment.contentType ? ` (${attachment.contentType})` : ""}`];
  if (attachment.textContent) {
    lines.push("```text", String(attachment.textContent).trimEnd(), "```");
    if (attachment.truncated) {
      lines.push("File content was truncated before sending.");
    }
  } else {
    lines.push("Binary file attached. Text extraction was not available.");
  }

  return lines.join("\n").trimEnd();
}

function estimatePendingToolCallTokens(message) {
  let total = 0;

  for (const toolCall of message?.toolCalls || []) {
    total += ESTIMATED_TOOL_CALL_OVERHEAD_TOKENS;
    total += estimateTextTokens(toolCall?.tool || "");
    total += estimateTextTokens(toolCall?.argumentsJson || "");
  }

  for (const toolCall of message?.invalidToolCalls || []) {
    total += ESTIMATED_TOOL_CALL_OVERHEAD_TOKENS;
    total += estimateTextTokens(toolCall?.reason || "");
    total += estimateTextTokens(toolCall?.metadataJson || "");
  }

  return total;
}

function estimateSystemPromptTokens(systemPrompt) {
  const prompt = String(systemPrompt || "").trim();
  if (!prompt) {
    return 0;
  }

  return ESTIMATED_SYSTEM_PROMPT_OVERHEAD_TOKENS + estimateTextTokens(prompt);
}

function estimateTextTokens(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / ESTIMATED_CHARS_PER_TOKEN));
}

function resolveAssistantLabel(message) {
  return message.modelKey || state.currentChat?.modelKey || state.selectedModel || "Model";
}

function formatDuration(valueSeconds) {
  if (typeof valueSeconds !== "number" || !Number.isFinite(valueSeconds)) {
    return "0.000s";
  }

  if (valueSeconds < 60) {
    return `${valueSeconds.toFixed(3)}s`;
  }

  const minutes = Math.floor(valueSeconds / 60);
  const seconds = valueSeconds % 60;
  return `${minutes}m ${seconds.toFixed(3)}s`;
}

function isLatestAssistantMessage(message) {
  const latestAssistant = [...(state.currentChat?.messages || [])]
    .reverse()
    .find(candidate => candidate.role === "assistant");

  return latestAssistant?.id === message.id;
}

function buildModelOptionLabel(model) {
  return [
    model.displayName && model.displayName !== model.key ? model.displayName : model.key,
    model.displayName && model.displayName !== model.key ? model.key : null,
    (model.loadedInstances || []).length > 0 ? "Loaded" : null,
  ].filter(Boolean).join(" • ");
}

function resolveModelKeyFromInstanceId(instanceId) {
  if (!instanceId) {
    return null;
  }

  return state.models.find(model => (model.loadedInstances || []).some(instance => instance.id === instanceId) || model.key === instanceId)?.key || null;
}

function captureModelControlSnapshot() {
  return {
    selectedModel: state.selectedModel,
    selectedReasoning: state.selectedReasoning,
    selectedContextLength: state.selectedContextLength,
    selectedTemperature: state.selectedTemperature,
    selectedTopK: state.selectedTopK,
    selectedTopP: state.selectedTopP,
    selectedMinP: state.selectedMinP,
    selectedRepeatPenalty: state.selectedRepeatPenalty,
    systemPrompt: state.systemPrompt,
    contextLengthManual: state.contextLengthManual,
  };
}

function restoreModelControlSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  state.selectedModel = snapshot.selectedModel;
  state.selectedReasoning = snapshot.selectedReasoning;
  state.selectedContextLength = snapshot.selectedContextLength;
  state.selectedTemperature = snapshot.selectedTemperature;
  state.selectedTopK = snapshot.selectedTopK;
  state.selectedTopP = snapshot.selectedTopP;
  state.selectedMinP = snapshot.selectedMinP;
  state.selectedRepeatPenalty = snapshot.selectedRepeatPenalty;
  state.systemPrompt = snapshot.systemPrompt;
  state.contextLengthManual = snapshot.contextLengthManual;
}

function clearModelControlValidation() {
  state.modelControlErrors = {};
}

function validateIntegerDraft(value, label, minimum) {
  if (!value) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return `${label} must be a whole number.`;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < minimum) {
    return `${label} must be at least ${minimum}.`;
  }

  return null;
}

function validateDecimalDraft(value, label, options = {}) {
  if (!value) {
    return null;
  }

  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    return `${label} must be a complete number.`;
  }

  const parsed = Number.parseFloat(value);
  if (options.minimumExclusive === true && Number.isFinite(options.minimum) && parsed <= options.minimum) {
    return `${label} must be greater than ${options.minimum}.`;
  }
  if (Number.isFinite(options.minimum) && parsed < options.minimum) {
    return options.minimum === 0
      ? `${label} must be 0 or greater.`
      : `${label} must be greater than ${options.minimum}.`;
  }
  if (Number.isFinite(options.maximum) && parsed > options.maximum) {
    return `${label} must be ${options.maximum} or less.`;
  }

  return null;
}

function validateModelControlState() {
  const errors = {};
  const contextLengthError = validateIntegerDraft(state.selectedContextLength, "Context length", 512);
  if (contextLengthError) {
    errors.contextLength = contextLengthError;
  }

  const temperatureError = validateDecimalDraft(state.selectedTemperature, "Temperature", { minimum: 0, maximum: 1 });
  if (temperatureError) {
    errors.temperature = temperatureError;
  }

  const topKError = validateIntegerDraft(state.selectedTopK, "Top K", 1);
  if (topKError) {
    errors.topK = topKError;
  }

  const topPError = validateDecimalDraft(state.selectedTopP, "Top P", { minimum: 0, maximum: 1 });
  if (topPError) {
    errors.topP = topPError;
  }

  const minPError = validateDecimalDraft(state.selectedMinP, "Min P", { minimum: 0, maximum: 1 });
  if (minPError) {
    errors.minP = minPError;
  }

  const repeatPenaltyError = validateDecimalDraft(state.selectedRepeatPenalty, "Repeat penalty", { minimum: 0, minimumExclusive: true });
  if (repeatPenaltyError) {
    errors.repeatPenalty = repeatPenaltyError;
  }

  return errors;
}

function setFieldValidation(input, error) {
  const field = input?.closest(".field");
  if (!field || !input) {
    return;
  }

  if (error) {
    field.classList.add("has-error");
    field.dataset.error = error;
    input.setAttribute("aria-invalid", "true");
    input.title = error;
    return;
  }

  field.classList.remove("has-error");
  delete field.dataset.error;
  input.removeAttribute("aria-invalid");
  input.removeAttribute("title");
}

function renderModelControlValidation() {
  setFieldValidation(elements.contextLengthInput, state.modelControlErrors.contextLength);
  setFieldValidation(elements.temperatureInput, state.modelControlErrors.temperature);
  setFieldValidation(elements.topKInput, state.modelControlErrors.topK);
  setFieldValidation(elements.topPInput, state.modelControlErrors.topP);
  setFieldValidation(elements.minPInput, state.modelControlErrors.minP);
  setFieldValidation(elements.repeatPenaltyInput, state.modelControlErrors.repeatPenalty);
}

function updateModelControlValidation() {
  state.modelControlErrors = validateModelControlState();
  renderModelControlValidation();
  return Object.keys(state.modelControlErrors).length === 0;
}

function openModelMenu(section = null) {
  closeChatOverrideMenu();
  closeDefaultToolsMenu();
  state.modelControlSnapshot = captureModelControlSnapshot();
  clearModelControlValidation();
  elements.settingsScreen.hidden = true;
  elements.modelScreen.hidden = false;
  renderControls();
  if (section === "tools") {
    focusModelToolsSection();
  }
}

function closeModelMenu(options = {}) {
  const discardChanges = options.discardChanges !== false;
  if (discardChanges && state.modelControlSnapshot) {
    restoreModelControlSnapshot(state.modelControlSnapshot);
  }

  elements.modelScreen.hidden = true;
  state.modelControlSnapshot = null;
  clearModelControlValidation();
  render();
}

function resetModelMenu() {
  if (!state.modelControlSnapshot) {
    return;
  }

  restoreModelControlSnapshot(state.modelControlSnapshot);
  clearModelControlValidation();
  renderControls();
}

async function saveModelMenu() {
  if (!updateModelControlValidation()) {
    setStatus("Fix the highlighted model controls before saving.", "error");
    return;
  }

  const saved = await persistChatDefaults();
  if (!saved) {
    return;
  }

  setStatus("Model defaults saved.", "neutral");
  closeModelMenu({ discardChanges: false });
}

function openDefaultToolsMenu() {
  closeChatOverrideMenu();
  closeModelMenu();
  closeSettings();
  renderDefaultToolsMenu();
  elements.defaultToolsScreen.hidden = false;
}

function closeDefaultToolsMenu() {
  if (!elements.defaultToolsScreen) {
    return;
  }

  elements.defaultToolsScreen.hidden = true;
}

function focusModelToolsSection() {
  if (elements.modelAdvancedPanel) {
    elements.modelAdvancedPanel.open = true;
  }

  if (elements.modelToolsSection) {
    queueMicrotask(() => {
      elements.modelToolsSection.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
}

function loadThemePreference() {
  try {
    return localStorage.getItem("mls-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = state.theme;

  try {
    localStorage.setItem("mls-theme", state.theme);
  } catch {
  }
}

function toggleTheme() {
  applyTheme(state.theme === "dark" ? "light" : "dark");
  renderControls();
}

function loadAutoScrollPreference() {
  try {
    return localStorage.getItem("mls-auto-scroll") !== "false";
  } catch {
    return true;
  }
}

function saveAutoScrollPreference(value) {
  try {
    localStorage.setItem("mls-auto-scroll", value ? "true" : "false");
  } catch {
  }
}

function loadEnterKeyBehavior() {
  try {
    return localStorage.getItem("mls-enter-key") === "newline" ? "newline" : "send";
  } catch {
    return "send";
  }
}

function saveEnterKeyBehavior(value) {
  try {
    localStorage.setItem("mls-enter-key", value === "newline" ? "newline" : "send");
  } catch {
  }
}

function loadDefaultMcpServerIds() {
  try {
    const saved = localStorage.getItem("mls-default-mcp-ids");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveDefaultMcpServerIds(ids) {
  try {
    localStorage.setItem("mls-default-mcp-ids", JSON.stringify(Array.from(ids)));
  } catch {
  }
}

function toggleChatToolsPopup() {
  if (state.chatToolsPopupOpen) {
    closeChatToolsPopup();
  } else {
    openChatToolsPopup();
  }
}

function openChatToolsPopup() {
  if (!elements.chatToolsPopup || state.mcpServers.length === 0) {
    return;
  }

  state.chatToolsPopupOpen = true;
  renderChatToolsPopup();
  elements.chatToolsPopup.hidden = false;
}

function closeChatToolsPopup() {
  if (!elements.chatToolsPopup) {
    return;
  }

  state.chatToolsPopupOpen = false;
  elements.chatToolsPopup.hidden = true;
}

function renderChatToolsPopup() {
  if (!elements.chatToolsMcpList) {
    return;
  }

  if (state.mcpServers.length === 0) {
    elements.chatToolsMcpList.innerHTML = '<p class="chat-preview">No MCP servers configured.</p>';
    return;
  }

  elements.chatToolsMcpList.innerHTML = state.mcpServers
    .map(server => {
      const active = state.selectedMcpServerIds.has(server.id);
      return `
        <button type="button" class="chip${active ? " active" : ""}" data-mcp-id="${escapeAttribute(server.id)}">
          ${escapeHtml(server.label)}
          <small>${escapeHtml(server.transport || server.description || "configured server")}</small>
        </button>`;
    })
    .join("");
}

function renderChatToolsButton() {
  if (!elements.chatToolsButton) {
    return;
  }

  const hasMcp = state.mcpServers.length > 0;
  const hasActiveMcp = state.selectedMcpServerIds.size > 0;
  elements.chatToolsButton.hidden = !hasMcp;
  elements.chatToolsButton.classList.toggle("is-active", hasActiveMcp);
  const count = state.selectedMcpServerIds.size;
  const label = hasMcp
    ? `MCP tools${count > 0 ? ` (${count} active)` : ""}`
    : "No MCP tools configured";
  elements.chatToolsButton.title = label;
  elements.chatToolsButton.setAttribute("aria-label", label);
}

function renderSendButton(locked, isActive) {
  const label = isActive ? "Stop response" : "Send message";
  const activeModelKey = resolveActiveChatRequestSettings().modelKey;
  setButtonIcon(elements.sendButton, isActive ? "stop" : "send");
  elements.sendButton.title = label;
  elements.sendButton.setAttribute("aria-label", label);
  elements.sendButton.disabled = isActive ? false : locked || !activeModelKey;
  elements.sendButton.classList.toggle("danger-button", isActive);
  elements.sendButton.classList.toggle("primary-button", !isActive);
}

function openChatOverrideMenu() {
  if (!state.currentChat) {
    startNewDraft();
  }

  closeChatToolsPopup();
  closeDefaultToolsMenu();
  closeModelMenu();
  closeSettings();
  state.chatOverrideDraft = buildChatOverrideDraft();
  elements.chatOverrideScreen.hidden = false;
  renderChatOverrideMenu();
}

function closeChatOverrideMenu() {
  if (!elements.chatOverrideScreen) {
    return;
  }

  elements.chatOverrideScreen.hidden = true;
  state.chatOverrideDraft = null;
}

function buildChatOverrideDraft() {
  const overrides = normalizeChatOverrideState(state.currentChat?.chatOverrides);
  return {
    systemPrompt: hasOwn(overrides, "systemPrompt") ? overrides.systemPrompt : state.systemPrompt,
    reasoning: hasOwn(overrides, "reasoning")
      ? (overrides.reasoning === null ? "default" : overrides.reasoning)
      : state.selectedReasoning,
    temperature: hasOwn(overrides, "temperature") && overrides.temperature !== null ? String(overrides.temperature) : hasOwn(overrides, "temperature") ? "" : state.selectedTemperature,
    topK: hasOwn(overrides, "topK") && overrides.topK !== null ? String(overrides.topK) : hasOwn(overrides, "topK") ? "" : state.selectedTopK,
    topP: hasOwn(overrides, "topP") && overrides.topP !== null ? String(overrides.topP) : hasOwn(overrides, "topP") ? "" : state.selectedTopP,
    minP: hasOwn(overrides, "minP") && overrides.minP !== null ? String(overrides.minP) : hasOwn(overrides, "minP") ? "" : state.selectedMinP,
    repeatPenalty: hasOwn(overrides, "repeatPenalty") && overrides.repeatPenalty !== null ? String(overrides.repeatPenalty) : hasOwn(overrides, "repeatPenalty") ? "" : state.selectedRepeatPenalty,
  };
}

function readChatOverrideDraftFromInputs() {
  return {
    systemPrompt: elements.chatOverrideSystemPromptInput?.value || "",
    reasoning: elements.chatOverrideReasoningSelect?.value || "default",
    temperature: elements.chatOverrideTemperatureInput?.value.trim() || "",
    topK: elements.chatOverrideTopKInput?.value.trim() || "",
    topP: elements.chatOverrideTopPInput?.value.trim() || "",
    minP: elements.chatOverrideMinPInput?.value.trim() || "",
    repeatPenalty: elements.chatOverrideRepeatPenaltyInput?.value.trim() || "",
  };
}

function buildPersistedChatOverridePayload(draft) {
  if (!draft) {
    return null;
  }

  const payload = {};
  if (draft.systemPrompt !== state.systemPrompt) {
    payload.systemPrompt = draft.systemPrompt;
  }

  if (draft.reasoning !== state.selectedReasoning) {
    payload.reasoning = draft.reasoning === "default" ? null : draft.reasoning;
  }

  const draftTemperature = parseOptionalFloat(draft.temperature);
  const draftTopK = parseOptionalNumber(draft.topK);
  const draftTopP = parseOptionalFloat(draft.topP);
  const draftMinP = parseOptionalFloat(draft.minP);
  const draftRepeatPenalty = parseOptionalFloat(draft.repeatPenalty);

  if (!optionalValuesEqual(draftTemperature, parseOptionalFloat(state.selectedTemperature))) {
    payload.temperature = draftTemperature;
  }
  if (!optionalValuesEqual(draftTopK, parseOptionalNumber(state.selectedTopK))) {
    payload.topK = draftTopK;
  }
  if (!optionalValuesEqual(draftTopP, parseOptionalFloat(state.selectedTopP))) {
    payload.topP = draftTopP;
  }
  if (!optionalValuesEqual(draftMinP, parseOptionalFloat(state.selectedMinP))) {
    payload.minP = draftMinP;
  }
  if (!optionalValuesEqual(draftRepeatPenalty, parseOptionalFloat(state.selectedRepeatPenalty))) {
    payload.repeatPenalty = draftRepeatPenalty;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function renderChatOverrideMenu() {
  if (!elements.chatOverrideScreen || elements.chatOverrideScreen.hidden || !state.chatOverrideDraft) {
    return;
  }

  elements.chatOverrideSystemPromptInput.value = state.chatOverrideDraft.systemPrompt;
  elements.chatOverrideTemperatureInput.value = state.chatOverrideDraft.temperature;
  elements.chatOverrideTopKInput.value = state.chatOverrideDraft.topK;
  elements.chatOverrideTopPInput.value = state.chatOverrideDraft.topP;
  elements.chatOverrideMinPInput.value = state.chatOverrideDraft.minP;
  elements.chatOverrideRepeatPenaltyInput.value = state.chatOverrideDraft.repeatPenalty;
  state.chatOverrideDraft.reasoning = renderReasoningSelect(
    elements.chatOverrideReasoningSelect,
    state.selectedModel,
    state.chatOverrideDraft.reasoning,
    "default"
  );

  if (!elements.chatOverrideMcpList) {
    return;
  }

  const mcpSection = elements.chatOverrideMcpList?.closest(".mcp-section");
  if (mcpSection) {
    mcpSection.hidden = !state.bootstrap?.mcpConfigured;
  }

  if (!state.bootstrap?.mcpConfigured) {
    elements.chatOverrideMcpList.innerHTML = "";
    return;
  }

  if (state.mcpServers.length === 0) {
    elements.chatOverrideMcpList.innerHTML = '<p class="chat-preview">No MCP servers configured.</p>';
    return;
  }

  elements.chatOverrideMcpList.innerHTML = state.mcpServers
    .map(server => {
      const active = state.selectedMcpServerIds.has(server.id);
      return `
        <button type="button" class="chip${active ? " active" : ""}" data-mcp-id="${escapeAttribute(server.id)}">
          ${escapeHtml(server.label)}
          <small>${escapeHtml(server.transport || server.description || "configured server")}</small>
        </button>`;
    })
    .join("");
}

function resetChatOverrides() {
  state.chatOverrideDraft = {
    systemPrompt: state.systemPrompt,
    reasoning: state.selectedReasoning,
    temperature: state.selectedTemperature,
    topK: state.selectedTopK,
    topP: state.selectedTopP,
    minP: state.selectedMinP,
    repeatPenalty: state.selectedRepeatPenalty,
  };
  state.selectedMcpServerIds = cloneSelectedMcpServerIds(state.defaultMcpServerIds);
  renderChatOverrideMenu();
  renderChatToolsPopup();
  renderChatToolsButton();
}

async function saveChatOverrides() {
  state.chatOverrideDraft = readChatOverrideDraftFromInputs();
  await persistCurrentChatOverrides({ closeOnSuccess: true });
}

async function persistCurrentChatOverrides(options = {}) {
  if (!state.currentChat) {
    return null;
  }

  const draft = state.chatOverrideDraft || buildChatOverrideDraft();
  const chatOverrides = buildPersistedChatOverridePayload(draft);
  state.currentChat.chatOverrides = chatOverrides;
  state.currentChat.selectedMcpServerIds = Array.from(state.selectedMcpServerIds);

  if (!state.currentChatId) {
    if (options.closeOnSuccess) {
      closeChatOverrideMenu();
    }
    render();
    if (!options.silent) {
      setStatus("Chat overrides will be applied to the next message in this draft.", "neutral");
    }
    return state.currentChat;
  }

  try {
    const updatedChat = normalizeChatRecord(await fetchJson(`/api/chats/${encodeURIComponent(state.currentChatId)}/overrides`, {
      method: "POST",
      body: JSON.stringify({
        chatOverrides,
        mcpServerIds: Array.from(normalizeSelectedMcpServerIds(Array.from(state.selectedMcpServerIds))),
      }),
    }));

    state.currentChat = updatedChat;
    state.selectedMcpServerIds = normalizeSelectedMcpServerIds(updatedChat.selectedMcpServerIds || []);
    if (options.closeOnSuccess) {
      closeChatOverrideMenu();
    } else if (!elements.chatOverrideScreen.hidden) {
      state.chatOverrideDraft = buildChatOverrideDraft();
    }
    if (options.rerender !== false) {
      render();
    } else {
      renderChatToolsButton();
    }
    if (!options.silent) {
      setStatus("Chat override settings saved.", "neutral");
    }
    return updatedChat;
  } catch (error) {
    if (!options.silent) {
      setStatus(error.message || "Unable to save chat overrides.", "error");
    }
    return null;
  }
}

function optionalValuesEqual(left, right) {
  return left === right || (left === null && right === null);
}

function toggleAutoScroll() {
  state.autoScrollEnabled = !state.autoScrollEnabled;
  saveAutoScrollPreference(state.autoScrollEnabled);

  if (state.autoScrollEnabled) {
    state.stickToBottom = true;
    syncMessageScroll(true);
  } else {
    state.stickToBottom = false;
  }

  renderAutoScrollButton();
}

function renderAutoScrollButton() {
  if (!elements.autoScrollButton && !elements.settingsAutoScrollButton) {
    return;
  }

  const enabled = state.autoScrollEnabled;
  const label = enabled ? "Disable auto-scroll" : "Enable auto-scroll";
  [elements.autoScrollButton, elements.settingsAutoScrollButton].filter(Boolean).forEach(button => {
    setButtonIcon(button, enabled ? "autoscrollOn" : "autoscrollOff");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.classList.toggle("is-active", enabled);
  });
}

async function deleteChat(chatId) {
  if (!chatId || state.streamingChatIds.has(chatId)) {
    return;
  }

  try {
    await fetchJson(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: "DELETE",
    });

    const deletingCurrent = state.currentChatId === chatId;
    await refreshChats();

    if (deletingCurrent) {
      state.currentChatId = null;
      state.currentChat = null;

      if (state.chats.length > 0) {
        await openChat(state.chats[0].id, true);
      } else {
        startNewDraft({ resetConversationSettings: true });
        clearComposerDraft();
        render();
      }
    } else {
      render();
    }

    if (state.editingChatTitleId === chatId) {
      state.editingChatTitleId = null;
      state.editingChatTitleDraft = "";
    }

    setStatus("Chat deleted.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to delete chat.", "error");
  }
}

async function exportCurrentChat() {
  if (!state.currentChatId) {
    return;
  }

  try {
    await downloadFromEndpoint(`/api/chats/${encodeURIComponent(state.currentChatId)}/export`);
    setStatus("Chat exported.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to export chat.", "error");
  }
}

async function exportMessage(messageId) {
  if (!state.currentChatId || !messageId) {
    return;
  }

  try {
    await downloadFromEndpoint(`/api/chats/${encodeURIComponent(state.currentChatId)}/messages/${encodeURIComponent(messageId)}/export`);
    setStatus("Message exported.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to export message.", "error");
  }
}

async function downloadFromEndpoint(url) {
  const response = await fetch(url, {
    credentials: "same-origin",
  });

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("Authentication required.");
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const fileName = extractFileName(response.headers.get("content-disposition")) || "export.md";
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function extractFileName(contentDisposition) {
  if (!contentDisposition) {
    return null;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return fileNameMatch?.[1] || null;
}

async function retryLatestPrompt() {
  if (isCurrentChatActivelyStreaming() || !state.currentChatId) {
    return;
  }

  const requestBody = buildChatRequestBody({ chatId: state.currentChatId, omitInput: true, omitAttachments: true });

  const pendingAssistant = {
    id: `retry_${Date.now()}`,
    role: "assistant",
    content: "",
    reasoning: "",
    thinkingActive: false,
    requestStartedAtMs: Date.now(),
    toolCalls: [],
    invalidToolCalls: [],
    attachments: [],
    modelKey: requestBody.model,
    stats: null,
    createdAt: new Date().toISOString(),
    pending: true,
  };

  state.currentChat.messages = state.currentChat.messages || [];
  // Remove the previous assistant message — the server will replace it with the new response
  const msgs = state.currentChat.messages;
  const lastAssistantIdx = msgs.reduceRight((found, msg, idx) =>
    found === -1 && msg.role === "assistant" ? idx : found, -1);
  if (lastAssistantIdx !== -1) {
    msgs.splice(lastAssistantIdx, 1);
  }
  const expectedMessageCount = state.currentChat.messages.length + 1;
  state.currentChat.messages.push(pendingAssistant);
  state.currentChat.modelKey = requestBody.model;
  state.currentChat.systemPrompt = requestBody.systemPrompt;
  state.currentChat.reasoning = requestBody.reasoning;
  state.currentChat.contextLength = requestBody.contextLength;
  state.currentChat.temperature = requestBody.temperature;
  state.currentChat.topK = requestBody.topK;
  state.currentChat.topP = requestBody.topP;
  state.currentChat.minP = requestBody.minP;
  state.currentChat.repeatPenalty = requestBody.repeatPenalty;
  state.currentChat.selectedMcpServerIds = Array.from(normalizeSelectedMcpServerIds(requestBody.mcpServerIds));
  state.isSending = true;
  state.stickToBottom = state.autoScrollEnabled;
  state.streamingChatIds.add(state.currentChatId);
  initializePendingUsageEstimate(pendingAssistant);
  setStatus("Retrying latest prompt...", "busy");
  render();

  const streamController = new AbortController();
  state.currentStreamController = streamController;
  state.currentStreamChatId = state.currentChatId;
  state.streamControllers.set(state.currentChatId, streamController);

  try {
    const response = await fetch(`/api/chats/${encodeURIComponent(state.currentChatId)}/retry/stream`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: streamController.signal,
    });

    if (response.status === 401) {
      await handleUnauthorized();
      throw new Error("Authentication required.");
    }

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    await consumeEventStream(response.body, event => applyStreamEvent(event, pendingAssistant));
    await Promise.all([refreshChats(), refreshModels()]);

    if (state.currentChatId) {
      await openChat(state.currentChatId, true);
    }

    setStatus("Response complete.", "neutral");
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Stopped.", "neutral");
      if (state.currentChatId) {
        try { await openChat(state.currentChatId, true); } catch { }
      } else if (state.currentChat?.messages) {
        state.currentChat.messages = state.currentChat.messages.filter(m => m.id !== pendingAssistant.id);
      }
      return;
    }
    if (await tryRecoverStreamFailure(error, expectedMessageCount)) {
      return;
    }

    pendingAssistant.content = describeStreamFailure(error, "Unable to retry the latest prompt.");
    pendingAssistant.isError = !looksLikeTransientStreamFailure(error);
    pendingAssistant.pending = false;
    setStatus(error.message || "Unable to retry the latest prompt.", "error");
    renderMessages();
  } finally {
    const finalStreamId = state.currentStreamChatId;
    state.currentStreamController = null;
    state.currentStreamChatId = null;
    state.streamingChatIds.delete(finalStreamId);
    state.streamingChatIds.delete(null);
    state.streamControllers.delete(finalStreamId);
    state.streamControllers.delete(null);
    state.isSending = state.streamingChatIds.size > 0 || state.serverStreamPollChatId !== null;
    render();
  }
}

async function addComposerAttachments(fileList, requestedKind) {
  const files = Array.from(fileList || []);
  if (files.length === 0) {
    return;
  }

  const nextAttachments = [];
  for (const file of files) {
    try {
      if (requestedKind === "image" || file.type.startsWith("image/")) {
        nextAttachments.push(await buildImageAttachment(file));
      } else {
        nextAttachments.push(await buildFileAttachment(file));
      }
    } catch (error) {
      setStatus(error.message || `Unable to attach ${file.name}.`, "error");
    }
  }

  if (nextAttachments.length === 0) {
    return;
  }

  state.composerAttachments = [...state.composerAttachments, ...nextAttachments];
  renderComposerAttachments();
}

function removeComposerAttachment(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.composerAttachments.length) {
    return;
  }

  state.composerAttachments = state.composerAttachments.filter((_, attachmentIndex) => attachmentIndex !== index);
  renderComposerAttachments();
}

function cloneAttachments(attachments) {
  return (attachments || []).map(attachment => ({ ...attachment }));
}

async function buildImageAttachment(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image.`);
  }

  return {
    kind: "image",
    name: file.name,
    contentType: file.type || null,
    sizeBytes: file.size,
    dataUrl: await readFileAsDataUrl(file),
    textContent: null,
    truncated: false,
  };
}

async function buildFileAttachment(file) {
  if (file.type.startsWith("image/")) {
    return buildImageAttachment(file);
  }

  let textContent = null;
  let truncated = false;
  if (isTextLikeFile(file)) {
    textContent = await file.text();
    if (textContent.length > 120000) {
      textContent = `${textContent.slice(0, 120000)}\n\n[truncated]`;
      truncated = true;
    }
  }

  return {
    kind: "file",
    name: file.name,
    contentType: file.type || null,
    sizeBytes: file.size,
    dataUrl: null,
    textContent,
    truncated,
  };
}

function isTextLikeFile(file) {
  const type = (file.type || "").toLowerCase();
  if (!type) {
    return /\.(txt|md|json|js|ts|tsx|jsx|html|css|xml|yaml|yml|csv|log|cs|py|java|go|rs|sql)$/i.test(file.name);
  }

  return type.startsWith("text/") || /(json|javascript|xml|yaml|csv|markdown)/.test(type);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function formatAttachmentMeta(attachment) {
  const parts = [formatBytes(attachment.sizeBytes)];
  if (attachment.contentType) {
    parts.push(attachment.contentType);
  }
  if (attachment.truncated) {
    parts.push("truncated");
  }
  return parts.join(" • ");
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function captureOpenDetails() {
  const states = new Map();
  elements.messageList.querySelectorAll("details[data-details-id]").forEach(detail => {
    states.set(detail.dataset.detailsId, detail.open);
  });
  return states;
}

function restoreOpenDetails(states) {
  elements.messageList.querySelectorAll("details[data-details-id]").forEach(detail => {
    const key = detail.dataset.detailsId;
    if (states.has(key)) {
      detail.open = states.get(key);
    }
  });
}

function describeLmStudioError(message) {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("no model") || msg.includes("model not loaded") || msg.includes("no loaded model") || msg.includes("no model is currently loaded")) {
    return "No model is loaded in LM Studio. Open Model Controls and load a model first.";
  }
  if (msg.includes("context") && (msg.includes("exceeded") || msg.includes("too long") || msg.includes("length"))) {
    return "The conversation exceeded the model's context window. Try reducing the context length or starting a new chat.";
  }
  return message || "LM Studio returned an error.";
}

function startEditMessage(messageId) {
  if (isCurrentChatActivelyStreaming() || !state.currentChatId) {
    return;
  }
  const message = state.currentChat?.messages?.find(m => m.id === messageId);
  if (!message || message.role !== "user") {
    return;
  }
  state.editingMessageId = messageId;
  state.editDraftContent = message.content || "";
  renderMessages();
  requestAnimationFrame(() => {
    const editTextarea = elements.messageList.querySelector(".message-edit-textarea");
    if (editTextarea) {
      editTextarea.value = state.editDraftContent;
      editTextarea.focus();
      editTextarea.selectionStart = editTextarea.value.length;
      editTextarea.selectionEnd = editTextarea.value.length;
    }
  });
}

function cancelEditMessage() {
  state.editingMessageId = null;
  state.editDraftContent = "";
  renderMessages();
}

async function saveAndRegenerateMessage(messageId, newContent) {
  if (isCurrentChatActivelyStreaming() || !state.currentChatId || !messageId) {
    return;
  }
  if (!newContent.trim()) {
    setStatus("Cannot save an empty message.", "error");
    return;
  }

  const messages = state.currentChat?.messages || [];
  const targetIndex = messages.findIndex(m => m.id === messageId);
  if (targetIndex === -1) {
    return;
  }

  const requestBody = buildChatRequestBody({ chatId: state.currentChatId, input: newContent.trim(), attachments: [] });

  const pendingAssistant = {
    id: `edit_${Date.now()}`,
    role: "assistant",
    content: "",
    reasoning: "",
    thinkingActive: false,
    requestStartedAtMs: Date.now(),
    toolCalls: [],
    invalidToolCalls: [],
    attachments: [],
    modelKey: requestBody.model,
    stats: null,
    createdAt: new Date().toISOString(),
    pending: true,
  };

  state.currentChat.messages = messages.slice(0, targetIndex);
  state.currentChat.messages.push({
    id: `local_edit_${Date.now()}`,
    role: "user",
    content: newContent.trim(),
    reasoning: null,
    toolCalls: [],
    invalidToolCalls: [],
    attachments: [],
    modelKey: requestBody.model,
    stats: null,
    createdAt: new Date().toISOString(),
  });
  state.currentChat.messages.push(pendingAssistant);
  state.currentChat.modelKey = requestBody.model;
  state.currentChat.systemPrompt = requestBody.systemPrompt;
  state.currentChat.reasoning = requestBody.reasoning;
  state.currentChat.contextLength = requestBody.contextLength;
  state.currentChat.temperature = requestBody.temperature;
  state.currentChat.topK = requestBody.topK;
  state.currentChat.topP = requestBody.topP;
  state.currentChat.minP = requestBody.minP;
  state.currentChat.repeatPenalty = requestBody.repeatPenalty;
  state.currentChat.selectedMcpServerIds = Array.from(normalizeSelectedMcpServerIds(requestBody.mcpServerIds));

  state.editingMessageId = null;
  state.editDraftContent = "";
  state.isSending = true;
  state.stickToBottom = state.autoScrollEnabled;
  state.streamingChatIds.add(state.currentChatId);
  initializePendingUsageEstimate(pendingAssistant);
  const expectedMessageCount = state.currentChat.messages.length;
  setStatus("Applying edit and regenerating...", "busy");
  render();

  const streamController = new AbortController();
  state.currentStreamController = streamController;
  state.currentStreamChatId = state.currentChatId;
  state.streamControllers.set(state.currentChatId, streamController);

  try {
    const response = await fetch(
      `/api/chats/${encodeURIComponent(state.currentChatId)}/messages/${encodeURIComponent(messageId)}/edit-stream`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: streamController.signal,
      }
    );

    if (response.status === 401) {
      await handleUnauthorized();
      throw new Error("Authentication required.");
    }

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    await consumeEventStream(response.body, event => applyStreamEvent(event, pendingAssistant));
    await Promise.all([refreshChats(), refreshModels()]);

    if (state.currentChatId) {
      await openChat(state.currentChatId, true);
    }

    setStatus("Response complete.", "neutral");
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Stopped.", "neutral");
      if (state.currentChatId) {
        try { await openChat(state.currentChatId, true); } catch { }
      } else if (state.currentChat?.messages) {
        state.currentChat.messages = state.currentChat.messages.filter(m => m.id !== pendingAssistant.id);
      }
      return;
    }
    if (await tryRecoverStreamFailure(error, expectedMessageCount)) {
      return;
    }
    pendingAssistant.content = describeStreamFailure(error);
    pendingAssistant.isError = !looksLikeTransientStreamFailure(error);
    pendingAssistant.pending = false;
    setStatus(error.message || "The request failed.", "error");
    renderMessages();
  } finally {
    const finalStreamId = state.currentStreamChatId;
    state.currentStreamController = null;
    state.currentStreamChatId = null;
    state.streamingChatIds.delete(finalStreamId);
    state.streamControllers.delete(finalStreamId);
    state.isSending = state.streamingChatIds.size > 0 || state.serverStreamPollChatId !== null;
    render();
  }
}

function renderMarkdown(value, options = {}) {
  const normalized = sanitizeMarkdownSource(String(value || "")).replace(/\r/g, "");
  if (!normalized.trim()) {
    return "";
  }

  const lines = normalized.split("\n");
  const allowCodeCopy = Boolean(options?.allowCodeCopy);
  let html = "";
  let paragraphLines = [];
  let listType = null;
  let listItems = [];
  let quoteLines = [];
  let codeFenceMarker = null;
  let codeLanguage = null;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    html += `<p>${renderInlineMarkdown(paragraphLines.join(" ").trim())}</p>`;
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      return;
    }

    html += `<${listType}>${listItems.map(item => `<li>${renderMarkdownListItem(item)}</li>`).join("")}</${listType}>`;
    listType = null;
    listItems = [];
  };

  const flushQuote = () => {
    if (quoteLines.length === 0) {
      return;
    }

    html += `<blockquote>${renderMarkdown(quoteLines.join("\n"), options)}</blockquote>`;
    quoteLines = [];
  };

  const flushCode = () => {
    if (codeLanguage === null) {
      return;
    }

    const languageClass = codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : "";
    const codeHtml = `<pre class="markdown-code"><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
    html += allowCodeCopy
      ? `<div class="markdown-code-shell"><div class="markdown-code-toolbar"><button type="button" class="ghost-button icon-button message-action-icon markdown-code-copy-button" data-copy-code-block="true" aria-label="Copy code block" title="Copy code block">${renderIcon("copy")}</button></div>${codeHtml}</div>`
      : codeHtml;
    codeFenceMarker = null;
    codeLanguage = null;
    codeLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^(```|~~~)([\w-]+)?\s*$/);
    if (codeLanguage !== null) {
      if (fenceMatch && fenceMatch[1] === codeFenceMarker) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      codeFenceMarker = fenceMatch[1];
      codeLanguage = fenceMatch[2] || "";
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }

    const headerCells = parseMarkdownTableRow(line);
    if (headerCells && isMarkdownTableSeparator(lines[index + 1])) {
      flushParagraph();
      flushList();
      flushQuote();
      const alignments = parseMarkdownTableAlignments(lines[index + 1]);
      const bodyRows = [];
      index += 1;
      while (index + 1 < lines.length) {
        const nextRow = parseMarkdownTableRow(lines[index + 1]);
        if (!nextRow) {
          break;
        }
        bodyRows.push(nextRow);
        index += 1;
      }
      html += renderMarkdownTable(headerCells, alignments, bodyRows);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = headingMatch[1].length;
      html += `<h${level}>${renderInlineMarkdown(headingMatch[2].trim())}</h${level}>`;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      continue;
    }
    flushQuote();

    const unorderedMatch = line.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1].trim());
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      flushQuote();
      html += "<hr />";
      continue;
    }

    flushList();
    paragraphLines.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushQuote();
  flushCode();

  return html;
}

function sanitizeMarkdownSource(value) {
  const lines = String(value || "").split(/\r?\n/);
  let inCodeFence = false;

  return lines.map(line => {
    if (/^(```|~~~)/.test(line.trim())) {
      inCodeFence = !inCodeFence;
      return line;
    }

    if (inCodeFence) {
      return line;
    }

    return line.replace(/<\/?[a-z][^>]*>/gi, "");
  }).join("\n");
}

function renderInlineMarkdownStyles(value) {
  let output = String(value || "");

  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  output = output.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/_([^_]+)_/g, "<em>$1</em>");

  return output;
}

function renderInlineMarkdown(value) {
  const codeTokens = [];
  const htmlTokens = [];
  let output = escapeHtml(value || "");

  const pushHtmlToken = html => {
    const token = `%%HTML${htmlTokens.length}%%`;
    htmlTokens.push(html);
    return token;
  };

  output = output.replace(/`([^`]+)`/g, (_, code) => {
    const token = `%%CODE${codeTokens.length}%%`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const safeUrl = sanitizeMarkdownUrl(url);
    if (!safeUrl) {
      return alt ? escapeHtml(alt) : "";
    }

    return pushHtmlToken(`<img src="${escapeAttribute(safeUrl)}" alt="${escapeAttribute(alt)}" loading="lazy" />`);
  });

  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = sanitizeMarkdownUrl(url);
    if (!safeUrl) {
      return label;
    }

    return pushHtmlToken(`<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener">${renderInlineMarkdownStyles(label)}</a>`);
  });

  output = output.replace(/\b(https?:\/\/[^\s<]+[^<.,;:"')\]\s])/g, match => {
    const safeUrl = sanitizeMarkdownUrl(match);
    if (!safeUrl) {
      return match;
    }

    return pushHtmlToken(`<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener">${match}</a>`);
  });

  output = renderInlineMarkdownStyles(output);

  htmlTokens.forEach((token, index) => {
    output = output.replace(`%%HTML${index}%%`, token);
  });

  codeTokens.forEach((token, index) => {
    output = output.replace(`%%CODE${index}%%`, token);
  });

  return output;
}

function renderMarkdownListItem(value) {
  const taskMatch = String(value || "").match(/^\[( |x|X)\]\s+(.+)$/);
  if (!taskMatch) {
    return renderInlineMarkdown(value);
  }

  return `<label class="markdown-task-item"><input type="checkbox" disabled ${/[xX]/.test(taskMatch[1]) ? "checked" : ""} /><span>${renderInlineMarkdown(taskMatch[2])}</span></label>`;
}

function renderMathInMarkdown(root) {
  if (!root || typeof window.renderMathInElement !== "function") {
    return;
  }

  root.querySelectorAll(".markdown-body").forEach(container => {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
        strict: "ignore",
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
      });
    } catch {
    }
  });
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function resolveResponseContextLimit(result, modelKey) {
  return firstFiniteNumber(
    result?.modelInfo?.contextLength,
    result?.model_info?.context_length,
    result?.model?.contextLength,
    result?.model?.context_length,
    parseOptionalNumber(state.selectedContextLength),
    resolveModelContextLimit(state.models.find(model => model.key === modelKey))
  );
}

function normalizeStreamStats(result, modelKey) {
  const stats = result?.stats;
  if (!stats) {
    return null;
  }

  const totalOutputTokens = firstFiniteNumber(stats.totalOutputTokens, stats.total_output_tokens);
  const reasoningOutputTokens = firstFiniteNumber(stats.reasoningOutputTokens, stats.reasoning_output_tokens);

  return {
    inputTokens: firstFiniteNumber(stats.inputTokens, stats.input_tokens),
    totalOutputTokens,
    answerOutputTokens: typeof totalOutputTokens === "number"
      ? Math.max(totalOutputTokens - (typeof reasoningOutputTokens === "number" ? reasoningOutputTokens : 0), 0)
      : null,
    reasoningOutputTokens,
    tokensPerSecond: firstFiniteNumber(stats.tokensPerSecond, stats.tokens_per_second),
    timeToFirstTokenSeconds: firstFiniteNumber(stats.timeToFirstTokenSeconds, stats.time_to_first_token_seconds),
    modelLoadTimeSeconds: firstFiniteNumber(stats.modelLoadTimeSeconds, stats.model_load_time_seconds),
    totalTimeSeconds: firstFiniteNumber(stats.totalTimeSeconds, stats.total_time_seconds),
    contextLimit: resolveResponseContextLimit(result, modelKey),
  };
}

function parseMarkdownTableRow(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.includes("|")) {
    return null;
  }

  const normalized = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  const cells = normalized.split("|").map(cell => cell.trim());
  return cells.length > 1 ? cells : null;
}

function isMarkdownTableSeparator(line) {
  const cells = parseMarkdownTableRow(line);
  return Array.isArray(cells) && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function parseMarkdownTableAlignments(line) {
  const cells = parseMarkdownTableRow(line) || [];
  return cells.map(cell => {
    if (/^:-{3,}:$/.test(cell)) {
      return "center";
    }
    if (/^-{3,}:$/.test(cell)) {
      return "right";
    }
    return "left";
  });
}

function renderMarkdownTable(headers, alignments, rows) {
  const renderCell = (tag, cell, alignment = "left") => {
    const style = alignment && alignment !== "left" ? ` style="text-align:${alignment}"` : "";
    return `<${tag}${style}>${renderInlineMarkdown(cell)}</${tag}>`;
  };

  return `
    <div class="markdown-table-wrap">
      <table>
        <thead>
          <tr>${headers.map((cell, index) => renderCell("th", cell, alignments[index])).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `<tr>${headers.map((_header, index) => renderCell("td", row[index] || "", alignments[index])).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function sanitizeMarkdownUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return null;
  }

  // Decode HTML entities introduced by escapeHtml before inline parsing runs
  const decoded = trimmed
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

  // Only accept absolute URLs with a safe scheme — prevents relative-path injection
  try {
    const parsed = new URL(decoded);
    if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
  }

  return null;
}

async function openSettings() {
  try {
    const settings = await fetchJson("/api/settings");
    elements.settingsBaseUrl.value = settings.baseUrl || "";
    elements.settingsApiToken.value = "";
    elements.settingsApiToken.dataset.originallySet = settings.hasApiToken ? "true" : "false";
    elements.settingsApiToken.dataset.modified = "false";
    elements.settingsApiToken.type = "text";
    elements.settingsApiToken.placeholder = settings.hasApiToken
      ? "Token saved — paste new value to replace, or clear to remove"
      : "Optional API token";
    elements.settingsMcpPath.value = settings.mcpConfigPath || "";
    elements.settingsChatFontScale.value = String(normalizeChatFontScale(settings.chatFontScale));
    if (elements.settingsAdaptiveMemoryEnabled) {
      elements.settingsAdaptiveMemoryEnabled.checked = settings.adaptiveMemory?.enabled === true;
    }
    if (elements.settingsAdaptiveMemoryMaxWords) {
      elements.settingsAdaptiveMemoryMaxWords.value = String(Math.max(50, Number.parseInt(settings.adaptiveMemory?.maxWords, 10) || 500));
    }
    if (elements.settingsEnterKeyBehavior) {
      elements.settingsEnterKeyBehavior.value = loadEnterKeyBehavior();
    }
    if (elements.settingsMcpUpload) {
      elements.settingsMcpUpload.value = "";
    }
    renderSelectedMcpConfigLabel(settings.mcpConfigPath);
    if (elements.settingsRequireLogin) {
      elements.settingsRequireLogin.checked = Boolean(settings.requireLogin);
    }
    if (elements.settingsPin) {
      elements.settingsPin.value = "";
      elements.settingsPin.dataset.hasExistingPin = settings.requireLogin ? "true" : "false";
    }
    elements.settingsStatus.hidden = true;
    elements.settingsStatus.textContent = "";
    elements.modelScreen.hidden = true;
    closeDefaultToolsMenu();
    closeChatOverrideMenu();
    renderSettingsSecurityState();
    renderAdaptiveMemorySettingsState();
    renderThemeButton();
    renderAutoScrollButton();
    renderMemoryDownloadButton();
    elements.settingsForm?.querySelectorAll("details.settings-section").forEach(section => {
      section.open = true;
    });
    elements.settingsScreen.hidden = false;
  } catch (error) {
    setStatus("Unable to load settings.", "error");
  }
}

function closeSettings() {
  elements.settingsScreen.hidden = true;
}

async function saveSettings() {
  elements.settingsSaveButton.disabled = true;
  elements.settingsStatus.hidden = true;
  elements.settingsStatus.textContent = "";

  let mcpConfigUpload = null;
  if (elements.settingsMcpUpload?.files?.[0]) {
    const selectedFile = elements.settingsMcpUpload.files[0];
    mcpConfigUpload = {
      fileName: selectedFile.name,
      content: await selectedFile.text(),
    };
  }

  const tokenModified = elements.settingsApiToken.dataset.modified === "true";
  const tokenWasSet = elements.settingsApiToken.dataset.originallySet === "true";
  const keepApiToken = !tokenModified && tokenWasSet;

  const payload = {
    baseUrl: elements.settingsBaseUrl.value.trim(),
    apiToken: keepApiToken ? "" : elements.settingsApiToken.value.trim(),
    keepApiToken,
    mcpConfigPath: elements.settingsMcpPath.value.trim(),
    mcpConfigUpload,
    chatFontScale: normalizeChatFontScale(elements.settingsChatFontScale?.value),
    adaptiveMemory: {
      enabled: elements.settingsAdaptiveMemoryEnabled?.checked === true,
      maxWords: Math.max(50, Number.parseInt(elements.settingsAdaptiveMemoryMaxWords?.value, 10) || 500),
      summary: state.adaptiveMemory.summary,
      lastUpdatedUtc: state.adaptiveMemory.lastUpdatedUtc,
      lastReviewedUtc: state.adaptiveMemory.lastReviewedUtc,
      sourceCursorUtc: state.adaptiveMemory.sourceCursorUtc,
    },
    requireLogin: elements.settingsRequireLogin?.checked || false,
    pin: elements.settingsPin?.value.trim() || "",
  };

  try {
    const settings = await fetchJson("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    elements.settingsStatus.textContent = "Settings saved.";
    elements.settingsStatus.className = "settings-status success";
    elements.settingsStatus.hidden = false;
    if (elements.settingsPin) {
      elements.settingsPin.value = "";
      elements.settingsPin.dataset.hasExistingPin = payload.requireLogin ? "true" : "false";
    }
    if (elements.settingsMcpUpload) {
      elements.settingsMcpUpload.value = "";
    }
    state.chatFontScale = normalizeChatFontScale(settings.chatFontScale);
    applyChatFontScale(state.chatFontScale);
    state.adaptiveMemory = normalizeAdaptiveMemoryState(settings.adaptiveMemory);
    const savedEnterBehavior = elements.settingsEnterKeyBehavior?.value === "newline" ? "newline" : "send";
    saveEnterKeyBehavior(savedEnterBehavior);
    state.enterKeyBehavior = savedEnterBehavior;
    if (state.autoScrollEnabled) {
      state.stickToBottom = true;
      syncMessageScroll(true);
    }
    renderSelectedMcpConfigLabel(settings.mcpConfigPath);
    renderSettingsSecurityState();
    renderMemoryDownloadButton();

    await refreshBootstrap();
    let warnings = [];
    if (state.bootstrap?.authenticated) {
      warnings = await loadAuthenticatedData();
    }
    render();

    if (warnings.length === 0) {
      setTimeout(() => closeSettings(), 1200);
    } else {
      elements.settingsStatus.textContent = `Settings saved. ${warnings[0]}`;
      elements.settingsStatus.className = "settings-status error";
      elements.settingsStatus.hidden = false;
    }
  } catch (error) {
    elements.settingsStatus.textContent = error.message || "Failed to save settings.";
    elements.settingsStatus.className = "settings-status error";
    elements.settingsStatus.hidden = false;
  } finally {
    elements.settingsSaveButton.disabled = false;
  }
}

function renderSettingsSecurityState() {
  if (!elements.settingsRequireLogin || !elements.settingsPin || !elements.settingsPinHint) {
    return;
  }

  const enabled = elements.settingsRequireLogin.checked;
  const hasExistingPin = elements.settingsPin.dataset.hasExistingPin === "true";
  const pinField = elements.settingsPin.closest("label.field");
  if (pinField) {
    pinField.hidden = !enabled;
  }
  elements.settingsPin.disabled = !enabled;
  elements.settingsPin.placeholder = enabled
    ? hasExistingPin
      ? "Leave blank to keep the current PIN"
      : "Enter a PIN"
    : "PIN disabled";
  elements.settingsPinHint.textContent = enabled
    ? hasExistingPin
      ? "Leave the PIN blank to keep the current one, or enter a new PIN to replace it."
      : "Enter a PIN to enable sign-in."
    : "Sign-in is currently disabled.";
}

function renderAdaptiveMemorySettingsState() {
  if (!elements.settingsAdaptiveMemoryEnabled || !elements.settingsAdaptiveMemoryMaxWords) {
    return;
  }

  const enabled = elements.settingsAdaptiveMemoryEnabled.checked;
  const wordLimitField = elements.settingsAdaptiveMemoryMaxWords.closest("label.field");
  if (wordLimitField) {
    wordLimitField.hidden = !enabled;
  }
  elements.settingsAdaptiveMemoryMaxWords.disabled = !enabled;
  renderMemoryDownloadButton();
}

async function copyMessageMarkdown(messageId) {
  const message = (state.currentChat?.messages || []).find(candidate => candidate.id === messageId && candidate.role === "assistant");
  const markdown = String(message?.content || "");
  if (!markdown) {
    setStatus("No markdown available to copy.", "error");
    return;
  }

  try {
    await writeTextToClipboard(markdown);
    setStatus("Raw markdown copied.", "neutral");
  } catch {
    setStatus("Unable to copy markdown.", "error");
  }
}

async function copyCodeBlockRaw(button) {
  const codeElement = button?.closest(".markdown-code-shell")?.querySelector("code");
  if (!codeElement) {
    setStatus("No code block available to copy.", "error");
    return;
  }

  try {
    await writeTextToClipboard(codeElement.textContent || "");
    setStatus("Code block copied.", "neutral");
  } catch {
    setStatus("Unable to copy code block.", "error");
  }
}

async function writeTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("Copy failed");
  }
}

function renderMemoryDownloadButton() {
  if (!elements.settingsDownloadMemoryButton) {
    return;
  }

  const hasSummary = Boolean(String(state.adaptiveMemory.summary || "").trim());
  elements.settingsDownloadMemoryButton.disabled = !hasSummary;
  elements.settingsDownloadMemoryButton.title = hasSummary ? "Download adaptive memory file" : "No adaptive memory summary available yet";
  elements.settingsDownloadMemoryButton.setAttribute("aria-label", elements.settingsDownloadMemoryButton.title);
}

function downloadAdaptiveMemoryFile() {
  if (!String(state.adaptiveMemory.summary || "").trim()) {
    return;
  }

  const blob = new Blob([buildAdaptiveMemoryMarkdown()], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `adaptive-memory-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function buildAdaptiveMemoryMarkdown() {
  const lines = [
    "# Adaptive Memory",
    "",
    `- Enabled: ${state.adaptiveMemory.enabled ? "Yes" : "No"}`,
    `- Word limit: ${state.adaptiveMemory.maxWords || 500}`,
    `- Last updated: ${state.adaptiveMemory.lastUpdatedUtc || "Not yet generated"}`,
    `- Last reviewed: ${state.adaptiveMemory.lastReviewedUtc || "Not yet reviewed"}`,
    "",
    state.adaptiveMemory.summary || "No adaptive memory summary is available yet.",
    ""
  ];

  return lines.join("\n");
}

function normalizeChatFontScale(value) {
  const parsed = Number.parseFloat(String(value || "1"));
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(1.2, Math.max(0.9, Math.round(parsed * 100) / 100));
}

function applyChatFontScale(value) {
  document.documentElement.style.setProperty("--chat-font-scale", String(normalizeChatFontScale(value)));
}

function renderSelectedMcpConfigLabel(currentPath = "") {
  if (!elements.settingsMcpUploadName) {
    return;
  }

  const selectedFile = elements.settingsMcpUpload?.files?.[0];
  if (selectedFile) {
    elements.settingsMcpUploadName.textContent = `Selected upload: ${selectedFile.name}`;
    elements.settingsMcpUploadName.hidden = false;
    return;
  }

  elements.settingsMcpUploadName.textContent = "";
  elements.settingsMcpUploadName.hidden = true;
}

function dismissConfigBanner() {
  state.configBannerDismissed = true;
  saveBannerDismissal(true);
  renderBanner();
}

function loadBannerDismissal() {
  try {
    return localStorage.getItem("mls-config-banner-dismissed") === "true";
  } catch {
    return false;
  }
}

function saveBannerDismissal(value) {
  try {
    localStorage.setItem("mls-config-banner-dismissed", value ? "true" : "false");
  } catch {
  }
}

function isMessageScrollNearBottom() {
  const remaining = elements.messageScroll.scrollHeight - elements.messageScroll.scrollTop - elements.messageScroll.clientHeight;
  return remaining <= 72;
}

function updateStickToBottom() {
  if (!state.autoScrollEnabled) {
    state.stickToBottom = false;
    return;
  }

  state.stickToBottom = isMessageScrollNearBottom();
}

function syncMessageScroll(force = false) {
  if (!force && (!state.autoScrollEnabled || (!state.stickToBottom && !isMessageScrollNearBottom()))) {
    return;
  }

  if (state.pendingScrollFrame) {
    cancelAnimationFrame(state.pendingScrollFrame);
  }

  state.pendingScrollFrame = requestAnimationFrame(() => {
    state.pendingScrollFrame = 0;
    elements.messageScroll.scrollTop = elements.messageScroll.scrollHeight;
    state.stickToBottom = state.autoScrollEnabled && isMessageScrollNearBottom();
  });
}

function handleDeferredMediaLoad(event) {
  if (event.target?.tagName !== "IMG") {
    return;
  }

  if (state.autoScrollEnabled && (state.stickToBottom || isMessageScrollNearBottom())) {
    syncMessageScroll();
  }
}

function openConfirmDialog(dialog) {
  state.confirmDialog = dialog;
  renderConfirmDialog();
}

function closeConfirmDialog() {
  state.confirmDialog = null;
  renderConfirmDialog();
}

function renderConfirmDialog() {
  if (!elements.confirmScreen || !elements.confirmTitle || !elements.confirmMessage || !elements.confirmAcceptButton) {
    return;
  }

  if (!state.confirmDialog) {
    elements.confirmScreen.hidden = true;
    return;
  }

  elements.confirmTitle.textContent = state.confirmDialog.title;
  elements.confirmMessage.textContent = state.confirmDialog.message;
  elements.confirmAcceptButton.textContent = state.confirmDialog.confirmText;
  elements.confirmAcceptButton.classList.toggle("danger-button", state.confirmDialog.danger !== false);
  elements.confirmScreen.hidden = false;
}

async function confirmPendingAction() {
  const dialog = state.confirmDialog;
  closeConfirmDialog();

  if (!dialog) {
    return;
  }

  switch (dialog.kind) {
    case "delete-chat":
      await deleteChat(dialog.payload.chatId);
      break;
    case "swap-model":
      await executeModelLoad(dialog.payload.targetModel, dialog.payload.unloadInstanceIds);
      break;
    default:
      break;
  }
}

function startRenameChat(chatId) {
  const chat = state.chats.find(candidate => candidate.id === chatId);
  if (!chatId || !chat) {
    return;
  }

  state.editingChatTitleId = chatId;
  state.editingChatTitleDraft = chat.title || "";
  renderChatList();
  focusRenameChatInput(chatId);
}

function cancelRenameChat(chatId) {
  if (!chatId || state.editingChatTitleId !== chatId) {
    return;
  }

  state.editingChatTitleId = null;
  state.editingChatTitleDraft = "";
  renderChatList();
}

function focusRenameChatInput(chatId) {
  requestAnimationFrame(() => {
    const input = Array.from(elements.chatList.querySelectorAll("input[data-rename-chat-input]")).find(candidate => candidate.dataset.renameChatInput === chatId);
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  });
}

async function saveRenamedChat(chatId) {
  const chat = state.chats.find(candidate => candidate.id === chatId);
  if (!chatId || !chat || state.editingChatTitleId !== chatId) {
    return;
  }

  const trimmedTitle = state.editingChatTitleDraft.trim();
  if (!trimmedTitle) {
    setStatus("Chat title cannot be empty.", "error");
    focusRenameChatInput(chatId);
    return;
  }

  if (trimmedTitle === chat.title) {
    cancelRenameChat(chatId);
    return;
  }

  try {
    const payload = await fetchJson(`/api/chats/${encodeURIComponent(chatId)}/title`, {
      method: "POST",
      body: JSON.stringify({ title: trimmedTitle }),
    });
    state.editingChatTitleId = null;
    state.editingChatTitleDraft = "";
    if (state.currentChat?.id === chatId) {
      state.currentChat.title = payload?.title || trimmedTitle;
      renderChatToolbar();
    }
    await refreshChats();
    setStatus(`Renamed chat to ${payload?.title || trimmedTitle}.`, "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to rename the chat.", "error");
    focusRenameChatInput(chatId);
  }
}

function promptDeleteChat(chatId) {
  if (!chatId || state.streamingChatIds.has(chatId)) {
    return;
  }

  const chat = state.chats.find(candidate => candidate.id === chatId);
  openConfirmDialog({
    kind: "delete-chat",
    title: "Delete this chat?",
    message: `"${chat?.title || "This chat"}" will be removed permanently.`,
    confirmText: "Delete",
    danger: true,
    payload: { chatId },
  });
}

function renderActionIcons() {
  setButtonIcon(elements.drawerToggle, "menu");
  setButtonIcon(elements.modelButton, "sliders");
  setButtonIcon(elements.topToolsButton, "tools");
  setButtonIcon(elements.exportChatButton, "download");
  setButtonIcon(elements.deleteChatButton, "trash");
  setButtonIcon(elements.settingsButton, "gear");
  setButtonIcon(elements.chatOverrideButton, "ellipsis");
  setButtonIcon(elements.logoutButton, "lock");
  setButtonIcon(elements.chatToolsButton, "tools");
  setButtonIcon(elements.speechInputButton, "mic");
  setButtonIcon(elements.attachButton, "paperclip");
  setButtonIcon(elements.settingsMcpUploadButton, "upload");
  setButtonIcon(elements.settingsDownloadMemoryButton, "download");
  setButtonIcon(elements.configBannerDismiss, "close");
  setButtonIcon(elements.modelRefreshButton, "refresh");
  renderThemeButton();
  renderAutoScrollButton();
  renderSpeechInputButton();
  renderTopBarActions();
}

function renderSpeechInputButton() {
  if (!elements.speechInputButton) {
    return;
  }

  const supported = Boolean(SpeechRecognitionCtor);
  const active = state.isDictating;
  setButtonIcon(elements.speechInputButton, active ? "micOff" : "mic");
  elements.speechInputButton.disabled = !supported;
  elements.speechInputButton.classList.toggle("is-active", active);
  const label = !supported
    ? "Dictation is not supported in this browser"
    : active
      ? "Stop dictation"
      : "Start dictation";
  elements.speechInputButton.title = label;
  elements.speechInputButton.setAttribute("aria-label", label);
}

function renderThemeButton() {
  const label = state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  [elements.themeButton, elements.settingsThemeButton].filter(Boolean).forEach(button => {
    setButtonIcon(button, state.theme === "dark" ? "sun" : "moon");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
    button.classList.toggle("is-active", state.theme === "dark");
  });
}

function setButtonIcon(element, iconName) {
  if (!element) {
    return;
  }

  element.innerHTML = renderIcon(iconName);
}

function renderIcon(iconName) {
  switch (iconName) {
    case "menu":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>';
    case "chevronDown":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
    case "chevronUp":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"></path></svg>';
    case "sliders":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path><circle cx="9" cy="6" r="2"></circle><circle cx="15" cy="12" r="2"></circle><circle cx="11" cy="18" r="2"></circle></svg>';
    case "download":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 19h14"></path></svg>';
    case "upload":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V10"></path><path d="m8 14 4-4 4 4"></path><path d="M5 5h14"></path></svg>';
    case "copy":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path></svg>';
    case "send":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 12-15-7 4 7-4 7 15-7Z"></path></svg>';
    case "stop":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';
    case "trash":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 12h10l1-12"></path><path d="M9 7V4h6v3"></path></svg>';
    case "gear":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 2.8h2.8l.5 2.1c.55.16 1.07.38 1.56.65l1.95-.97 1.98 1.98-.97 1.95c.28.49.5 1.01.65 1.56l2.13.5v2.8l-2.13.5a7.3 7.3 0 0 1-.65 1.56l.97 1.95-1.98 1.98-1.95-.97a7.3 7.3 0 0 1-1.56.65l-.5 2.13h-2.8l-.5-2.13a7.3 7.3 0 0 1-1.56-.65l-1.95.97-1.98-1.98.97-1.95a7.3 7.3 0 0 1-.65-1.56l-2.13-.5v-2.8l2.13-.5c.16-.55.38-1.07.65-1.56l-.97-1.95 1.98-1.98 1.95.97c.49-.28 1.01-.5 1.56-.65Z"></path><circle cx="12" cy="12" r="3.1"></circle></svg>';
    case "lock":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 1 1 8 0v3"></path></svg>';
    case "image":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="1.5"></circle><path d="m21 15-4.5-4.5L8 19"></path></svg>';
    case "file":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"></path><path d="M14 3v5h5"></path></svg>';
    case "close":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
    case "sun":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2.5"></path><path d="M12 19.5V22"></path><path d="m4.9 4.9 1.8 1.8"></path><path d="m17.3 17.3 1.8 1.8"></path><path d="M2 12h2.5"></path><path d="M19.5 12H22"></path><path d="m4.9 19.1 1.8-1.8"></path><path d="m17.3 6.7 1.8-1.8"></path></svg>';
    case "moon":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"></path></svg>';
    case "paperclip":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
    case "mic":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path><path d="M8 21h8"></path></svg>';
    case "micOff":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path><path d="M8 21h8"></path><path d="M4 4l16 16"></path></svg>';
    case "speaker":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M18 6a8.5 8.5 0 0 1 0 12"></path></svg>';
    case "speakerOff":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"></path><path d="M16 9l5 5"></path><path d="M21 9l-5 5"></path></svg>';
    case "retry":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v6h6"></path><path d="M21 12a9 9 0 0 0-15-6.7L3 9"></path><path d="M21 21v-6h-6"></path><path d="M3 12a9 9 0 0 0 15 6.7L21 15"></path></svg>';
    case "pencil":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';
    case "refresh":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path></svg>';
    case "autoscrollOn":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"></path><path d="M4 12h10"></path><path d="M4 17h6"></path><path d="M18 9v8"></path><path d="m15 14 3 3 3-3"></path></svg>';
    case "autoscrollOff":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10"></path><path d="M4 12h10"></path><path d="M4 17h6"></path><path d="M18 9v8"></path><path d="m15 14 3 3 3-3"></path><path d="M5 5l14 14"></path></svg>';
    case "tools":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>';
    case "ellipsis":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle></svg>';
    default:
      return "";
  }
}

function looksLikeTransientStreamFailure(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("load failed")
    || message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network connection was lost");
}

function describeStreamFailure(error, fallback = "The request failed.") {
  if (looksLikeTransientStreamFailure(error)) {
    return "The live stream disconnected. This chat will refresh automatically when the page reconnects.";
  }

  return error?.message || fallback;
}

async function tryRecoverStreamFailure(error, expectedMessageCount) {
  if (!state.currentChatId || !looksLikeTransientStreamFailure(error)) {
    return false;
  }

  state.pendingStreamRecoveryChatId = state.currentChatId;

  try {
    await refreshChats();
    await openChat(state.currentChatId, true);
    const messages = state.currentChat?.messages || [];
    const latestMessage = messages[messages.length - 1];
    if (messages.length >= expectedMessageCount && latestMessage?.role === "assistant") {
      state.pendingStreamRecoveryChatId = null;
      setStatus("Live stream reconnected and refreshed.", "neutral");
      syncMessageScroll(true);
      return true;
    }
  } catch {
  }

  return false;
}

async function recoverInterruptedStream() {
  if (!state.pendingStreamRecoveryChatId || state.isSending) {
    return;
  }

  try {
    await refreshChats();
    if (state.currentChatId === state.pendingStreamRecoveryChatId) {
      await openChat(state.currentChatId, true);
    }
    state.pendingStreamRecoveryChatId = null;
    setStatus("Chat refreshed after reconnecting.", "neutral");
  } catch {
  }
}

async function toggleSpeechInput() {
  if (state.isDictating) {
    stopSpeechInput();
    return;
  }

  if (!SpeechRecognitionCtor) {
    setStatus("Speech-to-text is not supported in this browser.", "error");
    return;
  }

  try {
    const recognition = new SpeechRecognitionCtor();
    const initialText = elements.messageInput.value;
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      state.isDictating = true;
      state.speechRecognition = recognition;
      renderSpeechInputButton();
      setStatus("Listening...", "busy");
    };

    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript || "")
        .join(" ")
        .trim();
      elements.messageInput.value = [initialText.trimEnd(), transcript].filter(Boolean).join(initialText.trim() ? " " : "");
      autoResizeComposer();
    };

    recognition.onerror = event => {
      state.isDictating = false;
      state.speechRecognition = null;
      renderSpeechInputButton();
      setStatus(event.error === "not-allowed" ? "Microphone access was denied." : "Dictation failed.", "error");
    };

    recognition.onend = () => {
      const wasDictating = state.isDictating;
      state.isDictating = false;
      state.speechRecognition = null;
      renderSpeechInputButton();
      if (wasDictating) {
        setStatus("Dictation complete.", "neutral");
      }
    };

    recognition.start();
  } catch (error) {
    state.isDictating = false;
    state.speechRecognition = null;
    renderSpeechInputButton();
    setStatus(error.message || "Unable to start dictation.", "error");
  }
}

function stopSpeechInput() {
  try {
    state.speechRecognition?.stop();
  } catch {
  }
  state.isDictating = false;
  state.speechRecognition = null;
  renderSpeechInputButton();
  setStatus("Dictation stopped.", "neutral");
}

function toggleMessageSpeech(messageId) {
  if (!window.speechSynthesis) {
    setStatus("Text-to-speech is not supported in this browser.", "error");
    return;
  }

  if (state.speakingMessageId === messageId) {
    cancelMessageSpeech();
    return;
  }

  const message = (state.currentChat?.messages || []).find(candidate => candidate.id === messageId);
  const text = getSpeakableMessageText(message);
  if (!text) {
    return;
  }

  cancelMessageSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language || "en-US";
  utterance.onend = () => {
    state.speakingMessageId = null;
    renderMessages();
  };
  utterance.onerror = () => {
    state.speakingMessageId = null;
    renderMessages();
    setStatus("Unable to read the message aloud.", "error");
  };

  state.speakingMessageId = messageId;
  renderMessages();
  window.speechSynthesis.speak(utterance);
  setStatus("Reading response aloud.", "neutral");
}

function cancelMessageSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (state.speakingMessageId) {
    state.speakingMessageId = null;
    renderMessages();
  }
}

function getSpeakableMessageText(message) {
  const content = String(message?.content || "").trim();
  if (!content) {
    return "";
  }

  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[>#*_~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stopStreamWaitPolling() {
  if (state.serverStreamPollTimer !== null) {
    clearInterval(state.serverStreamPollTimer);
    state.serverStreamPollTimer = null;
  }
  state.serverStreamPollChatId = null;
  state.isSending = state.streamingChatIds.size > 0;
}

function isCurrentChatActivelyStreaming() {
  const chatId = state.currentChatId;
  return state.streamingChatIds.has(chatId) ||
         (chatId !== null && state.serverStreamPollChatId === chatId);
}

function stopStream() {
  const chatId = state.currentChatId;
  const controller = state.streamControllers.get(chatId);
  if (controller) {
    if (chatId) {
      fetch(`/api/chats/${encodeURIComponent(chatId)}/stop`, { method: "POST", credentials: "same-origin" }).catch(() => {});
    }
    controller.abort();
    return;
  }
  if (chatId && state.serverStreamPollChatId === chatId) {
    stopStreamWaitPolling();
    fetch(`/api/chats/${encodeURIComponent(chatId)}/stop`, { method: "POST", credentials: "same-origin" }).catch(() => {});
    if (state.currentChat?.messages) {
      state.currentChat.messages = state.currentChat.messages.filter(m => m.id !== "stream-pending-placeholder");
    }
    setStatus("Stopped.", "neutral");
    render();
  }
}

function startStreamWaitPolling(chatId) {
  stopStreamWaitPolling();
  state.serverStreamPollChatId = chatId;
  state.isSending = true;

  if (!state.currentChat) {
    return;
  }

  const initialMessageCount = state.currentChat.messages.length;

  state.currentChat.messages.push({
    id: "stream-pending-placeholder",
    role: "assistant",
    content: "",
    pending: true,
    createdAt: new Date().toISOString(),
    toolCalls: [],
    invalidToolCalls: [],
    stats: null,
  });

  setStatus("Reply in progress, waiting for model to finish...", "busy");
  render();
  syncMessageScroll(true);

  state.serverStreamPollTimer = setInterval(async () => {
    if (state.currentChatId !== chatId || state.streamingChatIds.has(chatId)) {
      stopStreamWaitPolling();
      return;
    }

    try {
      const [chatData, streamsData] = await Promise.all([
        fetchJson(`/api/chats/${encodeURIComponent(chatId)}`),
        fetchJson("/api/chats/active-streams").catch(() => ({ chatIds: [] })),
      ]);

      const hasNewMessage = (chatData.messages?.length ?? 0) > initialMessageCount;
      const isStillStreaming = (streamsData.chatIds || []).includes(chatId);

      if (hasNewMessage || !isStillStreaming) {
        stopStreamWaitPolling();
        if (state.currentChatId === chatId) {
          state.currentChat = chatData;
          await refreshChats();
          render();
          syncMessageScroll(true);
        }
        setStatus(hasNewMessage ? "Response complete." : "Ready", "neutral");
      }
    } catch {
    }
  }, 3000);
}

function toggleTopBarActions() {
  if (isDesktopLayout()) {
    return;
  }

  state.topBarActionsExpanded = !state.topBarActionsExpanded;
  renderTopBarActions();
}

function collapseTopBarActions() {
  if (isDesktopLayout() || !state.topBarActionsExpanded) {
    return;
  }

  state.topBarActionsExpanded = false;
  renderTopBarActions();
}

function syncTopBarActionsLayout() {
  if (isDesktopLayout()) {
    state.topBarActionsExpanded = false;
  }

  renderTopBarActions();
}

function isDesktopLayout() {
  return desktopLayoutMedia.matches;
}
