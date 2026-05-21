function buildChatExport(chat) {
  const lines = [
    `# ${chat.title}`,
    "",
    `- Chat ID: ${chat.id}`,
    `- Model: ${chat.modelKey}`,
    `- Created: ${chat.createdAt}`,
    `- Updated: ${chat.updatedAt}`
  ];

  if (chat.systemPrompt) {
    lines.push(`- System Prompt: ${chat.systemPrompt}`);
  }
  if (chat.reasoning) {
    lines.push(`- Reasoning: ${chat.reasoning}`);
  }
  if (chat.contextLength) {
    lines.push(`- Context Length: ${chat.contextLength}`);
  }
  if (typeof chat.temperature === "number") {
    lines.push(`- Temperature: ${chat.temperature}`);
  }
  if (chat.selectedMcpServerIds?.length) {
    lines.push(`- MCP Servers: ${chat.selectedMcpServerIds.join(", ")}`);
  }

  for (const message of chat.messages || []) {
    lines.push("", `## ${message.role === "user" ? "You" : message.modelKey || chat.modelKey || "Assistant"}`, `_${message.createdAt}_`, "");
    appendMessageBody(lines, message);
  }

  return lines.join("\n").trimEnd() + "\n";
}

function buildMessageExport(chat, message) {
  const lines = [
    `# ${chat.title}`,
    "",
    `## ${message.role === "user" ? "You" : message.modelKey || chat.modelKey || "Assistant"}`,
    `_${message.createdAt}_`,
    ""
  ];

  appendMessageBody(lines, message);
  return lines.join("\n").trimEnd() + "\n";
}

function buildDownloadName(value, fallback) {
  const base = String(value || fallback || "export")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${base || fallback || "export"}.md`;
}

function appendMessageBody(lines, message) {
  if (message.content) {
    lines.push(message.content, "");
  }

  if (message.attachments?.length) {
    lines.push("### Attachments", "");
    for (const attachment of message.attachments) {
      lines.push(`- ${attachment.name} (${formatAttachmentSummary(attachment)})`);
      if (attachment.textContent) {
        lines.push("", "```text", attachment.textContent.trimEnd(), "```", "");
      }
    }
    lines.push("");
  }

  if (message.reasoning) {
    lines.push("### Thinking", "", message.reasoning, "");
  }

  if (message.toolCalls?.length) {
    lines.push("### Tool Calls", "");
    for (const toolCall of message.toolCalls) {
      lines.push(`#### ${toolCall.tool}`, "", "```json", toolCall.argumentsJson || "{}", "```", "");
      if (toolCall.output) {
        lines.push("```text", toolCall.output, "```", "");
      }
    }
  }

  if (message.invalidToolCalls?.length) {
    lines.push("### Tool Errors", "");
    for (const invalidToolCall of message.invalidToolCalls) {
      lines.push(`#### ${invalidToolCall.reason}`, "", "```json", invalidToolCall.metadataJson || "{}", "```", "");
    }
  }

  if (message.stats) {
    lines.push(
      "### Stats",
      "",
      `- Input Tokens: ${message.stats.inputTokens || 0}`,
      `- Output Tokens: ${message.stats.totalOutputTokens || 0}`,
      `- Reasoning Tokens: ${message.stats.reasoningOutputTokens || 0}`,
      `- Tokens Per Second: ${message.stats.tokensPerSecond || 0}`,
      `- Time To First Token: ${message.stats.timeToFirstTokenSeconds || 0}`
    );

    if (message.stats.modelLoadTimeSeconds !== null && message.stats.modelLoadTimeSeconds !== undefined) {
      lines.push(`- Model Load Time: ${message.stats.modelLoadTimeSeconds}`);
    }

    if (message.stats.contextLimit) {
      lines.push(`- Context Limit: ${message.stats.contextLimit}`);
    }

    lines.push("");
  }
}

function formatAttachmentSummary(attachment) {
  const parts = [];
  if (attachment.kind) {
    parts.push(attachment.kind);
  }
  if (attachment.contentType) {
    parts.push(attachment.contentType);
  }
  if (attachment.sizeBytes) {
    parts.push(`${attachment.sizeBytes} bytes`);
  }
  if (attachment.truncated) {
    parts.push("truncated");
  }

  return parts.join(", ") || "attachment";
}

module.exports = {
  buildChatExport,
  buildDownloadName,
  buildMessageExport
};