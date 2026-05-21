const state = {
  bootstrap: null,
  models: [],
  chats: [],
  mcpServers: [],
  currentChatId: null,
  currentChat: null,
  selectedModel: "",
  selectedReasoning: "default",
  selectedMcpServerIds: new Set(),
  selectedContextLength: "",
  selectedTemperature: "",
  systemPrompt: "",
  statusText: "Ready",
  statusTone: "neutral",
  isSending: false,
  isModelLoading: false,
  modelLoadTarget: "",
  theme: "light",
  composerAttachments: [],
  configBannerDismissed: loadBannerDismissal(),
  confirmDialog: null,
  pendingStreamRecoveryChatId: null,
  stickToBottom: true,
};

const elements = {
  chatDrawer: document.getElementById("chat-drawer"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  drawerToggle: document.getElementById("drawer-toggle"),
  drawerClose: document.getElementById("drawer-close"),
  chatList: document.getElementById("chat-list"),
  newChatButton: document.getElementById("new-chat-button"),
  connectionPill: document.getElementById("connection-pill"),
  modelButton: document.getElementById("model-button"),
  themeButton: document.getElementById("theme-button"),
  settingsButton: document.getElementById("settings-button"),
  logoutButton: document.getElementById("logout-button"),
  configBanner: document.getElementById("config-banner"),
  configBannerText: document.getElementById("config-banner-text"),
  configBannerDismiss: document.getElementById("config-banner-dismiss"),
  chatToolbar: document.getElementById("chat-toolbar"),
  currentChatTitle: document.getElementById("current-chat-title"),
  exportChatButton: document.getElementById("export-chat-button"),
  deleteChatButton: document.getElementById("delete-chat-button"),
  modelSelect: document.getElementById("model-select"),
  loadModelButton: document.getElementById("load-model-button"),
  unloadModelButton: document.getElementById("unload-model-button"),
  contextLengthInput: document.getElementById("context-length-input"),
  temperatureInput: document.getElementById("temperature-input"),
  reasoningSelect: document.getElementById("reasoning-select"),
  systemPromptInput: document.getElementById("system-prompt-input"),
  modelMeta: document.getElementById("model-meta"),
  mcpList: document.getElementById("mcp-list"),
  statusBar: document.getElementById("status-bar"),
  messageScroll: document.getElementById("message-scroll"),
  emptyState: document.getElementById("empty-state"),
  messageList: document.getElementById("message-list"),
  composerForm: document.getElementById("composer-form"),
  composerAttachments: document.getElementById("composer-attachments"),
  attachImageButton: document.getElementById("attach-image-button"),
  attachFileButton: document.getElementById("attach-file-button"),
  imageInput: document.getElementById("image-input"),
  fileInput: document.getElementById("file-input"),
  messageInput: document.getElementById("message-input"),
  sendButton: document.getElementById("send-button"),
  loginScreen: document.getElementById("login-screen"),
  loginForm: document.getElementById("login-form"),
  loginPinInput: document.getElementById("login-pin-input"),
  loginError: document.getElementById("login-error"),
  modelScreen: document.getElementById("model-screen"),
  modelCloseButton: document.getElementById("model-close-button"),
  settingsScreen: document.getElementById("settings-screen"),
  settingsForm: document.getElementById("settings-form"),
  settingsBaseUrl: document.getElementById("settings-base-url"),
  settingsApiToken: document.getElementById("settings-api-token"),
  settingsMcpPath: document.getElementById("settings-mcp-path"),
  settingsRequireLogin: document.getElementById("settings-require-login"),
  settingsPin: document.getElementById("settings-pin"),
  settingsPinHint: document.getElementById("settings-pin-hint"),
  settingsSaveButton: document.getElementById("settings-save-button"),
  settingsCancelButton: document.getElementById("settings-cancel-button"),
  settingsStatus: document.getElementById("settings-status"),
  confirmScreen: document.getElementById("confirm-screen"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmAcceptButton: document.getElementById("confirm-accept-button"),
  confirmCancelButton: document.getElementById("confirm-cancel-button"),
};

applyTheme(loadThemePreference());
renderActionIcons();
bindEvents();
renderConfirmDialog();
void initialize();

async function initialize() {
  autoResizeComposer();

  try {
    await refreshBootstrap();
    if (state.bootstrap.authenticated) {
      const warnings = await loadAuthenticatedData();
      if (warnings.length === 0) {
        setStatus("Ready", "neutral");
      }
    }
  } catch (error) {
    setStatus(error.message || "Unable to connect.", "error");
  }

  render();
}

function bindEvents() {
  elements.drawerToggle.addEventListener("click", () => setDrawerOpen(true));
  elements.drawerClose.addEventListener("click", () => setDrawerOpen(false));
  elements.drawerBackdrop.addEventListener("click", () => setDrawerOpen(false));
  elements.modelButton.addEventListener("click", () => openModelMenu());
  elements.modelCloseButton.addEventListener("click", () => closeModelMenu());
  elements.modelScreen.addEventListener("click", event => {
    if (event.target === elements.modelScreen) {
      closeModelMenu();
    }
  });
  elements.themeButton.addEventListener("click", () => toggleTheme());
  elements.newChatButton.addEventListener("click", () => {
    startNewDraft();
    render();
    syncMessageScroll(true);
    setDrawerOpen(false);
  });
  elements.configBannerDismiss?.addEventListener("click", () => dismissConfigBanner());
  elements.messageScroll.addEventListener("scroll", () => updateStickToBottom());
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

  elements.chatList.addEventListener("click", event => {
    const deleteButton = event.target.closest("button[data-delete-chat-id]");
    if (deleteButton) {
      promptDeleteChat(deleteButton.dataset.deleteChatId);
      return;
    }

    const button = event.target.closest("button[data-chat-id]");
    if (!button) {
      return;
    }

    void openChat(button.dataset.chatId);
  });

  elements.messageList.addEventListener("click", event => {
    const retryButton = event.target.closest("button[data-retry-chat]");
    if (retryButton) {
      void retryLatestPrompt();
      return;
    }

    const exportButton = event.target.closest("button[data-export-message-id]");
    if (exportButton?.dataset.exportMessageId) {
      void exportMessage(exportButton.dataset.exportMessageId);
      return;
    }
  });

  elements.composerAttachments.addEventListener("click", event => {
    const removeAttachmentButton = event.target.closest("button[data-remove-attachment-index]");
    if (removeAttachmentButton?.dataset.removeAttachmentIndex) {
      removeComposerAttachment(Number.parseInt(removeAttachmentButton.dataset.removeAttachmentIndex, 10));
    }
  });

  elements.mcpList.addEventListener("click", event => {
    const button = event.target.closest("button[data-mcp-id]");
    if (!button) {
      return;
    }

    const { mcpId } = button.dataset;
    if (!mcpId) {
      return;
    }

    if (state.selectedMcpServerIds.has(mcpId)) {
      state.selectedMcpServerIds.delete(mcpId);
    } else {
      state.selectedMcpServerIds.add(mcpId);
    }

    renderMcpServers();
  });

  elements.modelSelect.addEventListener("change", () => {
    state.selectedModel = elements.modelSelect.value;
    if (!state.selectedContextLength) {
      state.selectedContextLength = String(suggestContextLength(findSelectedModel()));
      elements.contextLengthInput.value = state.selectedContextLength;
    }
    normalizeReasoningSelection();
    renderModelDetails();
  });

  elements.contextLengthInput.addEventListener("input", () => {
    state.selectedContextLength = elements.contextLengthInput.value.trim();
  });

  elements.temperatureInput?.addEventListener("input", () => {
    state.selectedTemperature = elements.temperatureInput.value.trim();
  });

  elements.reasoningSelect.addEventListener("change", () => {
    state.selectedReasoning = elements.reasoningSelect.value;
  });

  elements.systemPromptInput.addEventListener("input", () => {
    state.systemPrompt = elements.systemPromptInput.value;
  });

  elements.composerForm.addEventListener("submit", event => {
    event.preventDefault();
    void sendMessage();
  });

  elements.attachImageButton.addEventListener("click", () => elements.imageInput.click());
  elements.attachFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.imageInput.addEventListener("change", event => {
    void addComposerAttachments(event.target.files, "image");
    event.target.value = "";
  });
  elements.fileInput.addEventListener("change", event => {
    void addComposerAttachments(event.target.files, "file");
    event.target.value = "";
  });

  elements.messageInput.addEventListener("input", autoResizeComposer);
  elements.messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  });

  elements.loadModelButton.addEventListener("click", () => void loadSelectedModel());
  elements.unloadModelButton.addEventListener("click", () => void unloadSelectedModel());
  elements.exportChatButton.addEventListener("click", () => void exportCurrentChat());
  elements.deleteChatButton.addEventListener("click", () => promptDeleteChat(state.currentChatId));
  elements.logoutButton.addEventListener("click", () => void logout());

  elements.loginForm.addEventListener("submit", event => {
    event.preventDefault();
    void login();
  });

  elements.settingsCancelButton.addEventListener("click", () => closeSettings());
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

  elements.settingsButton.addEventListener("click", () => openSettings());
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
}

async function loadAuthenticatedData() {
  const [modelsResult, chatsResult, mcpServersResult] = await Promise.allSettled([
    fetchJson("/api/models"),
    fetchJson("/api/chats"),
    fetchJson("/api/mcp/servers"),
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

  ensureSelectionDefaults();

  if (state.currentChatId) {
    try {
      await openChat(state.currentChatId, true);
    } catch (error) {
      warnings.push(error.message || "Unable to open the current chat.");
      startNewDraft();
      render();
    }
  } else if (state.chats.length > 0) {
    try {
      await openChat(state.chats[0].id, true);
    } catch (error) {
      warnings.push(error.message || "Unable to open the latest chat.");
      startNewDraft();
      render();
    }
  } else {
    startNewDraft();
    render();
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
    state.selectedContextLength = String(suggestContextLength(findSelectedModel()));
  }

  normalizeReasoningSelection();
}

function startNewDraft() {
  ensureSelectionDefaults();
  state.currentChatId = null;
  state.stickToBottom = true;
  state.currentChat = {
    id: null,
    title: "New Chat",
    modelKey: state.selectedModel,
    systemPrompt: state.systemPrompt,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
    temperature: parseOptionalFloat(state.selectedTemperature),
    selectedMcpServerIds: Array.from(state.selectedMcpServerIds),
    messages: [],
  };
}

async function openChat(chatId, suppressStatus = false) {
  try {
    state.currentChat = await fetchJson(`/api/chats/${encodeURIComponent(chatId)}`);
    state.currentChatId = state.currentChat.id;
    state.selectedModel = state.currentChat.modelKey || state.selectedModel;
    state.systemPrompt = state.currentChat.systemPrompt || "";
    state.selectedReasoning = state.currentChat.reasoning || "default";
    state.selectedContextLength = state.currentChat.contextLength ? String(state.currentChat.contextLength) : String(suggestContextLength(findSelectedModel()));
    state.selectedTemperature = typeof state.currentChat.temperature === "number" ? String(state.currentChat.temperature) : "";
    state.selectedMcpServerIds = new Set(state.currentChat.selectedMcpServerIds || []);
    state.stickToBottom = true;
    normalizeReasoningSelection();
    render();
    syncMessageScroll(true);
    setDrawerOpen(false);

    if (!suppressStatus) {
      setStatus(`Opened ${state.currentChat.title}.`, "neutral");
    }
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

  if ((selectedModel.loadedInstances || []).length > 0) {
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

async function executeModelLoad(modelKey, unloadInstanceIds = []) {
  state.isModelLoading = true;
  state.modelLoadTarget = modelKey;
  renderControls();

  try {
    setStatus(unloadInstanceIds.length > 0 ? "Switching models..." : "Loading model...", "busy");
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
    setStatus("Model loaded.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to load the selected model.", "error");
  } finally {
    state.isModelLoading = false;
    state.modelLoadTarget = "";
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
  const payload = await fetchJson("/api/models");
  state.models = payload.models || [];
  ensureSelectionDefaults();
  render();
}

async function refreshChats() {
  state.chats = await fetchJson("/api/chats");
  renderChatList();
}

async function sendMessage() {
  if (state.isSending) {
    return;
  }

  const input = elements.messageInput.value.trim();
  const attachments = cloneAttachments(state.composerAttachments);
  if (!input && attachments.length === 0) {
    return;
  }

  if (!state.selectedModel) {
    setStatus("Choose a model first.", "error");
    return;
  }

  const requestBody = {
    chatId: state.currentChatId,
    model: state.selectedModel,
    input,
    systemPrompt: state.systemPrompt.trim() || null,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
    temperature: parseOptionalFloat(state.selectedTemperature),
    mcpServerIds: Array.from(state.selectedMcpServerIds),
    attachments,
  };

  if (!state.currentChat) {
    startNewDraft();
  }

  const pendingAssistant = {
    id: `pending_${Date.now()}`,
    role: "assistant",
    content: "",
    reasoning: "",
    toolCalls: [],
    invalidToolCalls: [],
    stats: null,
    attachments: [],
    modelKey: state.selectedModel,
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
    modelKey: state.selectedModel,
    stats: null,
    createdAt: new Date().toISOString(),
  });
  state.currentChat.messages.push(pendingAssistant);
  state.currentChat.title = summarizeTitle(input || attachments[0]?.name || "New Chat");
  state.currentChat.modelKey = state.selectedModel;
  state.currentChat.systemPrompt = state.systemPrompt;
  state.currentChat.reasoning = normalizeReasoningValue();
  state.currentChat.contextLength = parseOptionalNumber(state.selectedContextLength);
  state.currentChat.temperature = parseOptionalFloat(state.selectedTemperature);
  state.currentChat.selectedMcpServerIds = Array.from(state.selectedMcpServerIds);
  state.isSending = true;
  state.stickToBottom = true;
  elements.messageInput.value = "";
  state.composerAttachments = [];
  autoResizeComposer();
  setStatus("Waiting for LM Studio...", "busy");
  render();

  try {
    const response = await fetch("/api/chats/stream", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
      state.currentChatId = newChatId;
      state.currentChat.id = newChatId;
    }

    await consumeEventStream(response.body, event => applyStreamEvent(event, pendingAssistant));
    await Promise.all([refreshChats(), refreshModels()]);

    if (state.currentChatId) {
      await openChat(state.currentChatId, true);
    }

    setStatus("Response complete.", "neutral");
  } catch (error) {
    if (await tryRecoverStreamFailure(error, expectedMessageCount)) {
      return;
    }

    pendingAssistant.content = describeStreamFailure(error);
    pendingAssistant.pending = false;
    setStatus(error.message || "The request failed.", "error");
    renderMessages();
  } finally {
    state.isSending = false;
    render();
  }
}

function applyStreamEvent(event, pendingAssistant) {
  switch (event.type) {
    case "chat.start":
      pendingAssistant.modelKey = resolveModelKeyFromInstanceId(event.data.model_instance_id) || pendingAssistant.modelKey || state.selectedModel;
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
      pendingAssistant.reasoning = `${pendingAssistant.reasoning || ""}${event.data.content || ""}`;
      renderMessages();
      break;
    case "message.delta":
      pendingAssistant.content = `${pendingAssistant.content || ""}${event.data.content || ""}`;
      renderMessages();
      break;
    case "tool_call.start":
      pendingAssistant.toolCalls.push({
        tool: event.data.tool || "tool",
        argumentsJson: "{}",
        output: "",
        provider: event.data.providerInfo || null,
      });
      renderMessages();
      break;
    case "tool_call.arguments": {
      const currentTool = pendingAssistant.toolCalls[pendingAssistant.toolCalls.length - 1];
      if (currentTool) {
        currentTool.argumentsJson = JSON.stringify(event.data.arguments || {}, null, 2);
      }
      renderMessages();
      break;
    }
    case "tool_call.success": {
      const currentTool = pendingAssistant.toolCalls[pendingAssistant.toolCalls.length - 1];
      if (currentTool) {
        currentTool.output = event.data.output || "";
      }
      renderMessages();
      break;
    }
    case "tool_call.failure":
      pendingAssistant.invalidToolCalls.push({
        reason: "Tool call failed",
        metadataJson: JSON.stringify(event.data, null, 2),
      });
      renderMessages();
      break;
    case "chat.end":
      applyFinalResponse(pendingAssistant, event.data);
      renderMessages();
      break;
    case "error":
      throw new Error(event.data.message || "The LM Studio stream returned an error.");
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
  message.stats = result.stats
    ? {
        inputTokens: result.stats.inputTokens,
        totalOutputTokens: result.stats.totalOutputTokens,
        reasoningOutputTokens: result.stats.reasoningOutputTokens,
        tokensPerSecond: result.stats.tokensPerSecond,
        timeToFirstTokenSeconds: result.stats.timeToFirstTokenSeconds,
        modelLoadTimeSeconds: result.stats.modelLoadTimeSeconds,
        contextLimit: parseOptionalNumber(state.selectedContextLength),
      }
    : null;
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
  renderChatList();
  renderMessages();
  renderComposerAttachments();
  renderConfirmDialog();
  renderStatus();
}

function renderAuthState() {
  const authenticated = !state.bootstrap?.requireLogin || state.bootstrap?.authenticated;
  elements.loginScreen.hidden = authenticated;
  elements.logoutButton.hidden = !state.bootstrap?.requireLogin;
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
    warnings.push("Set LmStudio:McpConfigPath to list MCP servers inside the client.");
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
  elements.systemPromptInput.value = state.systemPrompt;
  elements.contextLengthInput.value = state.selectedContextLength;
  if (elements.temperatureInput) {
    elements.temperatureInput.value = state.selectedTemperature;
  }
  const locked = !state.bootstrap?.authenticated && state.bootstrap?.requireLogin;
  elements.sendButton.disabled = state.isSending || locked || !state.selectedModel;
  elements.messageInput.disabled = state.isSending || locked;
  elements.attachImageButton.disabled = state.isSending || locked;
  elements.attachFileButton.disabled = state.isSending || locked;
  elements.themeButton.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
  renderThemeButton();
}

function renderChatToolbar() {
  const title = state.currentChat?.title || "New Chat";
  elements.currentChatTitle.textContent = title;

  const hasSavedChat = Boolean(state.currentChatId);
  elements.exportChatButton.disabled = !hasSavedChat;
  elements.deleteChatButton.disabled = !hasSavedChat;
  elements.chatToolbar?.classList.toggle("is-draft", !hasSavedChat);
}

function renderModelOptions() {
  const llmModels = state.models.filter(model => model.type === "llm");
  const models = llmModels.length > 0 ? llmModels : state.models;

  if (models.length === 0) {
    elements.modelSelect.innerHTML = '<option value="">No models found</option>';
    return;
  }

  elements.modelSelect.innerHTML = models
    .map(model => `<option value="${escapeAttribute(model.key)}" ${model.key === state.selectedModel ? "selected" : ""}>${escapeHtml(buildModelOptionLabel(model))}</option>`)
    .join("");
}

function renderReasoningOptions() {
  const allowedOptions = findSelectedModel()?.capabilities?.reasoning?.allowedOptions || [];
  const options = [{ value: "default", label: "Default" }, ...allowedOptions.map(option => ({ value: option, label: capitalize(option) }))];
  if (options.length === 1 && allowedOptions.length === 0) {
    options.push({ value: "off", label: "Off" });
  }

  if (!options.some(option => option.value === state.selectedReasoning)) {
    state.selectedReasoning = "default";
  }

  elements.reasoningSelect.innerHTML = options
    .map(option => `<option value="${escapeAttribute(option.value)}" ${option.value === state.selectedReasoning ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
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
    `${formatInteger(model.maxContextLength)} max ctx`,
    capabilityParts.join(" • "),
  ].filter(Boolean);

  elements.modelMeta.textContent = metaParts.join(" • ");
  elements.loadModelButton.disabled = state.isModelLoading || loadedCount > 0;
  elements.loadModelButton.innerHTML = isLoadingSelected
    ? '<span class="button-content"><span class="button-spinner" aria-hidden="true"></span><span>Loading...</span></span>'
    : loadedCount > 0
      ? "Loaded"
      : "Load";
  elements.unloadModelButton.disabled = state.isModelLoading || loadedCount === 0;
}

function renderMcpServers() {
  if (state.mcpServers.length === 0) {
    elements.mcpList.innerHTML = '<p class="chat-preview">No MCP servers were found at the configured mcp.json path.</p>';
    return;
  }

  elements.mcpList.innerHTML = state.mcpServers
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

function renderChatList() {
  if (state.chats.length === 0) {
    elements.chatList.innerHTML = '<p class="chat-preview">No chats saved yet.</p>';
    return;
  }

  elements.chatList.innerHTML = state.chats
    .map(chat => `
      <article class="chat-item${chat.id === state.currentChatId ? " active" : ""}">
        <button type="button" class="chat-open" data-chat-id="${escapeAttribute(chat.id)}">
          <span class="chat-title">${escapeHtml(chat.title)}</span>
          <span class="chat-meta">${escapeHtml(chat.modelKey)} • ${escapeHtml(formatRelativeDate(chat.updatedAt))}</span>
          <span class="chat-preview">${escapeHtml(chat.preview || "Saved chat")}</span>
        </button>
        <button type="button" class="chat-delete" data-delete-chat-id="${escapeAttribute(chat.id)}" aria-label="Delete ${escapeAttribute(chat.title)}" title="Delete ${escapeAttribute(chat.title)}">${renderIcon("trash")}</button>
      </article>`)
    .join("");
}

function renderMessages(forceScroll = false) {
  const messages = state.currentChat?.messages || [];
  const hasMessages = messages.length > 0;
  elements.emptyState.hidden = hasMessages;
  elements.messageList.innerHTML = hasMessages ? messages.map(renderMessageCard).join("") : "";
  syncMessageScroll(forceScroll || state.isSending);
}

function renderStatus() {
  elements.statusBar.dataset.tone = state.statusTone;
  elements.statusBar.textContent = state.statusText;
}

function renderMessageCard(message) {
  const roleLabel = message.role === "user" ? "You" : resolveAssistantLabel(message);
  const contentBlock = message.content
    ? `<div class="message-body markdown-body">${renderMarkdown(message.content)}</div>`
    : message.pending
      ? '<div class="message-body">Waiting for tokens...</div>'
      : "";

  const reasoningBlock = message.reasoning
    ? `
      <details class="details-block">
        <summary>Thinking</summary>
        <div class="details-body markdown-body">${renderMarkdown(message.reasoning)}</div>
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
      <details class="details-block">
        <summary>Tools Used (${message.toolCalls.length})</summary>
        ${message.toolCalls.map(renderToolCall).join("")}
      </details>`
    : "";

  const invalidToolCallsBlock = message.invalidToolCalls?.length
    ? `
      <details class="details-block">
        <summary>Tool Errors (${message.invalidToolCalls.length})</summary>
        ${message.invalidToolCalls.map(renderInvalidToolCall).join("")}
      </details>`
    : "";

  const statsBlock = message.stats
    ? `
      <div class="stats-row">
        <span>${escapeHtml(`${formatNumber(message.stats.tokensPerSecond)} tok/s`)}</span>
        <span class="divider">•</span>
        <span>${escapeHtml(`${formatInteger(message.stats.inputTokens)} ctx`)}</span>
        <span class="divider">•</span>
        <span>${escapeHtml(`${formatInteger(message.stats.totalOutputTokens)} out`)}</span>
        ${message.stats.reasoningOutputTokens ? `<span class="divider">•</span><span>${escapeHtml(`${formatInteger(message.stats.reasoningOutputTokens)} think`)}</span>` : ""}
      </div>`
    : "";

  const contextBlock = renderContextMeter(message);
  const canExport = Boolean(state.currentChatId) && !message.pending;
  const canRetry = Boolean(state.currentChatId) && !message.pending && message.role === "assistant" && isLatestAssistantMessage(message);
  const actionsBlock = canExport || canRetry
    ? `
      <div class="message-actions">
        ${canRetry ? '<button type="button" class="ghost-button message-action-button" data-retry-chat="true">Retry Prompt</button>' : ""}
        ${canExport ? `<button type="button" class="ghost-button icon-button message-action-icon" data-export-message-id="${escapeAttribute(message.id)}" aria-label="Export Markdown" title="Export Markdown">${renderIcon("download")}</button>` : ""}
      </div>`
    : "";

  return `
    <article class="message-card ${message.role === "user" ? "user" : "assistant"}">
      <div class="message-head">
        <span class="message-role">${escapeHtml(roleLabel)}</span>
        <time class="message-time">${escapeHtml(formatClock(message.createdAt))}</time>
      </div>
      ${contentBlock}
      ${attachmentsBlock}
      ${reasoningBlock}
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

function findSelectedModel() {
  return state.models.find(model => model.key === state.selectedModel) || null;
}

function suggestContextLength(model) {
  if (!model?.maxContextLength) {
    return 8192;
  }

  return Math.min(model.maxContextLength, 8192);
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
    return payload.detail || payload.error || payload.title || "The request failed.";
  }

  return (await response.text()) || `Request failed with ${response.status}.`;
}

function autoResizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${elements.messageInput.scrollHeight}px`;
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

function summarizeTitle(input) {
  const trimmed = input.replace(/\s+/g, " ").trim();
  return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`;
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
    return "0.0";
  }

  return value.toFixed(1);
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
        ${attachment.kind === "image" && attachment.dataUrl ? `<img src="${escapeAttribute(attachment.dataUrl)}" alt="${escapeAttribute(attachment.name)}" loading="lazy" />` : ""}
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
      ${attachment.kind === "image" && attachment.dataUrl ? `<img src="${escapeAttribute(attachment.dataUrl)}" alt="${escapeAttribute(attachment.name)}" loading="lazy" />` : ""}
      <div class="message-attachment-meta">
        <strong>${escapeHtml(attachment.name)}</strong>
        <span>${escapeHtml(formatAttachmentMeta(attachment))}</span>
      </div>
    </article>`;
}

function renderContextMeter(message) {
  const limit = message.stats?.contextLimit;
  const used = message.stats?.inputTokens;
  if (!limit || !used) {
    return "";
  }

  const remaining = Math.max(limit - used, 0);
  const percent = Math.max(4, Math.min(100, (used / limit) * 100));

  return `
    <div class="context-meter">
      <div class="context-meter-head">
        <span>${escapeHtml(`${formatInteger(used)} used`)}</span>
        <span>${escapeHtml(`${formatInteger(remaining)} remaining`)}</span>
      </div>
      <div class="context-meter-bar" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </div>
    </div>`;
}

function resolveAssistantLabel(message) {
  return message.modelKey || state.currentChat?.modelKey || state.selectedModel || "Model";
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

function openModelMenu() {
  elements.settingsScreen.hidden = true;
  elements.modelScreen.hidden = false;
}

function closeModelMenu() {
  elements.modelScreen.hidden = true;
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

async function deleteChat(chatId) {
  if (!chatId || state.isSending) {
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
        startNewDraft();
        render();
      }
    } else {
      render();
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
  if (state.isSending || !state.currentChatId) {
    return;
  }

  const pendingAssistant = {
    id: `retry_${Date.now()}`,
    role: "assistant",
    content: "",
    reasoning: "",
    toolCalls: [],
    invalidToolCalls: [],
    attachments: [],
    modelKey: state.currentChat?.modelKey || state.selectedModel,
    stats: null,
    createdAt: new Date().toISOString(),
    pending: true,
  };

  state.currentChat.messages = state.currentChat.messages || [];
  const expectedMessageCount = state.currentChat.messages.length + 1;
  state.currentChat.messages.push(pendingAssistant);
  state.isSending = true;
  state.stickToBottom = true;
  setStatus("Retrying latest prompt...", "busy");
  render();

  try {
    const response = await fetch(`/api/chats/${encodeURIComponent(state.currentChatId)}/retry/stream`, {
      method: "POST",
      credentials: "same-origin",
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
    if (await tryRecoverStreamFailure(error, expectedMessageCount)) {
      return;
    }

    pendingAssistant.content = describeStreamFailure(error, "Unable to retry the latest prompt.");
    pendingAssistant.pending = false;
    setStatus(error.message || "Unable to retry the latest prompt.", "error");
    renderMessages();
  } finally {
    state.isSending = false;
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

  function renderMarkdown(value) {
    const normalized = sanitizeMarkdownSource(String(value || "")).replace(/\r/g, "");
    if (!normalized.trim()) {
      return "";
    }

    const lines = normalized.split("\n");
    let html = "";
    let paragraphLines = [];
    let listType = null;
    let listItems = [];
    let quoteLines = [];
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

      html += `<${listType}>${listItems.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listType}>`;
      listType = null;
      listItems = [];
    };

    const flushQuote = () => {
      if (quoteLines.length === 0) {
        return;
      }

      html += `<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`;
      quoteLines = [];
    };

    const flushCode = () => {
      if (codeLanguage === null) {
        return;
      }

      const languageClass = codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : "";
      html += `<pre class="markdown-code"><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`;
      codeLanguage = null;
      codeLines = [];
    };

    for (const line of lines) {
      const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
      if (codeLanguage !== null) {
        if (fenceMatch) {
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
        codeLanguage = fenceMatch[1] || "";
        continue;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
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
      if (/^```/.test(line.trim())) {
        inCodeFence = !inCodeFence;
        return line;
      }

      if (inCodeFence) {
        return line;
      }

      return line.replace(/<\/?[a-z][^>]*>/gi, "");
    }).join("\n");
  }

  function renderInlineMarkdown(value) {
    const codeTokens = [];
    let output = escapeHtml(value || "");

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

      return `<img src="${escapeAttribute(safeUrl)}" alt="${escapeAttribute(alt)}" loading="lazy" />`;
    });

    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safeUrl = sanitizeMarkdownUrl(url);
      if (!safeUrl) {
        return label;
      }

      return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    });

    output = output.replace(/\b(https?:\/\/[^\s<]+[^<.,;:"')\]\s])/g, match => {
      const safeUrl = sanitizeMarkdownUrl(match);
      if (!safeUrl) {
        return match;
      }

      return `<a href="${escapeAttribute(safeUrl)}" target="_blank" rel="noreferrer noopener">${match}</a>`;
    });

    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    output = output.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/_([^_]+)_/g, "<em>$1</em>");

    codeTokens.forEach((token, index) => {
      output = output.replace(`%%CODE${index}%%`, token);
    });

    return output;
  }

  function sanitizeMarkdownUrl(url) {
    try {
      const parsed = new URL(String(url || "").trim(), window.location.origin);
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
    elements.settingsApiToken.value = settings.apiToken || "";
    elements.settingsMcpPath.value = settings.mcpConfigPath || "";
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
    renderSettingsSecurityState();
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

  const payload = {
    baseUrl: elements.settingsBaseUrl.value.trim(),
    apiToken: elements.settingsApiToken.value.trim(),
    mcpConfigPath: elements.settingsMcpPath.value.trim(),
    requireLogin: elements.settingsRequireLogin?.checked || false,
    pin: elements.settingsPin?.value.trim() || "",
  };

  try {
    await fetchJson("/api/settings", {
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
    renderSettingsSecurityState();

    await refreshBootstrap();
    render();

    setTimeout(() => closeSettings(), 1200);
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

function updateStickToBottom() {
  const remaining = elements.messageScroll.scrollHeight - elements.messageScroll.scrollTop - elements.messageScroll.clientHeight;
  state.stickToBottom = remaining <= 72;
}

function syncMessageScroll(force = false) {
  if (!force && !state.stickToBottom) {
    return;
  }

  requestAnimationFrame(() => {
    elements.messageScroll.scrollTop = elements.messageScroll.scrollHeight;
    state.stickToBottom = true;
  });
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

function promptDeleteChat(chatId) {
  if (!chatId || state.isSending) {
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
  setButtonIcon(elements.exportChatButton, "download");
  setButtonIcon(elements.deleteChatButton, "trash");
  setButtonIcon(elements.settingsButton, "gear");
  setButtonIcon(elements.logoutButton, "lock");
  setButtonIcon(elements.attachImageButton, "image");
  setButtonIcon(elements.attachFileButton, "file");
  setButtonIcon(elements.configBannerDismiss, "close");
  renderThemeButton();
}

function renderThemeButton() {
  setButtonIcon(elements.themeButton, state.theme === "dark" ? "sun" : "moon");
  const label = state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  elements.themeButton.title = label;
  elements.themeButton.setAttribute("aria-label", label);
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
    case "sliders":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path><circle cx="9" cy="6" r="2"></circle><circle cx="15" cy="12" r="2"></circle><circle cx="11" cy="18" r="2"></circle></svg>';
    case "download":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"></path><path d="m8 10 4 4 4-4"></path><path d="M5 19h14"></path></svg>';
    case "trash":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 12h10l1-12"></path><path d="M9 7V4h6v3"></path></svg>';
    case "gear":
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"></circle><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z"></path></svg>';
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
