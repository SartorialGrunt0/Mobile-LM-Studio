using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class ChatRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string _connectionString;

    public ChatRepository(IOptions<AppOptions> options)
    {
        _connectionString = NormalizeConnectionString(options.Value.Storage.ConnectionString);
    }

    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        var dataSource = new SqliteConnectionStringBuilder(_connectionString).DataSource;
        if (!string.IsNullOrWhiteSpace(dataSource))
        {
            var directory = Path.GetDirectoryName(dataSource);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }
        }

        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await ExecuteAsync(connection, "PRAGMA foreign_keys = ON;", cancellationToken);
        await ExecuteAsync(connection, "PRAGMA journal_mode = WAL;", cancellationToken);
        await ExecuteAsync(connection, @"
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model_key TEXT NOT NULL,
    system_prompt TEXT NULL,
    reasoning TEXT NULL,
    context_length INTEGER NULL,
    temperature REAL NULL,
    selected_mcp_json TEXT NOT NULL,
    last_response_id TEXT NULL,
    created_utc TEXT NOT NULL,
    updated_utc TEXT NOT NULL
);", cancellationToken);

        await ExecuteAsync(connection, @"
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
);", cancellationToken);

        await EnsureColumnAsync(connection, "chats", "temperature", "REAL NULL", cancellationToken);
        await EnsureColumnAsync(connection, "messages", "attachments_json", "TEXT NOT NULL DEFAULT '[]'", cancellationToken);
        await EnsureColumnAsync(connection, "messages", "model_key", "TEXT NULL", cancellationToken);
        await ExecuteAsync(connection, "CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_utc);", cancellationToken);
    }

    public async Task<IReadOnlyList<ChatSummaryDto>> ListChatsAsync(CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
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
ORDER BY c.updated_utc DESC;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;

        var chats = new List<ChatSummaryDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            chats.Add(new ChatSummaryDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                BuildPreview(reader.GetString(5)),
                ParseDateTimeOffset(reader.GetString(3)),
                ParseDateTimeOffset(reader.GetString(4)),
                reader.GetInt32(6)));
        }

        return chats;
    }

    public async Task<ChatDetailDto?> GetChatAsync(string chatId, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string chatSql = @"
SELECT id, title, model_key, system_prompt, reasoning, context_length, temperature, selected_mcp_json, last_response_id, created_utc, updated_utc
FROM chats
WHERE id = @chatId
LIMIT 1;";

        await using var chatCommand = connection.CreateCommand();
        chatCommand.CommandText = chatSql;
        chatCommand.Parameters.AddWithValue("@chatId", chatId);

        await using var chatReader = await chatCommand.ExecuteReaderAsync(cancellationToken);
        if (!await chatReader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var detail = new ChatDetailDto(
            chatReader.GetString(0),
            chatReader.GetString(1),
            chatReader.GetString(2),
            chatReader.IsDBNull(3) ? null : chatReader.GetString(3),
            chatReader.IsDBNull(4) ? null : chatReader.GetString(4),
            chatReader.IsDBNull(5) ? null : chatReader.GetInt32(5),
            chatReader.IsDBNull(6) ? null : chatReader.GetDouble(6),
            DeserializeStringList(chatReader.GetString(7)),
            chatReader.IsDBNull(8) ? null : chatReader.GetString(8),
            ParseDateTimeOffset(chatReader.GetString(9)),
            ParseDateTimeOffset(chatReader.GetString(10)),
            await GetMessagesAsync(connection, chatId, cancellationToken));

        return detail;
    }

    public async Task<StoredChatRecord?> GetChatRecordAsync(string chatId, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
SELECT id, title, model_key, system_prompt, reasoning, context_length, temperature, selected_mcp_json, last_response_id, created_utc, updated_utc
FROM chats
WHERE id = @chatId
LIMIT 1;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("@chatId", chatId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new StoredChatRecord(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.IsDBNull(5) ? null : reader.GetInt32(5),
            reader.IsDBNull(6) ? null : reader.GetDouble(6),
            DeserializeStringList(reader.GetString(7)),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            ParseDateTimeOffset(reader.GetString(9)),
            ParseDateTimeOffset(reader.GetString(10)));
    }

    public async Task<bool> DeleteChatAsync(string chatId, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await ExecuteAsync(connection, "PRAGMA foreign_keys = ON;", cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM chats WHERE id = @chatId;";
        command.Parameters.AddWithValue("@chatId", chatId);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<RetryPromptContext?> GetRetryContextAsync(string chatId, CancellationToken cancellationToken)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string chatSql = @"
SELECT id, title, model_key, system_prompt, reasoning, context_length, temperature, selected_mcp_json, last_response_id, created_utc, updated_utc
FROM chats
WHERE id = @chatId
LIMIT 1;";

        await using var chatCommand = connection.CreateCommand();
        chatCommand.CommandText = chatSql;
        chatCommand.Parameters.AddWithValue("@chatId", chatId);

        await using var chatReader = await chatCommand.ExecuteReaderAsync(cancellationToken);
        if (!await chatReader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var chat = new StoredChatRecord(
            chatReader.GetString(0),
            chatReader.GetString(1),
            chatReader.GetString(2),
            chatReader.IsDBNull(3) ? null : chatReader.GetString(3),
            chatReader.IsDBNull(4) ? null : chatReader.GetString(4),
            chatReader.IsDBNull(5) ? null : chatReader.GetInt32(5),
            chatReader.IsDBNull(6) ? null : chatReader.GetDouble(6),
            DeserializeStringList(chatReader.GetString(7)),
            chatReader.IsDBNull(8) ? null : chatReader.GetString(8),
            ParseDateTimeOffset(chatReader.GetString(9)),
            ParseDateTimeOffset(chatReader.GetString(10)));

        const string messageSql = @"
SELECT role, content_markdown, attachments_json, response_id
FROM messages
WHERE chat_id = @chatId
ORDER BY created_utc ASC;";

        await using var messageCommand = connection.CreateCommand();
        messageCommand.CommandText = messageSql;
        messageCommand.Parameters.AddWithValue("@chatId", chatId);

        string? latestUserContent = null;
        IReadOnlyList<ChatAttachmentDto> latestUserAttachments = [];
        string? previousResponseId = null;
        string? latestAssistantResponseId = null;

        await using var messageReader = await messageCommand.ExecuteReaderAsync(cancellationToken);
        while (await messageReader.ReadAsync(cancellationToken))
        {
            var role = messageReader.GetString(0);
            if (string.Equals(role, "assistant", StringComparison.OrdinalIgnoreCase))
            {
                latestAssistantResponseId = messageReader.IsDBNull(3) ? null : messageReader.GetString(3);
                continue;
            }

            if (!string.Equals(role, "user", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            latestUserContent = messageReader.GetString(1);
            latestUserAttachments = DeserializeList<ChatAttachmentDto>(messageReader.GetString(2));
            previousResponseId = latestAssistantResponseId;
        }

        if (string.IsNullOrWhiteSpace(latestUserContent))
        {
            return null;
        }

        return new RetryPromptContext(
            chat.Id,
            chat.ModelKey,
            latestUserContent,
            chat.SystemPrompt,
            chat.Reasoning,
            chat.ContextLength,
            chat.Temperature,
            chat.SelectedMcpServerIds,
            latestUserAttachments,
            previousResponseId);
    }

    public async Task<StoredChatRecord> CreateChatAsync(ChatStreamRequest request, CancellationToken cancellationToken)
    {
        var chatId = $"chat_{Guid.NewGuid():N}";
        var now = DateTimeOffset.UtcNow;
        var title = BuildTitle(request.Input);
        var selectedMcpJson = JsonSerializer.Serialize(request.McpServerIds ?? [], JsonOptions);

        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = @"
INSERT INTO chats (id, title, model_key, system_prompt, reasoning, context_length, temperature, selected_mcp_json, last_response_id, created_utc, updated_utc)
VALUES (@id, @title, @model_key, @system_prompt, @reasoning, @context_length, @temperature, @selected_mcp_json, NULL, @created_utc, @updated_utc);";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("@id", chatId);
        command.Parameters.AddWithValue("@title", title);
        command.Parameters.AddWithValue("@model_key", request.Model);
        command.Parameters.AddWithValue("@system_prompt", DbValue(request.SystemPrompt));
        command.Parameters.AddWithValue("@reasoning", DbValue(request.Reasoning));
        command.Parameters.AddWithValue("@context_length", DbValue(request.ContextLength));
        command.Parameters.AddWithValue("@temperature", DbValue(request.Temperature));
        command.Parameters.AddWithValue("@selected_mcp_json", selectedMcpJson);
        command.Parameters.AddWithValue("@created_utc", now.ToString("O"));
        command.Parameters.AddWithValue("@updated_utc", now.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);

        return new StoredChatRecord(chatId, title, request.Model, request.SystemPrompt, request.Reasoning, request.ContextLength, request.Temperature, request.McpServerIds ?? [], null, now, now);
    }

    public async Task SaveUserMessageAsync(string chatId, ChatStreamRequest request, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

        await using (var updateChat = connection.CreateCommand())
        {
            updateChat.Transaction = transaction;
            updateChat.CommandText = @"
UPDATE chats
SET model_key = @model_key,
    system_prompt = @system_prompt,
    reasoning = @reasoning,
    context_length = @context_length,
    temperature = @temperature,
    selected_mcp_json = @selected_mcp_json,
    updated_utc = @updated_utc
WHERE id = @chat_id;";
            updateChat.Parameters.AddWithValue("@model_key", request.Model);
            updateChat.Parameters.AddWithValue("@system_prompt", DbValue(request.SystemPrompt));
            updateChat.Parameters.AddWithValue("@reasoning", DbValue(request.Reasoning));
            updateChat.Parameters.AddWithValue("@context_length", DbValue(request.ContextLength));
            updateChat.Parameters.AddWithValue("@temperature", DbValue(request.Temperature));
            updateChat.Parameters.AddWithValue("@selected_mcp_json", JsonSerializer.Serialize(request.McpServerIds ?? [], JsonOptions));
            updateChat.Parameters.AddWithValue("@updated_utc", now.ToString("O"));
            updateChat.Parameters.AddWithValue("@chat_id", chatId);
            await updateChat.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var insertMessage = connection.CreateCommand())
        {
            insertMessage.Transaction = transaction;
            insertMessage.CommandText = @"
INSERT INTO messages (id, chat_id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, stats_json, response_id, model_key, created_utc)
VALUES (@id, @chat_id, 'user', @content_markdown, NULL, '[]', '[]', @attachments_json, NULL, NULL, @model_key, @created_utc);";
            insertMessage.Parameters.AddWithValue("@id", $"msg_{Guid.NewGuid():N}");
            insertMessage.Parameters.AddWithValue("@chat_id", chatId);
            insertMessage.Parameters.AddWithValue("@content_markdown", request.Input);
            insertMessage.Parameters.AddWithValue("@attachments_json", JsonSerializer.Serialize(request.Attachments ?? [], JsonOptions));
            insertMessage.Parameters.AddWithValue("@model_key", DbValue(request.Model));
            insertMessage.Parameters.AddWithValue("@created_utc", now.ToString("O"));
            await insertMessage.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    public async Task SaveAssistantMessageAsync(string chatId, ChatStreamRequest request, AssistantPersistenceResult assistant, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;

        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqliteTransaction)await connection.BeginTransactionAsync(cancellationToken);

        await using (var updateChat = connection.CreateCommand())
        {
            updateChat.Transaction = transaction;
            updateChat.CommandText = @"
UPDATE chats
SET model_key = @model_key,
    system_prompt = @system_prompt,
    reasoning = @reasoning,
    context_length = @context_length,
    temperature = @temperature,
    selected_mcp_json = @selected_mcp_json,
    last_response_id = @last_response_id,
    updated_utc = @updated_utc
WHERE id = @chat_id;";
            updateChat.Parameters.AddWithValue("@model_key", request.Model);
            updateChat.Parameters.AddWithValue("@system_prompt", DbValue(request.SystemPrompt));
            updateChat.Parameters.AddWithValue("@reasoning", DbValue(request.Reasoning));
            updateChat.Parameters.AddWithValue("@context_length", DbValue(request.ContextLength));
            updateChat.Parameters.AddWithValue("@temperature", DbValue(request.Temperature));
            updateChat.Parameters.AddWithValue("@selected_mcp_json", JsonSerializer.Serialize(request.McpServerIds ?? [], JsonOptions));
            updateChat.Parameters.AddWithValue("@last_response_id", DbValue(assistant.ResponseId));
            updateChat.Parameters.AddWithValue("@updated_utc", now.ToString("O"));
            updateChat.Parameters.AddWithValue("@chat_id", chatId);
            await updateChat.ExecuteNonQueryAsync(cancellationToken);
        }

        await using (var insertMessage = connection.CreateCommand())
        {
            insertMessage.Transaction = transaction;
            insertMessage.CommandText = @"
INSERT INTO messages (id, chat_id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, stats_json, response_id, model_key, created_utc)
VALUES (@id, @chat_id, 'assistant', @content_markdown, @reasoning_markdown, @tool_calls_json, @invalid_tool_calls_json, '[]', @stats_json, @response_id, @model_key, @created_utc);";
            insertMessage.Parameters.AddWithValue("@id", $"msg_{Guid.NewGuid():N}");
            insertMessage.Parameters.AddWithValue("@chat_id", chatId);
            insertMessage.Parameters.AddWithValue("@content_markdown", assistant.Content);
            insertMessage.Parameters.AddWithValue("@reasoning_markdown", DbValue(assistant.Reasoning));
            insertMessage.Parameters.AddWithValue("@tool_calls_json", JsonSerializer.Serialize(assistant.ToolCalls, JsonOptions));
            insertMessage.Parameters.AddWithValue("@invalid_tool_calls_json", JsonSerializer.Serialize(assistant.InvalidToolCalls, JsonOptions));
            insertMessage.Parameters.AddWithValue("@stats_json", assistant.Stats is null ? DBNull.Value : JsonSerializer.Serialize(assistant.Stats, JsonOptions));
            insertMessage.Parameters.AddWithValue("@response_id", DbValue(assistant.ResponseId));
            insertMessage.Parameters.AddWithValue("@model_key", DbValue(assistant.ModelKey));
            insertMessage.Parameters.AddWithValue("@created_utc", now.ToString("O"));
            await insertMessage.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private async Task<IReadOnlyList<ChatMessageDto>> GetMessagesAsync(SqliteConnection connection, string chatId, CancellationToken cancellationToken)
    {
        const string sql = @"
SELECT id, role, content_markdown, reasoning_markdown, tool_calls_json, invalid_tool_calls_json, attachments_json, model_key, stats_json, created_utc
FROM messages
WHERE chat_id = @chatId
ORDER BY created_utc ASC;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("@chatId", chatId);

        var messages = new List<ChatMessageDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            messages.Add(new ChatMessageDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                DeserializeList<ToolCallDto>(reader.GetString(4)),
                DeserializeList<InvalidToolCallDto>(reader.GetString(5)),
                DeserializeList<ChatAttachmentDto>(reader.GetString(6)),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.IsDBNull(8) ? null : JsonSerializer.Deserialize<ChatStatsDto>(reader.GetString(8), JsonOptions),
                ParseDateTimeOffset(reader.GetString(9))));
        }

        return messages;
    }

    private static async Task EnsureColumnAsync(SqliteConnection connection, string tableName, string columnName, string columnDefinition, CancellationToken cancellationToken)
    {
        if (await HasColumnAsync(connection, tableName, columnName, cancellationToken))
        {
            return;
        }

        await ExecuteAsync(connection, $"ALTER TABLE {tableName} ADD COLUMN {columnName} {columnDefinition};", cancellationToken);
    }

    private static async Task<bool> HasColumnAsync(SqliteConnection connection, string tableName, string columnName, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task ExecuteAsync(SqliteConnection connection, string sql, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string NormalizeConnectionString(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (!string.IsNullOrWhiteSpace(builder.DataSource))
        {
            builder.DataSource = Path.GetFullPath(Environment.ExpandEnvironmentVariables(builder.DataSource));
        }

        return builder.ToString();
    }

    private static DateTimeOffset ParseDateTimeOffset(string value)
    {
        return DateTimeOffset.Parse(value, null, System.Globalization.DateTimeStyles.RoundtripKind);
    }

    private static string BuildTitle(string input)
    {
        var condensed = string.Join(' ', input.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (string.IsNullOrWhiteSpace(condensed))
        {
            return "New Chat";
        }

        return condensed.Length <= 60 ? condensed : $"{condensed[..57]}...";
    }

    private static string BuildPreview(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return "Saved chat";
        }

        var condensed = string.Join(' ', content.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return condensed.Length <= 90 ? condensed : $"{condensed[..87]}...";
    }

    private static object DbValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;
    }

    private static object DbValue(int? value)
    {
        return value.HasValue ? value.Value : DBNull.Value;
    }

    private static object DbValue(double? value)
    {
        return value.HasValue ? value.Value : DBNull.Value;
    }

    private static IReadOnlyList<string> DeserializeStringList(string json)
    {
        return DeserializeList<string>(json);
    }

    private static IReadOnlyList<T> DeserializeList<T>(string json)
    {
        return JsonSerializer.Deserialize<IReadOnlyList<T>>(json, JsonOptions) ?? [];
    }
}