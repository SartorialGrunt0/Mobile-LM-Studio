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
  systemPrompt: "",
  statusText: "Ready",
  statusTone: "neutral",
  isSending: false,
};

const elements = {
  chatDrawer: document.getElementById("chat-drawer"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  drawerToggle: document.getElementById("drawer-toggle"),
  drawerClose: document.getElementById("drawer-close"),
  chatList: document.getElementById("chat-list"),
  newChatButton: document.getElementById("new-chat-button"),
  connectionPill: document.getElementById("connection-pill"),
  settingsButton: document.getElementById("settings-button"),
  logoutButton: document.getElementById("logout-button"),
  configBanner: document.getElementById("config-banner"),
  modelSelect: document.getElementById("model-select"),
  loadModelButton: document.getElementById("load-model-button"),
  unloadModelButton: document.getElementById("unload-model-button"),
  contextLengthInput: document.getElementById("context-length-input"),
  reasoningSelect: document.getElementById("reasoning-select"),
  systemPromptInput: document.getElementById("system-prompt-input"),
  modelMeta: document.getElementById("model-meta"),
  mcpList: document.getElementById("mcp-list"),
  statusBar: document.getElementById("status-bar"),
  messageScroll: document.getElementById("message-scroll"),
  emptyState: document.getElementById("empty-state"),
  messageList: document.getElementById("message-list"),
  composerForm: document.getElementById("composer-form"),
  messageInput: document.getElementById("message-input"),
  sendButton: document.getElementById("send-button"),
  loginScreen: document.getElementById("login-screen"),
  loginForm: document.getElementById("login-form"),
  loginPinInput: document.getElementById("login-pin-input"),
  loginError: document.getElementById("login-error"),
  settingsScreen: document.getElementById("settings-screen"),
  settingsForm: document.getElementById("settings-form"),
  settingsBaseUrl: document.getElementById("settings-base-url"),
  settingsApiToken: document.getElementById("settings-api-token"),
  settingsMcpPath: document.getElementById("settings-mcp-path"),
  settingsSaveButton: document.getElementById("settings-save-button"),
  settingsCancelButton: document.getElementById("settings-cancel-button"),
  settingsStatus: document.getElementById("settings-status"),
};

bindEvents();
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
  elements.newChatButton.addEventListener("click", () => {
    startNewDraft();
    render();
    setDrawerOpen(false);
  });

  elements.chatList.addEventListener("click", event => {
    const button = event.target.closest("button[data-chat-id]");
    if (!button) {
      return;
    }

    void openChat(button.dataset.chatId);
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

  elements.messageInput.addEventListener("input", autoResizeComposer);
  elements.messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  });

  elements.loadModelButton.addEventListener("click", () => void loadSelectedModel());
  elements.unloadModelButton.addEventListener("click", () => void unloadSelectedModel());
  elements.logoutButton.addEventListener("click", () => void logout());

  elements.loginForm.addEventListener("submit", event => {
    event.preventDefault();
    void login();
  });

  elements.settingsCancelButton.addEventListener("click", () => closeSettings());
  elements.settingsForm.addEventListener("submit", event => {
    event.preventDefault();
    void saveSettings();
  });

  elements.settingsButton.addEventListener("click", () => openSettings());
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
  state.currentChat = {
    id: null,
    title: "New Chat",
    modelKey: state.selectedModel,
    systemPrompt: state.systemPrompt,
    reasoning: normalizeReasoningValue(),
    contextLength: parseOptionalNumber(state.selectedContextLength),
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
    state.selectedMcpServerIds = new Set(state.currentChat.selectedMcpServerIds || []);
    normalizeReasoningSelection();
    render();
    setDrawerOpen(false);

    if (!suppressStatus) {
      setStatus(`Opened ${state.currentChat.title}.`, "neutral");
    }
  } catch (error) {
    setStatus(error.message || "Unable to open chat.", "error");
  }
}

async function loadSelectedModel() {
  if (!state.selectedModel) {
    setStatus("Choose a model first.", "error");
    return;
  }

  try {
    setStatus("Loading model...", "busy");
    await fetchJson("/api/models/load", {
      method: "POST",
      body: JSON.stringify({
        model: state.selectedModel,
        contextLength: parseOptionalNumber(state.selectedContextLength),
        flashAttention: true,
      }),
    });

    await refreshModels();
    setStatus("Model loaded.", "neutral");
  } catch (error) {
    setStatus(error.message || "Unable to load the selected model.", "error");
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
  if (!input) {
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
    mcpServerIds: Array.from(state.selectedMcpServerIds),
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
    createdAt: new Date().toISOString(),
    pending: true,
  };

  state.currentChat.messages = state.currentChat.messages || [];
  state.currentChat.messages.push({
    id: `local_${Date.now()}`,
    role: "user",
    content: input,
    reasoning: null,
    toolCalls: [],
    invalidToolCalls: [],
    stats: null,
    createdAt: new Date().toISOString(),
  });
  state.currentChat.messages.push(pendingAssistant);
  state.currentChat.title = summarizeTitle(input);
  state.currentChat.modelKey = state.selectedModel;
  state.currentChat.systemPrompt = state.systemPrompt;
  state.currentChat.reasoning = normalizeReasoningValue();
  state.currentChat.contextLength = parseOptionalNumber(state.selectedContextLength);
  state.currentChat.selectedMcpServerIds = Array.from(state.selectedMcpServerIds);
  state.isSending = true;
  elements.messageInput.value = "";
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
    await refreshChats();

    if (state.currentChatId) {
      await openChat(state.currentChatId, true);
    }

    setStatus("Response complete.", "neutral");
  } catch (error) {
    pendingAssistant.content = error.message || "The request failed.";
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
  message.stats = result.stats
    ? {
        inputTokens: result.stats.inputTokens,
        totalOutputTokens: result.stats.totalOutputTokens,
        reasoningOutputTokens: result.stats.reasoningOutputTokens,
        tokensPerSecond: result.stats.tokensPerSecond,
        timeToFirstTokenSeconds: result.stats.timeToFirstTokenSeconds,
        modelLoadTimeSeconds: result.stats.modelLoadTimeSeconds,
      }
    : null;
  message.pending = false;

  if (message.stats) {
    setStatus(`${formatNumber(message.stats.tokensPerSecond)} tok/s, ${formatInteger(message.stats.inputTokens)} context tokens used.`, "neutral");
  }
}

function render() {
  renderAuthState();
  renderBanner();
  renderControls();
  renderChatList();
  renderMessages();
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
    elements.configBanner.textContent = "";
    elements.configBanner.classList.remove("warning");
    return;
  }

  elements.configBanner.hidden = false;
  elements.configBanner.classList.add("warning");
  elements.configBanner.textContent = warnings.join(" ");
}

function renderControls() {
  renderModelOptions();
  renderReasoningOptions();
  renderModelDetails();
  renderMcpServers();
  elements.systemPromptInput.value = state.systemPrompt;
  elements.contextLengthInput.value = state.selectedContextLength;
  elements.sendButton.disabled = state.isSending || !state.bootstrap?.authenticated && state.bootstrap?.requireLogin;
  elements.messageInput.disabled = state.isSending;
}

function renderModelOptions() {
  const llmModels = state.models.filter(model => model.type === "llm");
  const models = llmModels.length > 0 ? llmModels : state.models;

  if (models.length === 0) {
    elements.modelSelect.innerHTML = '<option value="">No models found</option>';
    return;
  }

  elements.modelSelect.innerHTML = models
    .map(model => `<option value="${escapeAttribute(model.key)}" ${model.key === state.selectedModel ? "selected" : ""}>${escapeHtml(model.displayName)}</option>`)
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
    elements.loadModelButton.disabled = true;
    elements.unloadModelButton.disabled = true;
    return;
  }

  const loadedCount = (model.loadedInstances || []).length;
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
    loadedCount > 0 ? `${loadedCount} instance loaded` : "auto-load on send",
    model.paramsString || model.architecture || "",
    `${formatInteger(model.maxContextLength)} max ctx`,
    capabilityParts.join(" • "),
  ].filter(Boolean);

  elements.modelMeta.textContent = metaParts.join(" • ");
  elements.loadModelButton.disabled = false;
  elements.unloadModelButton.disabled = loadedCount === 0;
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
      <button type="button" class="chat-item${chat.id === state.currentChatId ? " active" : ""}" data-chat-id="${escapeAttribute(chat.id)}">
        <span class="chat-title">${escapeHtml(chat.title)}</span>
        <span class="chat-meta">${escapeHtml(chat.modelKey)} • ${escapeHtml(formatRelativeDate(chat.updatedAt))}</span>
        <span class="chat-preview">${escapeHtml(chat.preview || "Saved chat")}</span>
      </button>`)
    .join("");
}

function renderMessages() {
  const messages = state.currentChat?.messages || [];
  const hasMessages = messages.length > 0;
  elements.emptyState.hidden = hasMessages;
  elements.messageList.innerHTML = hasMessages ? messages.map(renderMessageCard).join("") : "";
  requestAnimationFrame(() => {
    elements.messageScroll.scrollTop = elements.messageScroll.scrollHeight;
  });
}

function renderStatus() {
  elements.statusBar.dataset.tone = state.statusTone;
  elements.statusBar.textContent = state.statusText;
}

function renderMessageCard(message) {
  const roleLabel = message.role === "user" ? "You" : "Model";
  const contentBlock = message.content
    ? `<div class="message-body">${escapeHtml(message.content)}</div>`
    : message.pending
      ? '<div class="message-body">Waiting for tokens...</div>'
      : "";

  const reasoningBlock = message.reasoning
    ? `
      <details class="details-block">
        <summary>Thinking</summary>
        <div class="details-body">${escapeHtml(message.reasoning)}</div>
      </details>`
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

  return `
    <article class="message-card ${message.role === "user" ? "user" : "assistant"}">
      <div class="message-head">
        <span class="message-role">${escapeHtml(roleLabel)}</span>
        <time class="message-time">${escapeHtml(formatClock(message.createdAt))}</time>
      </div>
      ${contentBlock}
      ${reasoningBlock}
      ${toolCallsBlock}
      ${invalidToolCallsBlock}
      ${statsBlock}
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

async function openSettings() {
  try {
    const settings = await fetchJson("/api/settings");
    elements.settingsBaseUrl.value = settings.baseUrl || "";
    elements.settingsApiToken.value = settings.apiToken || "";
    elements.settingsMcpPath.value = settings.mcpConfigPath || "";
    elements.settingsStatus.hidden = true;
    elements.settingsStatus.textContent = "";
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
  };

  try {
    await fetchJson("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    elements.settingsStatus.textContent = "Settings saved.";
    elements.settingsStatus.className = "settings-status success";
    elements.settingsStatus.hidden = false;

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
