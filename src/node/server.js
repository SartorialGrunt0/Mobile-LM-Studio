const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");

const { appendAuthCookie, buildUpdatedSecurity, clearAuthCookie, hasPin, isAuthenticated, isLoginRateLimited, recordLoginAttempt, verifyPin } = require("./auth");
const { ChatRepository } = require("./chat-repository");
const { buildChatExport, buildDownloadName, buildMessageExport } = require("./chat-export");
const { readConfig } = require("./config");
const { createLogger } = require("./logger");
const { LmStudioClient } = require("./lm-studio-client");
const { getServers } = require("./mcp-catalog");
const { buildAssistantPersistence, relayLmStudioStream, writeSse } = require("./lm-studio-stream");
const { saveSettings } = require("./settings-store");

function buildListenAddress(config) {
  const configuredUrl = config.Web?.Urls?.[0] || "http://0.0.0.0:5080";
  const url = new URL(configuredUrl);
  return {
    defaultUrl: configuredUrl,
    hostname: url.hostname,
    port: Number.parseInt(url.port || "80", 10)
  };
}

function createApp() {
  const { config, runtimeSettingsPath, logDirectory } = readConfig();
  const logger = createLogger(logDirectory);
  const staticRoot = path.join(__dirname, "..", "MobileLmStudio", "wwwroot");
  const katexRoot = path.join(__dirname, "..", "..", "node_modules", "katex", "dist");
  const repository = new ChatRepository(config.Storage.ConnectionString);
  const lmStudioClient = new LmStudioClient(() => ({
    baseUrl: state.config.LmStudio?.BaseUrl,
    apiToken: state.config.LmStudio?.ApiToken
  }));
  const app = express();
  const state = {
    config,
    runtimeSettingsPath,
    logger,
    defaultUrl: buildListenAddress(config).defaultUrl,
    repository,
    activeStreamChatIds: new Set(),
    activeStreamAbortControllers: new Map()
  };

  app.disable("x-powered-by");
  app.use(express.json({ limit: "25mb" }));
  app.use(cookieParser());
  app.use((request, _response, next) => {
    request.appState = state;
    next();
  });
  app.use("/vendor/katex", express.static(katexRoot));
  app.use(express.static(staticRoot, { extensions: ["html"] }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/bootstrap", (request, response) => {
    const currentConfig = request.appState.config;
    const requireLogin = hasPin(currentConfig.Security);
    response.json({
      requireLogin,
      authenticated: !requireLogin || isAuthenticated(request, currentConfig.Security),
      lmStudioConfigured: Boolean(currentConfig.LmStudio?.BaseUrl),
      mcpConfigured: Boolean(currentConfig.LmStudio?.McpConfigPath),
      hasApiToken: Boolean(currentConfig.LmStudio?.ApiToken),
      defaultUrl: request.appState.defaultUrl,
      chatFontScale: currentConfig.Ui?.ChatFontScale || 1
    });
  });

  app.post("/api/auth/login", (request, response) => {
    const currentConfig = request.appState.config;
    if (!hasPin(currentConfig.Security)) {
      response.json({ requireLogin: false, authenticated: true });
      return;
    }

    const ip = String(request.ip || "unknown");
    if (isLoginRateLimited(ip)) {
      response.status(429).json({ detail: "Too many failed attempts. Try again later." });
      return;
    }

    if (!verifyPin(request.body?.pin, currentConfig.Security)) {
      recordLoginAttempt(ip, false);
      response.sendStatus(401);
      return;
    }

    recordLoginAttempt(ip, true);
    appendAuthCookie(response, currentConfig.Security);
    response.json({ requireLogin: true, authenticated: true });
  });

  app.post("/api/auth/logout", (request, response) => {
    const currentConfig = request.appState.config;
    clearAuthCookie(response);
    response.json({
      requireLogin: hasPin(currentConfig.Security),
      authenticated: !hasPin(currentConfig.Security)
    });
  });

  app.use("/api", (request, response, next) => {
    if (["/bootstrap", "/auth/login", "/auth/logout", "/health"].includes(request.path)) {
      next();
      return;
    }

    const currentConfig = request.appState.config;
    if (!hasPin(currentConfig.Security) || isAuthenticated(request, currentConfig.Security)) {
      next();
      return;
    }

    response.sendStatus(401);
  });

  app.get("/api/settings", (request, response) => {
    const currentConfig = request.appState.config;
    response.json(buildSettingsResponse(currentConfig));
  });

  app.post("/api/settings", (request, response) => {
    const payload = normalizeSettingsPayload(request.body);
    const wasAuthenticated = isAuthenticated(request, request.appState.config.Security);
    const validationErrors = validateSettings(payload);
    if (validationErrors) {
      response.status(400).json({
        title: "One or more validation errors occurred.",
        errors: validationErrors
      });
      return;
    }

    let security;
    try {
      security = buildUpdatedSecurity(payload.requireLogin, payload.pin, request.appState.config.Security);
    } catch (error) {
      response.status(400).json({
        title: "One or more validation errors occurred.",
        errors: {
          pin: [error.message]
        }
      });
      return;
    }

    try {
      const resolvedApiToken = payload.keepApiToken
        ? (request.appState.config.LmStudio?.ApiToken || "")
        : payload.apiToken;
      const resolvedPayload = { ...payload, apiToken: resolvedApiToken };
      saveSettings(request.appState.runtimeSettingsPath, resolvedPayload, security);
      request.appState.config = {
        ...request.appState.config,
        LmStudio: {
          ...request.appState.config.LmStudio,
          BaseUrl: payload.baseUrl,
          ApiToken: resolvedApiToken,
          McpConfigPath: payload.mcpConfigUpload?.content
            ? path.join(path.dirname(request.appState.runtimeSettingsPath), "mcp.uploaded.json")
            : payload.mcpConfigPath
        },
        Security: security,
        Ui: {
          ...request.appState.config.Ui,
          ChatFontScale: payload.chatFontScale
        }
      };
      if (hasPin(security) && wasAuthenticated) {
        appendAuthCookie(response, security);
      } else {
        clearAuthCookie(response);
      }
      response.json(buildSettingsResponse(request.appState.config));
    } catch (error) {
      request.appState.logger.error(`Failed to save runtime settings to ${request.appState.runtimeSettingsPath}.`, error);
      response.status(500).json({
        detail: "Unable to save settings. Check the service log for details."
      });
    }
  });

  app.get("/api/mcp/servers", async (request, response) => {
    try {
      const servers = await getServers(request.appState.config.LmStudio?.McpConfigPath);
      response.json(servers);
    } catch (error) {
      request.appState.logger.error(`Failed to load MCP servers from ${request.appState.config.LmStudio?.McpConfigPath || "(empty)"}.`, error);
      response.status(500).json({
        detail: error.message
      });
    }
  });

  app.get("/api/models", async (request, response) => {
    try {
      response.json(await lmStudioClient.getModels());
    } catch (error) {
      request.appState.logger.error(`Failed to load the LM Studio model catalog from ${request.appState.config.LmStudio?.BaseUrl || "(empty)"}.`, error);
      response.status(502).json({ detail: error.message });
    }
  });

  app.post("/api/models/load", async (request, response) => {
    try {
      response.json(await lmStudioClient.loadModel(normalizeModelLoadRequest(request.body)));
    } catch (error) {
      request.appState.logger.error(`Failed to load model ${request.body?.model || "(empty)"}.`, error);
      response.status(502).json({ detail: error.message });
    }
  });

  app.post("/api/models/unload", async (request, response) => {
    try {
      response.json(await lmStudioClient.unloadModel({ instanceId: String(request.body?.instanceId || "") }));
    } catch (error) {
      request.appState.logger.error(`Failed to unload model instance ${request.body?.instanceId || "(empty)"}.`, error);
      response.status(502).json({ detail: error.message });
    }
  });

  app.get("/api/chats", (request, response) => {
    response.json(request.appState.repository.listChats());
  });

  app.get("/api/chats/active-streams", (request, response) => {
    response.json({ chatIds: [...request.appState.activeStreamChatIds] });
  });

  app.post("/api/chats/:chatId/stop", (request, response) => {
    const controller = request.appState.activeStreamAbortControllers.get(request.params.chatId);
    if (controller) {
      controller.abort();
    }
    response.sendStatus(204);
  });

  app.get("/api/chats/:chatId", (request, response) => {
    const chat = request.appState.repository.getChat(request.params.chatId);
    if (!chat) {
      response.sendStatus(404);
      return;
    }

    response.json(chat);
  });

  app.get("/api/chats/:chatId/export", (request, response) => {
    const chat = request.appState.repository.getChat(request.params.chatId);
    if (!chat) {
      response.sendStatus(404);
      return;
    }

    const fileName = buildDownloadName(chat.title, chat.id);
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.send(buildChatExport(chat));
  });

  app.get("/api/chats/:chatId/messages/:messageId/export", (request, response) => {
    const chat = request.appState.repository.getChat(request.params.chatId);
    if (!chat) {
      response.sendStatus(404);
      return;
    }

    const message = request.appState.repository.getMessage(request.params.chatId, request.params.messageId);
    if (!message) {
      response.sendStatus(404);
      return;
    }

    const fileName = buildDownloadName(`${chat.title}-${message.role}`, message.id);
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    response.send(buildMessageExport(chat, message));
  });

  app.delete("/api/chats/:chatId", (request, response) => {
    const deleted = request.appState.repository.deleteChat(request.params.chatId);
    if (!deleted) {
      response.sendStatus(404);
      return;
    }

    response.sendStatus(204);
  });

  app.post("/api/chats/:chatId/auto-title", async (request, response) => {
    try {
      const chat = request.appState.repository.getChatRecord(request.params.chatId);
      if (!chat) {
        response.sendStatus(404);
        return;
      }

      const title = await lmStudioClient.generateTitle(chat.modelKey, String(request.body?.input || ""));
      if (title) {
        request.appState.repository.updateTitle(request.params.chatId, title);
      }

      response.json({ title: title || null });
    } catch (error) {
      request.appState.logger.warn(`Unable to auto-title chat ${request.params.chatId}.`, error);
      response.json({ title: null });
    }
  });

  app.post("/api/chats/:chatId/retry/stream", async (request, response) => {
    const retryContext = request.appState.repository.getRetryContext(request.params.chatId);
    if (!retryContext) {
      response.sendStatus(404);
      return;
    }

    const retryRequest = {
      chatId: retryContext.chatId,
      model: retryContext.model,
      input: retryContext.input,
      systemPrompt: retryContext.systemPrompt,
      reasoning: retryContext.reasoning,
      contextLength: retryContext.contextLength,
      temperature: retryContext.temperature,
      mcpServerIds: retryContext.mcpServerIds,
      attachments: retryContext.attachments
    };

    request.appState.repository.deleteLastAssistantMessage(retryContext.chatId);
    await streamChat(request, response, lmStudioClient, retryRequest, {
      previousResponseId: retryContext.previousResponseId,
      persistChatId: retryContext.chatId
    });
  });

  app.post("/api/chats/stream", async (request, response) => {
    const chatRequest = normalizeChatStreamRequest(request.body);
    if (!chatRequest.model || (!chatRequest.input.trim() && chatRequest.attachments.length === 0)) {
      response.status(400).json({ error: "Model and either text or an attachment are required." });
      return;
    }

    let chat;
    if (!chatRequest.chatId) {
      chat = request.appState.repository.createChat(chatRequest);
    } else {
      chat = request.appState.repository.getChatRecord(chatRequest.chatId);
      if (!chat) {
        response.sendStatus(404);
        return;
      }
    }

    request.appState.repository.saveUserMessage(chat.id, chatRequest);
    await streamChat(request, response, lmStudioClient, chatRequest, {
      previousResponseId: chat.lastResponseId,
      persistChatId: chat.id,
      exposeChatId: true
    });
  });

  app.post("/api/chats/:chatId/messages/:messageId/edit-stream", async (request, response) => {
    const chatId = request.params.chatId;
    const messageId = request.params.messageId;
    const chat = request.appState.repository.getChatRecord(chatId);
    if (!chat) {
      response.sendStatus(404);
      return;
    }

    const chatRequest = normalizeChatStreamRequest({ ...request.body, chatId });
    if (!chatRequest.model || (!chatRequest.input.trim() && chatRequest.attachments.length === 0)) {
      response.status(400).json({ error: "Model and either text or an attachment are required." });
      return;
    }

    const previousResponseId = request.appState.repository.truncateFromMessage(chatId, messageId);
    if (previousResponseId === null && !request.appState.repository.getChatRecord(chatId)) {
      response.sendStatus(404);
      return;
    }

    request.appState.repository.saveUserMessage(chatId, chatRequest);
    await streamChat(request, response, lmStudioClient, chatRequest, {
      previousResponseId: previousResponseId || null,
      persistChatId: chatId,
    });
  });

  app.get("*", (_request, response) => {
    response.sendFile(path.join(staticRoot, "index.html"));
  });

  return { app, config, logger };
}

function buildSettingsResponse(config) {
  return {
    baseUrl: config.LmStudio?.BaseUrl || "",
    hasApiToken: Boolean(config.LmStudio?.ApiToken),
    mcpConfigPath: config.LmStudio?.McpConfigPath || "",
    chatFontScale: config.Ui?.ChatFontScale || 1,
    requireLogin: hasPin(config.Security)
  };
}

function normalizeSettingsPayload(payload) {
  return {
    baseUrl: String(payload?.baseUrl || "").trim(),
    apiToken: String(payload?.apiToken || "").trim(),
    keepApiToken: Boolean(payload?.keepApiToken),
    mcpConfigPath: String(payload?.mcpConfigPath || "").trim(),
    mcpConfigUpload: payload?.mcpConfigUpload && typeof payload.mcpConfigUpload === "object"
      ? {
          fileName: String(payload.mcpConfigUpload.fileName || "").trim(),
          content: String(payload.mcpConfigUpload.content || "")
        }
      : null,
    chatFontScale: toOptionalFloat(payload?.chatFontScale) || 1,
    requireLogin: Boolean(payload?.requireLogin),
    pin: String(payload?.pin || "").trim()
  };
}

function validateSettings(settings) {
  if (!Number.isFinite(settings.chatFontScale) || settings.chatFontScale < 0.9 || settings.chatFontScale > 1.2) {
    return {
      chatFontScale: ["Chat text size must be between 0.9 and 1.2."]
    };
  }

  if (settings.mcpConfigUpload?.content) {
    try {
      const parsed = JSON.parse(settings.mcpConfigUpload.content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          mcpConfigUpload: ["Uploaded MCP config must contain a JSON object."]
        };
      }
    } catch {
      return {
        mcpConfigUpload: ["Uploaded MCP config must contain valid JSON."]
      };
    }
  }

  if (!settings.baseUrl) {
    return null;
  }

  try {
    const parsed = new URL(settings.baseUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return null;
    }
  } catch {
  }

  return {
    baseUrl: ["Base URL must be an absolute http:// or https:// URL."]
  };
}

function normalizeModelLoadRequest(payload) {
  return {
    model: String(payload?.model || "").trim(),
    contextLength: toOptionalInteger(payload?.contextLength),
    flashAttention: typeof payload?.flashAttention === "boolean" ? payload.flashAttention : null
  };
}

function normalizeChatStreamRequest(payload) {
  return {
    chatId: payload?.chatId ? String(payload.chatId).trim() : null,
    model: String(payload?.model || "").trim(),
    input: String(payload?.input || ""),
    systemPrompt: optionalTrimmedString(payload?.systemPrompt),
    reasoning: optionalTrimmedString(payload?.reasoning),
    contextLength: toOptionalInteger(payload?.contextLength),
    temperature: toOptionalFloat(payload?.temperature),
    mcpServerIds: Array.isArray(payload?.mcpServerIds) ? payload.mcpServerIds.map(value => String(value || "").trim()).filter(Boolean) : [],
    attachments: Array.isArray(payload?.attachments) ? payload.attachments : []
  };
}

async function streamChat(request, response, lmStudioClient, chatRequest, options = {}) {
  const availableServers = await getServers(request.appState.config.LmStudio?.McpConfigPath);
  const integrations = buildMcpIntegrations(availableServers, chatRequest.mcpServerIds || []);

  const streamAbortController = options.persistChatId ? new AbortController() : null;
  if (options.persistChatId) {
    request.appState.activeStreamChatIds.add(options.persistChatId);
    request.appState.activeStreamAbortControllers.set(options.persistChatId, streamAbortController);
  }
  let clientConnectionOpen = !request.aborted && !response.destroyed;

  const markClientDisconnected = () => {
    clientConnectionOpen = false;
  };

  const canWriteToClient = () => clientConnectionOpen && !response.writableEnded && !response.destroyed;

  const writeStreamEvent = async (eventType, payload) => {
    if (!canWriteToClient()) {
      return false;
    }

    try {
      await writeSse(response, eventType, payload);
      return true;
    } catch {
      markClientDisconnected();
      return false;
    }
  };

  request.on("aborted", markClientDisconnected);
  response.on("close", markClientDisconnected);
  response.on("error", markClientDisconnected);

  if (canWriteToClient() && !response.headersSent) {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    if (options.exposeChatId && options.persistChatId) {
      response.setHeader("X-Chat-Id", options.persistChatId);
    }

    try {
      response.flushHeaders();
    } catch {
      markClientDisconnected();
    }
  }

  try {
    const streamStartedAtMs = Date.now();
    const lmResponse = await lmStudioClient.startChatStream({
      model: chatRequest.model,
      input: buildLmStudioInput(chatRequest),
      system_prompt: chatRequest.systemPrompt,
      reasoning: chatRequest.reasoning,
      stream: true,
      store: true,
      context_length: chatRequest.contextLength,
      temperature: chatRequest.temperature,
      previous_response_id: options.previousResponseId || null,
      integrations: integrations.length > 0 ? integrations : null
    }, streamAbortController?.signal);

    if (!lmResponse.ok) {
      const details = await lmStudioClient.readError(lmResponse);
      if (!await writeStreamEvent("error", JSON.stringify({ message: details }))) {
        request.appState.logger.error(`LM Studio stream failed for chat ${options.persistChatId || "(unknown)"} after the client disconnected: ${details}`);
      }

      if (canWriteToClient()) {
        response.end();
      }
      return;
    }

    const finalResponse = await relayLmStudioStream(lmResponse.body, writeStreamEvent);
    if (finalResponse) {
      const assistant = buildAssistantPersistence(finalResponse, chatRequest.model, chatRequest.contextLength, {
        totalTimeSeconds: Math.max((Date.now() - streamStartedAtMs) / 1000, 0)
      });
      request.appState.repository.saveAssistantMessage(options.persistChatId, chatRequest, assistant);
    }

    if (canWriteToClient()) {
      response.end();
    }
  } catch (error) {
    const isAbort = error?.name === "AbortError" || error?.code === "ABORT_ERR";
    if (!canWriteToClient()) {
      if (!isAbort) {
        request.appState.logger.error(`Background chat stream failed for chat ${options.persistChatId || "(unknown)"}.`, error);
      }
      return;
    }

    if (!response.writableEnded) {
      if (!isAbort) {
        await writeStreamEvent("error", JSON.stringify({ message: error.message || "The LM Studio stream returned an error." }));
      }
      response.end();
    }
  } finally {
    if (options.persistChatId) {
      request.appState.activeStreamChatIds.delete(options.persistChatId);
      request.appState.activeStreamAbortControllers.delete(options.persistChatId);
    }
  }
}

function buildMcpIntegrations(availableServers, selectedServerIds) {
  const requestedIds = [...new Set((selectedServerIds || [])
    .map(serverId => normalizeSelectedMcpServerId(serverId))
    .filter(Boolean)
    .map(serverId => serverId.toLowerCase()))];

  if (requestedIds.length === 0) {
    return [];
  }

  const seen = new Set();
  const integrations = [];

  for (const server of availableServers) {
    const serverId = String(server.id || "").toLowerCase();
    const serverLabel = String(server.label || "").toLowerCase();
    if (!requestedIds.includes(serverId) && !requestedIds.includes(serverLabel)) {
      continue;
    }

    const integrationId = `mcp/${server.id}`;
    if (seen.has(integrationId.toLowerCase())) {
      continue;
    }

    seen.add(integrationId.toLowerCase());
    integrations.push({ type: "plugin", id: integrationId });
  }

  return integrations;
}

function normalizeSelectedMcpServerId(serverId) {
  const normalized = String(serverId || "").trim();
  return normalized.toLowerCase().startsWith("mcp/") ? normalized.slice(4) : normalized;
}

function buildLmStudioInput(chatRequest) {
  const attachments = chatRequest.attachments || [];
  const imageAttachments = attachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = attachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");

  let promptText = chatRequest.input.trim();
  if (!promptText && attachments.length > 0) {
    if (imageAttachments.length > 0 && fileAttachments.length > 0) {
      promptText = "Please analyze the attached content and files.";
    } else if (imageAttachments.length > 0) {
      promptText = "Please analyze the attached image.";
    } else {
      promptText = "Please use the attached file as context.";
    }
  }

  let prompt = promptText;
  if (fileAttachments.length > 0) {
    prompt += "\n\nAttached file context:";
    for (const attachment of fileAttachments) {
      prompt += `\n\n${buildFileAttachmentPromptBlock(attachment)}`;
    }
  }

  if (imageAttachments.length === 0) {
    return prompt;
  }

  return [
    { type: "text", content: prompt },
    ...imageAttachments.map(attachment => ({ type: "image", data_url: attachment.dataUrl }))
  ];
}

function buildFileAttachmentPromptBlock(attachment) {
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

function optionalTrimmedString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalFloat(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function main() {
  const { app, config, logger } = createApp();
  const listenAddress = buildListenAddress(config);

  app.listen(listenAddress.port, listenAddress.hostname, () => {
    logger.info(`Node runtime started on ${listenAddress.defaultUrl}.`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  buildListenAddress,
  buildSettingsResponse,
  buildLmStudioInput,
  buildMcpIntegrations,
  createApp,
  main
};