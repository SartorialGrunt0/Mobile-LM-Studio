const { TextDecoder } = require("node:util");

async function relayLmStudioStream(sourceStream, onEvent) {
  const reader = sourceStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = null;
  let dataLines = [];
  let finalResponse = null;

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
        if (eventType) {
          const payload = dataLines.join("\n");
          finalResponse = captureFinalResponse(eventType, payload, finalResponse);
          if (onEvent) {
            await onEvent(eventType, payload);
          }
        }

        eventType = null;
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

  return finalResponse;
}

function captureFinalResponse(eventType, payload, current) {
  if (eventType !== "chat.end") {
    return current;
  }

  try {
    const parsed = JSON.parse(payload);
    return parsed?.result || parsed;
  } catch {
    return current;
  }
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

function resolveResponseContextLimit(response, requestedContextLength) {
  return firstFiniteNumber(
    response?.modelInfo?.contextLength,
    response?.model_info?.context_length,
    response?.model?.contextLength,
    response?.model?.context_length,
    requestedContextLength
  );
}

function normalizeResponseStats(response, requestedContextLength, overrides = {}) {
  const stats = response?.stats;
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
    totalTimeSeconds: firstFiniteNumber(overrides.totalTimeSeconds, stats.totalTimeSeconds, stats.total_time_seconds),
    contextLimit: resolveResponseContextLimit(response, requestedContextLength)
  };
}

function buildAssistantPersistence(response, modelKey, contextLength, options = {}) {
  const outputItems = Array.isArray(response?.output) ? response.output : [];
  const messages = [];
  const reasoning = [];
  const toolCalls = [];
  const invalidToolCalls = [];

  for (const item of outputItems) {
    switch (item?.type) {
      case "message":
        if (item.content) {
          messages.push(item.content);
        }
        break;
      case "reasoning":
        if (item.content) {
          reasoning.push(item.content);
        }
        break;
      case "tool_call":
        toolCalls.push({
          tool: item.tool || "tool",
          argumentsJson: item.arguments ? JSON.stringify(item.arguments) : "{}",
          output: item.output || null,
          provider: item.provider_info
            ? {
                type: item.provider_info.type,
                pluginId: item.provider_info.plugin_id ?? null,
                serverLabel: item.provider_info.server_label ?? null
              }
            : null
        });
        break;
      case "invalid_tool_call":
        invalidToolCalls.push({
          reason: item.reason || "Invalid tool call",
          metadataJson: item.metadata ? JSON.stringify(item.metadata) : "{}"
        });
        break;
      default:
        break;
    }
  }

  return {
    content: messages.join("\n\n").trim(),
    reasoning: reasoning.length > 0 ? reasoning.join("\n\n").trim() : null,
    toolCalls,
    invalidToolCalls,
    stats: normalizeResponseStats(response, contextLength, options),
    responseId: response?.response_id ?? null,
    modelKey
  };
}

function writeSse(response, eventType, payload) {
  const lines = payload ? String(payload).replace(/\r/g, "").split("\n") : [""];
  const body = [`event: ${eventType}`, ...lines.map(line => `data: ${line}`), "", ""].join("\n");

  return new Promise((resolve, reject) => {
    response.write(body, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  buildAssistantPersistence,
  relayLmStudioStream,
  writeSse
};