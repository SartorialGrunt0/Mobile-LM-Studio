const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

class ChatRepository {
  constructor(connectionString) {
    this.connectionString = String(connectionString || "");
    this.databasePath = extractDatabasePath(this.connectionString);

    const databaseDirectory = path.dirname(this.databasePath);
    if (databaseDirectory) {
      fs.mkdirSync(databaseDirectory, { recursive: true });
    }

    this.db = new Database(this.databasePath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  initialize() {
    this.db.exec(`
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model_key TEXT NOT NULL,
    system_prompt TEXT NULL,
    reasoning TEXT NULL,
    context_length INTEGER NULL,
    temperature REAL NULL,
  top_k INTEGER NULL,
  top_p REAL NULL,
  min_p REAL NULL,
  repeat_penalty REAL NULL,
    selected_mcp_json TEXT NOT NULL,
    chat_overrides_json TEXT NULL,
    last_response_id TEXT NULL,
    created_utc TEXT NOT NULL,
    updated_utc TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    reasoning_markdown TEXT NULL,
    tool_calls_json TEXT NOT NULL,
    invalid_tool_calls_json TEXT NOT NULL,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    stats_json TEXT NULL,
    response_id TEXT NULL,
    model_key TEXT NULL,
    created_utc TEXT NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_utc);
`);

    ensureColumn(this.db, "chats", "temperature", "REAL NULL");
    ensureColumn(this.db, "chats", "top_k", "INTEGER NULL");
    ensureColumn(this.db, "chats", "top_p", "REAL NULL");
    ensureColumn(this.db, "chats", "min_p", "REAL NULL");
    ensureColumn(this.db, "chats", "repeat_penalty", "REAL NULL");
    ensureColumn(this.db, "chats", "chat_overrides_json", "TEXT NULL");
    ensureColumn(this.db, "messages", "attachments_json", "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn(this.db, "messages", "model_key", "TEXT NULL");
  }

  listChats() {
    const rows = this.db.prepare(`
SELECT
    c.id,
    c.title,
    c.model_key,
    c.created_utc,
    c.updated_utc,
    COALESCE((
        SELECT NULLIF(COALESCE(m.content_markdown, ''), '')
        FROM messages m
        WHERE m.chat_id = c.id
        ORDER BY m.created_utc DESC
        LIMIT 1
    ), '') AS preview,
    (SELECT COUNT(*) FROM messages m2 WHERE m2.chat_id = c.id) AS message_count
FROM chats c
ORDER BY c.updated_utc DESC;
`).all();

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      modelKey: row.model_key,
      preview: buildPreview(row.preview),
      createdAt: row.created_utc,
      updatedAt: row.updated_utc,
      messageCount: row.message_count
    }));
  }

  getChat(chatId) {
    const chatRow = this.db.prepare(`
SELECT id, title, model_key, system_prompt, reasoning, context_length, temperature, top_k, top_p, min_p, repeat_penalty, selected_mcp_json, chat_overrides_json, last_response_id, created_utc, updated_utc
FROM chats
WHERE id = ?
LIMIT 1;
`).get(chatId);

    if (!chatRow) {
      return null;
    }

    return {
      id: chatRow.id,
      title: chatRow.title,
      modelKey: chatRow.model_key,
      systemPrompt: chatRow.system_prompt,
      reasoning: chatRow.reasoning,
      contextLength: chatRow.context_length,
      temperature: chatRow.temperature,
      topK: chatRow.top_k,
      topP: chatRow.top_p,
      minP: chatRow.min_p,
      repeatPenalty: chatRow.repeat_penalty,
      selectedMcpServerIds: parseJsonList(chatRow.selected_mcp_json),
      chatOverrides: parseJsonObject(chatRow.chat_overrides_json),
      lastResponseId: chatRow.last_response_id,
      createdAt: chatRow.created_utc,
      updatedAt: chatRow.updated_utc,
      messages: this.getMessages(chatId)
    };
  }

  getChatRecord(chatId) {
    const chatRow = this.db.prepare(`
SELECT id, title, model_key, system_prompt, reasoning, context_length, temperature, top_k, top_p, min_p, repeat_penalty, selected_mcp_json, chat_overrides_json, last_response_id, created_utc, updated_utc
FROM chats
WHERE id = ?
LIMIT 1;
`).get(chatId);

    if (!chatRow) {
      return null;
    }

    return {
      id: chatRow.id,
      title: chatRow.title,
      modelKey: chatRow.model_key,
      systemPrompt: chatRow.system_prompt,
      reasoning: chatRow.reasoning,
      contextLength: chatRow.context_length,
      temperature: chatRow.temperature,
      topK: chatRow.top_k,
      topP: chatRow.top_p,
      minP: chatRow.min_p,
      repeatPenalty: chatRow.repeat_penalty,
      selectedMcpServerIds: parseJsonList(chatRow.selected_mcp_json),
      chatOverrides: parseJsonObject(chatRow.chat_overrides_json),
      lastResponseId: chatRow.last_response_id,
      createdAt: chatRow.created_utc,
      updatedAt: chatRow.updated_utc
    };
  }

  deleteChat(chatId) {
    const result = this.db.prepare("DELETE FROM chats WHERE id = ?;").run(chatId);
    return result.changes > 0;
  }

  getRetryContext(chatId) {
    const chat = this.getChatRecord(chatId);
    if (!chat) {
      return null;
    }

    const rows = this.db.prepare(`
SELECT role, content_markdown, attachments_json, response_id
FROM messages
WHERE chat_id = ?
ORDER BY created_utc ASC;
`).all(chatId);

    let latestUserContent = null;
    let latestUserAttachments = [];
    let previousResponseId = null;
    let latestAssistantResponseId = null;

    for (const row of rows) {
      if (String(row.role).toLowerCase() === "assistant") {
        latestAssistantResponseId = row.response_id || null;
        continue;
      }

      if (String(row.role).toLowerCase() !== "user") {
        continue;
      }

      latestUserContent = row.content_markdown;
      latestUserAttachments = parseJsonList(row.attachments_json);
      previousResponseId = latestAssistantResponseId;
    }

    if ((!latestUserContent || !String(latestUserContent).trim()) && latestUserAttachments.length === 0) {
      return null;
    }

    return {
      chatId: chat.id,
      model: chat.modelKey,
      input: latestUserContent || "",
      systemPrompt: chat.systemPrompt,
      reasoning: chat.reasoning,
      contextLength: chat.contextLength,
      temperature: chat.temperature,
      topK: chat.topK,
      topP: chat.topP,
      minP: chat.minP,
      repeatPenalty: chat.repeatPenalty,
      mcpServerIds: chat.selectedMcpServerIds,
      attachments: latestUserAttachments,
      previousResponseId
    };
  }

  listAdaptiveMemoryMessages(sinceUtc = null, limit = 80) {
    const rows = this.db.prepare(`
SELECT m.chat_id, c.title, m.content_markdown, m.model_key, m.created_utc
FROM messages m
INNER JOIN chats c ON c.id = m.chat_id
WHERE m.role = 'user'
  AND (? IS NULL OR m.created_utc > ?)
  AND TRIM(COALESCE(m.content_markdown, '')) <> ''
ORDER BY m.created_utc ASC, m.rowid ASC
LIMIT ?;
`).all(sinceUtc, sinceUtc, Math.max(1, limit));

    return rows.map(row => ({
      chatId: row.chat_id,
      chatTitle: row.title,
      content: row.content_markdown,
      modelKey: row.model_key,
      createdAt: row.created_utc
    }));
  }

  deleteLastAssistantMessage(chatId) {
    const row = this.db.prepare(`
SELECT id FROM messages
WHERE chat_id = ? AND role = 'assistant'
ORDER BY created_utc DESC, rowid DESC
LIMIT 1;
`).get(chatId);
    if (row) {
      this.db.prepare("DELETE FROM messages WHERE id = ?;").run(row.id);
    }
  }

  updateTitle(chatId, title) {
    this.db.prepare("UPDATE chats SET title = ?, updated_utc = ? WHERE id = ?;").run(title, nowIso(), chatId);
  }

  updateChatOverrides(chatId, chatOverrides, selectedMcpServerIds) {
    const payload = chatOverrides && typeof chatOverrides === "object"
      ? JSON.stringify(chatOverrides)
      : null;
    const selectedMcpJson = JSON.stringify(Array.isArray(selectedMcpServerIds) ? selectedMcpServerIds : []);
    const result = this.db.prepare(`
UPDATE chats
SET selected_mcp_json = ?,
    chat_overrides_json = ?,
    updated_utc = ?
WHERE id = ?;
`).run(selectedMcpJson, payload, nowIso(), chatId);

    return result.changes > 0;
  }

  createChat(request) {
    const chatId = `chat_${randomId()}`;
    const timestamp = nowIso();
    const title = buildTitle(request.input);
    const selectedMcpJson = JSON.stringify(request.mcpServerIds || []);

    this.db.prepare(`
INSERT INTO chats (id, title, model_key, system_prompt, reasoning, context_length, temperature, top_k, top_p, min_p, repeat_penalty, selected_mcp_json, chat_overrides_json, last_response_id, created_utc, updated_utc)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?);
`).run(
      chatId,
      title,
      request.model,
      dbValue(request.systemPrompt),
      dbValue(request.reasoning),
      dbValue(request.contextLength),
      dbValue(request.temperature),
      dbValue(request.topK),
      dbValue(request.topP),
      dbValue(request.minP),
      dbValue(request.repeatPenalty),
      selectedMcpJson,
      timestamp,
      timestamp
    );

    return {
      id: chatId,
      title,
      modelKey: request.model,
      systemPrompt: request.systemPrompt || null,
      reasoning: request.reasoning || null,
      contextLength: request.contextLength ?? null,
      temperature: request.temperature ?? null,
      topK: request.topK ?? null,
      topP: request.topP ?? null,
      minP: request.minP ?? null,
      repeatPenalty: request.repeatPenalty ?? null,
      selectedMcpServerIds: request.mcpServerIds || [],
      lastResponseId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  saveUserMessage(chatId, request) {
    const tx = this.db.transaction(() => {
      const timestamp = nowIso();
      this.db.prepare(`
UPDATE chats
SET model_key = ?,
    system_prompt = ?,
    reasoning = ?,
    context_length = ?,
    temperature = ?,
    top_k = ?,
    top_p = ?,
    min_p = ?,
    repeat_penalty = ?,
    selected_mcp_json = ?,
    updated_utc = ?
WHERE id = ?;
`).run(
        request.model,
        dbValue(request.systemPrompt),
        dbValue(request.reasoning),
        dbValue(request.contextLength),
        dbValue(request.temperature),
        dbValue(request.topK),
        dbValue(request.topP),
        dbValue(request.minP),
        dbValue(request.repeatPenalty),
        JSON.stringify(request.mcpServerIds || []),
        timestamp,
        chatId
      );

      this.db.prepare(`
INSERT INTO messages (id, chat_id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, stats_json, response_id, model_key, created_utc)
VALUES (?, ?, 'user', ?, NULL, '[]', '[]', ?, NULL, NULL, ?, ?);
`).run(
        `msg_${randomId()}`,
        chatId,
        request.input,
        JSON.stringify(request.attachments || []),
        dbValue(request.model),
        timestamp
      );
    });

    tx();
  }

  saveAssistantMessage(chatId, request, assistant) {
    const tx = this.db.transaction(() => {
      const timestamp = nowIso();
      this.db.prepare(`
UPDATE chats
SET model_key = ?,
    system_prompt = ?,
    reasoning = ?,
    context_length = ?,
    temperature = ?,
  top_k = ?,
  top_p = ?,
  min_p = ?,
  repeat_penalty = ?,
    selected_mcp_json = ?,
    last_response_id = ?,
    updated_utc = ?
WHERE id = ?;
`).run(
        request.model,
        dbValue(request.systemPrompt),
        dbValue(request.reasoning),
        dbValue(request.contextLength),
        dbValue(request.temperature),
    dbValue(request.topK),
    dbValue(request.topP),
    dbValue(request.minP),
    dbValue(request.repeatPenalty),
        JSON.stringify(request.mcpServerIds || []),
        dbValue(assistant.responseId),
        timestamp,
        chatId
      );

      this.db.prepare(`
INSERT INTO messages (id, chat_id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, stats_json, response_id, model_key, created_utc)
VALUES (?, ?, 'assistant', ?, ?, ?, ?, '[]', ?, ?, ?, ?);
`).run(
        `msg_${randomId()}`,
        chatId,
        assistant.content,
        dbValue(assistant.reasoning),
        JSON.stringify(assistant.toolCalls || []),
        JSON.stringify(assistant.invalidToolCalls || []),
        assistant.stats ? JSON.stringify(assistant.stats) : null,
        dbValue(assistant.responseId),
        dbValue(assistant.modelKey),
        timestamp
      );
    });

    tx();
  }

  getMessage(chatId, messageId) {
    const row = this.db.prepare(`
SELECT id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, model_key, stats_json, created_utc
FROM messages
WHERE chat_id = ? AND id = ?
LIMIT 1;
`).get(chatId, messageId);

    if (!row) {
      return null;
    }

    return mapMessage(row);
  }

  getMessages(chatId) {
    const rows = this.db.prepare(`
SELECT id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, model_key, stats_json, created_utc
FROM messages
WHERE chat_id = ?
ORDER BY created_utc ASC;
`).all(chatId);

    return rows.map(mapMessage);
  }

  truncateFromMessage(chatId, messageId) {
    return this.db.transaction(() => {
      const allMessages = this.db.prepare(`
SELECT rowid, id, role, response_id FROM messages
WHERE chat_id = ? ORDER BY created_utc ASC, rowid ASC;
`).all(chatId);

      const targetIndex = allMessages.findIndex(m => m.id === messageId);
      if (targetIndex === -1) {
        return null;
      }

      let previousResponseId = null;
      for (let i = targetIndex - 1; i >= 0; i--) {
        if (String(allMessages[i].role).toLowerCase() === "assistant") {
          previousResponseId = allMessages[i].response_id || null;
          break;
        }
      }

      const targetRowid = allMessages[targetIndex].rowid;
      this.db.prepare(`DELETE FROM messages WHERE chat_id = ? AND rowid >= ?;`).run(chatId, targetRowid);

      const latestAssistant = this.db.prepare(`
SELECT response_id FROM messages WHERE chat_id = ? AND role = 'assistant'
ORDER BY created_utc DESC, rowid DESC LIMIT 1;
`).get(chatId);

      this.db.prepare(`UPDATE chats SET last_response_id = ?, updated_utc = ? WHERE id = ?;`)
        .run(latestAssistant?.response_id || null, nowIso(), chatId);

      return previousResponseId;
    })();
  }
}

function ensureColumn(db, tableName, columnName, columnDefinition) {
  const rows = db.prepare(`PRAGMA table_info(${tableName});`).all();
  const hasColumn = rows.some(row => String(row.name).toLowerCase() === columnName.toLowerCase());
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
  }
}

function extractDatabasePath(connectionString) {
  const match = String(connectionString || "").match(/^\s*Data Source\s*=\s*(.+?)\s*$/i);
  if (!match) {
    throw new Error("Storage connection string must use the format 'Data Source=<path>'.");
  }

  return path.resolve(match[1].replace(/^"|"$/g, ""));
}

function mapMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content_markdown,
    reasoning: row.reasoning_markdown,
    toolCalls: parseJsonList(row.tool_calls_json),
    invalidToolCalls: parseJsonList(row.invalid_tool_calls_json),
    attachments: parseJsonList(row.attachments_json),
    modelKey: row.model_key,
    stats: row.stats_json ? parseJsonObject(row.stats_json) : null,
    createdAt: row.created_utc
  };
}

function parseJsonList(json) {
  if (!json) {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(json) {
  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildTitle(input) {
  const condensed = String(input || "").split(/\r?\n/).map(part => part.trim()).filter(Boolean).join(" ");
  if (!condensed) {
    return "New Chat";
  }

  return condensed.length <= 60 ? condensed : `${condensed.slice(0, 57)}...`;
}

function buildPreview(content) {
  const condensed = String(content || "").split(/\r?\n/).map(part => part.trim()).filter(Boolean).join(" ");
  if (!condensed) {
    return "Saved chat";
  }

  return condensed.length <= 90 ? condensed : `${condensed.slice(0, 87)}...`;
}

function dbValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() ? value : null;
  }

  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID().replaceAll("-", "");
}

module.exports = {
  ChatRepository
};