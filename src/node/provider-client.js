const { TextDecoder } = require("node:util");

const { LmStudioClient } = require("./lm-studio-client");
const { relayLmStudioStream } = require("./lm-studio-stream");
const { getActiveProviderId, getProviderConnectionSettings, getProviderDefinition } = require("./provider-config");

class ProviderClient {
  constructor(getConfig) {
    this.getConfig = getConfig;
    this.lmStudioClient = new LmStudioClient(() => {
      const connection = getProviderConnectionSettings(this.getConfig(), "lmstudio");
      return {
        baseUrl: connection.baseUrl,
        apiToken: connection.apiToken,
      };
    });
  }

  getActiveConnection(providerId = null) {
    const config = this.getConfig();
    const resolvedProviderId = providerId || getActiveProviderId(config);
    return getProviderConnectionSettings(config, resolvedProviderId);
  }

  getActiveProviderInfo(providerId = null) {
    const connection = this.getActiveConnection(providerId);
    return {
      ...connection,
      displayName: connection.definition.displayName,
      supportsModelLoad: connection.definition.supportsModelLoad,
      supportsMcp: connection.definition.supportsMcp,
    };
  }

  async getModels(providerId = null) {
    const connection = this.getActiveConnection(providerId);
    switch (connection.definition.kind) {
      case "lmstudio":
        return this.lmStudioClient.getModels();
      case "anthropic":
        return this.getAnthropicModels(connection);
      default:
        return this.getOpenAiCompatibleModels(connection);
    }
  }

  async loadModel(requestModel, providerId = null) {
    const connection = this.getActiveConnection(providerId);
    if (connection.definition.kind !== "lmstudio") {
      throw unsupportedProviderAction(connection.definition.displayName, "load and unload");
    }

    return this.lmStudioClient.loadModel(requestModel);
  }

  async unloadModel(requestModel, providerId = null) {
    const connection = this.getActiveConnection(providerId);
    if (connection.definition.kind !== "lmstudio") {
      throw unsupportedProviderAction(connection.definition.displayName, "load and unload");
    }

    return this.lmStudioClient.unloadModel(requestModel);
  }

  async streamChat(request, signal, onEvent, providerId = null) {
    const connection = this.getActiveConnection(providerId);
    switch (connection.definition.kind) {
      case "lmstudio":
        return this.streamLmStudioChat(connection, request, signal, onEvent);
      case "anthropic":
        return this.streamAnthropicChat(connection, request, signal, onEvent);
      default:
        return this.streamOpenAiCompatibleChat(connection, request, signal, onEvent);
    }
  }

  async generateTitle(model, input, providerId = null) {
    const connection = this.getActiveConnection(providerId);
    if (!model || !String(model).trim()) {
      return null;
    }

    if (connection.definition.kind === "lmstudio") {
      return this.lmStudioClient.generateTitle(model, input);
    }

    const content = await this.generateText(connection, {
      model,
      systemPrompt: "Generate a short chat title (5 words max). Respond with only the title, no quotes or extra text.",
      userPrompt: String(input || "").slice(0, 500),
      maxTokens: 64,
      temperature: 0.2,
    }, true);

    if (!content) {
      return null;
    }

    const title = String(content).trim().replace(/^['"]|['"]$/g, "");
    return title.length > 60 ? `${title.slice(0, 57)}...` : title;
  }

  async generateAdaptiveMemory(model, options, providerId = null) {
    const connection = this.getActiveConnection(providerId);
    if (!model || !String(model).trim()) {
      return String(options?.existingSummary || "").trim();
    }

    if (connection.definition.kind === "lmstudio") {
      return this.lmStudioClient.generateAdaptiveMemory(model, options);
    }

    const maxWords = Math.max(50, Number.parseInt(options?.maxWords, 10) || 500);
    const content = await this.generateText(connection, {
      model,
      systemPrompt: [
        "Maintain a compact, durable memory profile for a chat user.",
        "Update the profile using the existing memory and the newly observed user messages.",
        "Keep only stable preferences, recurring interests, communication style, output preferences, and durable project context.",
        "Do not store secrets, one-off transient tasks, or speculative personal details.",
        `Return bullet points only and stay within ${maxWords} words.`,
      ].join(" "),
      userPrompt: buildAdaptiveMemoryPrompt(options),
      maxTokens: Math.min(Math.max(maxWords * 5, 256), 2000),
      temperature: 0,
    });

    return truncateWords(String(content || options?.existingSummary || "").trim(), maxWords);
  }

  async streamLmStudioChat(_connection, request, signal, onEvent) {
    const response = await this.lmStudioClient.startChatStream({
      model: request.model,
      input: buildLmStudioInput(request.input, request.attachments),
      system_prompt: request.systemPrompt,
      reasoning: request.reasoning,
      stream: true,
      store: true,
      context_length: request.contextLength,
      temperature: request.temperature,
      top_k: request.topK,
      top_p: request.topP,
      min_p: request.minP,
      repeat_penalty: request.repeatPenalty,
      previous_response_id: request.previousResponseId || null,
      integrations: Array.isArray(request.integrations) && request.integrations.length > 0 ? request.integrations : null,
    }, signal);

    if (!response.ok) {
      throw new Error(await this.lmStudioClient.readError(response));
    }

    return relayLmStudioStream(response.body, onEvent);
  }

  async streamOpenAiCompatibleChat(connection, request, signal, onEvent) {
    const response = await this.sendJson(connection, "POST", "chat/completions", {
      model: request.model,
      messages: buildOpenAiMessages(request.messages, request.systemPrompt),
      stream: true,
      temperature: request.temperature ?? undefined,
      top_p: request.topP ?? undefined,
    }, {
      acceptEventStream: true,
      signal,
      allowFailure: true,
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, connection.definition.displayName));
    }

    await onEvent("chat.start", JSON.stringify({ model: request.model, provider: connection.providerId }));

    let responseId = null;
    let usage = null;
    const reasoning = [];
    const message = [];

    await consumeSseStream(response.body, async frame => {
      const payload = String(frame.payload || "").trim();
      if (!payload || payload === "[DONE]") {
        return;
      }

      const parsed = safeParseJson(payload);
      if (!parsed) {
        return;
      }

      responseId = parsed.id || responseId;
      usage = parsed.usage || usage;

      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      const delta = choice?.delta || {};
      const reasoningDelta = normalizeOpenAiDelta(delta.reasoning_content ?? delta.reasoning ?? delta.reasoningContent ?? null);
      const contentDelta = normalizeOpenAiDelta(delta.content);

      if (reasoningDelta) {
        reasoning.push(reasoningDelta);
        await onEvent("reasoning.delta", JSON.stringify({ content: reasoningDelta }));
      }

      if (contentDelta) {
        message.push(contentDelta);
        await onEvent("message.delta", JSON.stringify({ content: contentDelta }));
      }
    });

    return buildFinalResponse({
      model: request.model,
      contextLength: request.contextLength,
      responseId,
      reasoning: reasoning.join(""),
      content: message.join(""),
      usage,
    });
  }

  async streamAnthropicChat(connection, request, signal, onEvent) {
    const response = await this.sendJson(connection, "POST", "messages", {
      model: request.model,
      system: request.systemPrompt || undefined,
      messages: buildAnthropicMessages(request.messages),
      max_tokens: resolveAnthropicMaxTokens(request.contextLength),
      temperature: request.temperature ?? undefined,
      stream: true,
    }, {
      acceptEventStream: true,
      signal,
      allowFailure: true,
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, connection.definition.displayName));
    }

    await onEvent("chat.start", JSON.stringify({ model: request.model, provider: connection.providerId }));

    let responseId = null;
    let usage = null;
    const reasoning = [];
    const message = [];

    await consumeSseStream(response.body, async frame => {
      const payload = String(frame.payload || "").trim();
      if (!payload) {
        return;
      }

      const parsed = safeParseJson(payload);
      if (!parsed) {
        return;
      }

      const eventType = frame.eventType || parsed.type || "";
      if (eventType === "error" || parsed.type === "error") {
        throw new Error(parsed.error?.message || parsed.message || `${connection.definition.displayName} returned an error.`);
      }

      if (eventType === "message_start") {
        responseId = parsed.message?.id || responseId;
        usage = mergeUsage(usage, parsed.message?.usage);
      }

      if (eventType === "content_block_start") {
        const contentBlock = parsed.content_block || {};
        const thinking = String(contentBlock.thinking || "");
        const text = String(contentBlock.text || "");
        if (thinking) {
          reasoning.push(thinking);
          await onEvent("reasoning.delta", JSON.stringify({ content: thinking }));
        }
        if (text) {
          message.push(text);
          await onEvent("message.delta", JSON.stringify({ content: text }));
        }
      }

      if (eventType === "content_block_delta") {
        const delta = parsed.delta || {};
        const thinking = String(delta.thinking || delta.reasoning || "");
        const text = String(delta.text || "");
        if (thinking) {
          reasoning.push(thinking);
          await onEvent("reasoning.delta", JSON.stringify({ content: thinking }));
        }
        if (text) {
          message.push(text);
          await onEvent("message.delta", JSON.stringify({ content: text }));
        }
      }

      if (eventType === "message_delta") {
        usage = mergeUsage(usage, parsed.usage);
      }
    });

    return buildFinalResponse({
      model: request.model,
      contextLength: request.contextLength,
      responseId,
      reasoning: reasoning.join(""),
      content: message.join(""),
      usage,
    });
  }

  async getOpenAiCompatibleModels(connection) {
    const response = await this.sendJson(connection, "GET", "models", undefined, {
      allowFailure: true,
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return { models: [] };
      }
      throw new Error(await this.readError(response, connection.definition.displayName));
    }

    const payload = await response.json().catch(() => ({ data: [] }));
    const models = Array.isArray(payload.data)
      ? payload.data.map(model => mapCompatibleModel(model, connection.definition))
      : [];

    return { models };
  }

  async getAnthropicModels(connection) {
    const response = await this.sendJson(connection, "GET", "models", undefined, {
      allowFailure: true,
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 405) {
        return { models: [] };
      }
      throw new Error(await this.readError(response, connection.definition.displayName));
    }

    const payload = await response.json().catch(() => ({ data: [] }));
    const models = Array.isArray(payload.data)
      ? payload.data.map(model => mapCompatibleModel({
          id: model.id,
          description: model.display_name || model.id,
        }, connection.definition))
      : [];

    return { models };
  }

  async generateText(connection, options, allowFailure = false) {
    switch (connection.definition.kind) {
      case "anthropic": {
        const response = await this.sendJson(connection, "POST", "messages", {
          model: options.model,
          system: options.systemPrompt || undefined,
          messages: [{ role: "user", content: String(options.userPrompt || "") }],
          max_tokens: Math.max(64, Math.min(options.maxTokens || 512, 4096)),
          temperature: options.temperature ?? undefined,
          stream: false,
        }, { allowFailure });

        if (!response.ok) {
          if (allowFailure) {
            return null;
          }
          throw new Error(await this.readError(response, connection.definition.displayName));
        }

        const payload = await response.json().catch(() => null);
        const content = Array.isArray(payload?.content)
          ? payload.content
            .filter(item => item?.type === "text" && item.text)
            .map(item => item.text)
            .join("")
          : "";
        return String(content || "").trim() || null;
      }
      case "lmstudio":
        return null;
      default: {
        const response = await this.sendJson(connection, "POST", "chat/completions", {
          model: options.model,
          messages: buildOpenAiMessages([
            {
              role: "user",
              content: String(options.userPrompt || ""),
              attachments: [],
            },
          ], options.systemPrompt),
          stream: false,
          temperature: options.temperature ?? undefined,
          max_tokens: options.maxTokens ?? undefined,
        }, { allowFailure });

        if (!response.ok) {
          if (allowFailure) {
            return null;
          }
          throw new Error(await this.readError(response, connection.definition.displayName));
        }

        const payload = await response.json().catch(() => null);
        const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
        return extractOpenAiMessageContent(choice?.message?.content);
      }
    }
  }

  async sendJson(connection, method, routePath, body, options = {}) {
    if (!connection.baseUrl) {
      throw new Error(`Set the ${connection.definition.displayName} base URL in Settings first.`);
    }

    const url = new URL(routePath.replace(/^\/+/, ""), ensureTrailingSlash(connection.baseUrl)).toString();
    const headers = {
      Accept: options.acceptEventStream ? "text/event-stream" : "application/json",
    };

    if (connection.definition.kind === "anthropic") {
      if (connection.apiToken) {
        headers["x-api-key"] = connection.apiToken.trim();
      }
      headers["anthropic-version"] = "2023-06-01";
    } else if (connection.apiToken) {
      headers.Authorization = `Bearer ${connection.apiToken.trim()}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(stripUndefined(body)),
      signal: options.signal,
    });

    if (!options.allowFailure && !response.ok) {
      throw new Error(await this.readError(response, connection.definition.displayName));
    }

    return response;
  }

  async readError(response, providerLabel) {
    const content = await response.text();
    if (!content.trim()) {
      return `${providerLabel} returned ${response.status} ${response.statusText}.`;
    }

    try {
      const payload = JSON.parse(content);
      const value = payload.error?.message
        || payload.error
        || payload.detail
        || payload.message
        || payload.title
        || content;
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return content;
    }
  }
}

function unsupportedProviderAction(providerLabel, action) {
  const error = new Error(`${providerLabel} does not support ${action} controls.`);
  error.statusCode = 400;
  return error;
}

function ensureTrailingSlash(baseUrl) {
  return String(baseUrl || "").endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
}

async function consumeSseStream(sourceStream, onFrame) {
  const reader = sourceStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";
  let dataLines = [];

  while (true) {
    const { value, done } = await reader.read();
    buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");

    if (done) {
      buffer += "\n\n";
    }

    let boundaryIndex = buffer.indexOf("\n");
    while (boundaryIndex >= 0) {
      const line = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 1);

      if (line.length === 0) {
        if (eventType || dataLines.length > 0) {
          await onFrame({
            eventType,
            payload: dataLines.join("\n"),
          });
        }

        eventType = "";
        dataLines = [];
      } else if (line.toLowerCase().startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.toLowerCase().startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }

      boundaryIndex = buffer.indexOf("\n");
    }

    if (done) {
      break;
    }
  }
}

function buildLmStudioInput(input, attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const imageAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");

  let promptText = String(input || "").trim();
  if (!promptText && safeAttachments.length > 0) {
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
    ...imageAttachments.map(attachment => ({ type: "image", data_url: attachment.dataUrl })),
  ];
}

function buildOpenAiMessages(messages, systemPrompt) {
  const payload = [];
  if (systemPrompt) {
    payload.push({ role: "system", content: String(systemPrompt) });
  }

  for (const message of Array.isArray(messages) ? messages : []) {
    if (message.role === "assistant") {
      payload.push({
        role: "assistant",
        content: String(message.content || ""),
      });
      continue;
    }

    if (message.role !== "user") {
      continue;
    }

    payload.push({
      role: "user",
      content: buildOpenAiUserContent(message.content, message.attachments),
    });
  }

  return payload;
}

function buildAnthropicMessages(messages) {
  const payload = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    if (message.role === "assistant") {
      payload.push({
        role: "assistant",
        content: String(message.content || ""),
      });
      continue;
    }

    if (message.role !== "user") {
      continue;
    }

    payload.push({
      role: "user",
      content: buildAnthropicUserContent(message.content, message.attachments),
    });
  }

  return payload;
}

function buildOpenAiUserContent(content, attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const imageAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");
  const promptText = buildPromptText(content, safeAttachments);
  const promptBlocks = [{ type: "text", text: buildPromptWithFiles(promptText, fileAttachments) }];

  for (const attachment of imageAttachments) {
    promptBlocks.push({
      type: "image_url",
      image_url: { url: attachment.dataUrl },
    });
  }

  return promptBlocks.length === 1 && imageAttachments.length === 0
    ? promptBlocks[0].text
    : promptBlocks;
}

function buildAnthropicUserContent(content, attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const imageAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");
  const blocks = [{
    type: "text",
    text: buildPromptWithFiles(buildPromptText(content, safeAttachments), fileAttachments),
  }];

  for (const attachment of imageAttachments) {
    const parsed = parseDataUrl(attachment.dataUrl);
    if (!parsed) {
      continue;
    }

    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType,
        data: parsed.base64,
      },
    });
  }

  return blocks;
}

function buildPromptText(content, attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const imageAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() === "image" && attachment.dataUrl);
  const fileAttachments = safeAttachments.filter(attachment => String(attachment.kind).toLowerCase() !== "image");
  const promptContent = String(content || "").trim();
  if (promptContent) {
    return promptContent;
  }

  if (imageAttachments.length > 0 && fileAttachments.length > 0) {
    return "Please analyze the attached content and files.";
  }
  if (imageAttachments.length > 0) {
    return "Please analyze the attached image.";
  }
  return "Please use the attached file as context.";
}

function buildPromptWithFiles(promptText, attachments) {
  const fileAttachments = Array.isArray(attachments) ? attachments : [];
  if (fileAttachments.length === 0) {
    return String(promptText || "");
  }

  let prompt = String(promptText || "");
  prompt += "\n\nAttached file context:";
  for (const attachment of fileAttachments) {
    prompt += `\n\n${buildFileAttachmentPromptBlock(attachment)}`;
  }
  return prompt;
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

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mediaType: match[1],
    base64: match[2],
  };
}

function normalizeOpenAiDelta(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          return String(item.text || item.content || "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripUndefined(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }
    output[key] = entry;
  }
  return output;
}

function extractOpenAiMessageContent(content) {
  if (typeof content === "string") {
    return content.trim() || null;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const text = content
    .map(item => String(item?.text || item?.content || ""))
    .join("")
    .trim();
  return text || null;
}

function mapCompatibleModel(model, definition) {
  const key = String(model?.id || "").trim();
  return {
    key,
    displayName: key,
    type: "chat",
    publisher: definition.displayName,
    architecture: null,
    quantization: null,
    sizeBytes: null,
    paramsString: null,
    maxContextLength: null,
    format: null,
    loadedInstances: [],
    capabilities: {
      vision: /vision|vl|gemini|gpt-4o|claude-3/i.test(key),
      trainedForToolUse: false,
      reasoning: null,
    },
    variants: [],
    selectedVariant: null,
    description: String(model?.description || "").trim() || null,
  };
}

function mergeUsage(current, next) {
  if (!next || typeof next !== "object") {
    return current;
  }

  return {
    input_tokens: Number.isFinite(Number(next.input_tokens)) ? Number(next.input_tokens) : current?.input_tokens ?? null,
    output_tokens: Number.isFinite(Number(next.output_tokens)) ? Number(next.output_tokens) : current?.output_tokens ?? null,
  };
}

function buildFinalResponse(options) {
  const output = [];
  if (options.reasoning) {
    output.push({ type: "reasoning", content: options.reasoning });
  }
  if (options.content) {
    output.push({ type: "message", content: options.content });
  }

  return {
    output,
    stats: options.usage
      ? {
          input_tokens: options.usage.input_tokens ?? null,
          total_output_tokens: options.usage.output_tokens ?? null,
        }
      : null,
    response_id: options.responseId || null,
    model_info: {
      context_length: options.contextLength ?? null,
    },
  };
}

function buildAdaptiveMemoryPrompt(options) {
  const existingSummary = String(options?.existingSummary || "").trim();
  const messages = Array.isArray(options?.messages) ? options.messages : [];
  const parts = [];

  parts.push("Existing memory profile:");
  parts.push(existingSummary || "- None yet.");
  parts.push("");
  parts.push("New user messages since the last review:");

  for (const message of messages) {
    const title = String(message?.chatTitle || "Untitled chat").trim();
    const createdAt = String(message?.createdAt || "").trim();
    const content = String(message?.content || "").trim();
    if (!content) {
      continue;
    }
    parts.push(`- [${createdAt || "unknown time"}] ${title}: ${content}`);
  }

  parts.push("");
  parts.push("Revise the memory profile so it stays compact, factual, and directly useful for future assistant behavior.");
  return parts.join("\n").trim();
}

function truncateWords(text, maxWords) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return words.slice(0, maxWords).join(" ");
}

function resolveAnthropicMaxTokens(contextLength) {
  const numeric = Number.parseInt(String(contextLength || ""), 10);
  if (!Number.isFinite(numeric)) {
    return 4096;
  }

  return Math.max(256, Math.min(Math.floor(numeric / 4), 4096));
}

module.exports = {
  ProviderClient,
};