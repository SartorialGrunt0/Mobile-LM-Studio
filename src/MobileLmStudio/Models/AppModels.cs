using System.Text.Json;
using System.Text.Json.Serialization;

namespace MobileLmStudio.Models;

internal sealed record BootstrapResponse(
    bool RequireLogin,
    bool Authenticated,
    bool LmStudioConfigured,
    bool McpConfigured,
    bool HasApiToken,
    string DefaultUrl);

internal sealed record AuthStateResponse(bool RequireLogin, bool Authenticated);

internal sealed record LoginRequest(string Pin);

internal sealed record ModelCatalogResponse(IReadOnlyList<ModelDto> Models);

internal sealed record ModelDto(
    string Key,
    string DisplayName,
    string Type,
    string Publisher,
    string? Architecture,
    QuantizationDto? Quantization,
    long SizeBytes,
    string? ParamsString,
    int MaxContextLength,
    string? Format,
    IReadOnlyList<LoadedModelInstanceDto> LoadedInstances,
    ModelCapabilitiesDto? Capabilities,
    IReadOnlyList<string> Variants,
    string? SelectedVariant,
    string? Description);

internal sealed record QuantizationDto(string? Name, double? BitsPerWeight);

internal sealed record LoadedModelInstanceDto(string Id, ModelLoadConfigurationDto Config);

internal sealed record ModelLoadConfigurationDto(
    int ContextLength,
    int? EvalBatchSize,
    int? Parallel,
    bool? FlashAttention,
    int? NumExperts,
    bool? OffloadKvCacheToGpu);

internal sealed record ModelCapabilitiesDto(
    bool Vision,
    bool TrainedForToolUse,
    ModelReasoningOptionsDto? Reasoning);

internal sealed record ModelReasoningOptionsDto(IReadOnlyList<string> AllowedOptions, string Default);

internal sealed record LoadModelResponseDto(
    string Type,
    string InstanceId,
    double LoadTimeSeconds,
    string Status,
    ModelLoadConfigurationDto? LoadConfig);

internal sealed record UnloadModelResponseDto(string InstanceId);

internal sealed record ModelLoadRequest(string Model, int? ContextLength, bool? FlashAttention);

internal sealed record ModelUnloadRequest(string InstanceId);

internal sealed record McpServerDto(string Id, string Label, string? Description, string? Transport);

internal sealed record ChatSummaryDto(
    string Id,
    string Title,
    string ModelKey,
    string Preview,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    int MessageCount);

internal sealed record ChatDetailDto(
    string Id,
    string Title,
    string ModelKey,
    string? SystemPrompt,
    string? Reasoning,
    int? ContextLength,
    double? Temperature,
    IReadOnlyList<string> SelectedMcpServerIds,
    string? LastResponseId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<ChatMessageDto> Messages);

internal sealed record ChatAttachmentDto(
    string Kind,
    string Name,
    string? ContentType,
    long SizeBytes,
    string? DataUrl,
    string? TextContent,
    bool Truncated);

internal sealed record ChatMessageDto(
    string Id,
    string Role,
    string Content,
    string? Reasoning,
    IReadOnlyList<ToolCallDto> ToolCalls,
    IReadOnlyList<InvalidToolCallDto> InvalidToolCalls,
    IReadOnlyList<ChatAttachmentDto> Attachments,
    string? ModelKey,
    ChatStatsDto? Stats,
    DateTimeOffset CreatedAt);

internal sealed record ToolCallDto(
    string Tool,
    string ArgumentsJson,
    string? Output,
    ToolProviderDto? Provider);

internal sealed record ToolProviderDto(string Type, string? PluginId, string? ServerLabel);

internal sealed record InvalidToolCallDto(string Reason, string MetadataJson);

internal sealed record ChatStatsDto(
    int InputTokens,
    int TotalOutputTokens,
    int ReasoningOutputTokens,
    double TokensPerSecond,
    double TimeToFirstTokenSeconds,
    double? ModelLoadTimeSeconds,
    int? ContextLimit);

internal sealed record ChatStreamRequest(
    string? ChatId,
    string Model,
    string Input,
    string? SystemPrompt,
    string? Reasoning,
    int? ContextLength,
    double? Temperature,
    string[]? McpServerIds,
    ChatAttachmentDto[]? Attachments);

internal sealed record AssistantPersistenceResult(
    string Content,
    string? Reasoning,
    IReadOnlyList<ToolCallDto> ToolCalls,
    IReadOnlyList<InvalidToolCallDto> InvalidToolCalls,
    ChatStatsDto? Stats,
    string? ResponseId,
    string ModelKey);

internal sealed record RetryPromptContext(
    string ChatId,
    string Model,
    string Input,
    string? SystemPrompt,
    string? Reasoning,
    int? ContextLength,
    double? Temperature,
    IReadOnlyList<string> McpServerIds,
    IReadOnlyList<ChatAttachmentDto> Attachments,
    string? PreviousResponseId);

internal sealed record StoredChatRecord(
    string Id,
    string Title,
    string ModelKey,
    string? SystemPrompt,
    string? Reasoning,
    int? ContextLength,
    double? Temperature,
    IReadOnlyList<string> SelectedMcpServerIds,
    string? LastResponseId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal sealed record LmStudioModelCatalogResponse(
    [property: JsonPropertyName("models")] IReadOnlyList<LmStudioModelResponse> Models);

internal sealed record LmStudioModelResponse(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("publisher")] string Publisher,
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("display_name")] string DisplayName,
    [property: JsonPropertyName("architecture")] string? Architecture,
    [property: JsonPropertyName("quantization")] LmStudioQuantizationResponse? Quantization,
    [property: JsonPropertyName("size_bytes")] long SizeBytes,
    [property: JsonPropertyName("params_string")] string? ParamsString,
    [property: JsonPropertyName("loaded_instances")] IReadOnlyList<LmStudioLoadedInstanceResponse>? LoadedInstances,
    [property: JsonPropertyName("max_context_length")] int MaxContextLength,
    [property: JsonPropertyName("format")] string? Format,
    [property: JsonPropertyName("capabilities")] LmStudioCapabilitiesResponse? Capabilities,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("variants")] IReadOnlyList<string>? Variants,
    [property: JsonPropertyName("selected_variant")] string? SelectedVariant);

internal sealed record LmStudioQuantizationResponse(
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("bits_per_weight")] double? BitsPerWeight);

internal sealed record LmStudioLoadedInstanceResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("config")] LmStudioModelLoadConfigurationResponse Config);

internal sealed record LmStudioModelLoadConfigurationResponse(
    [property: JsonPropertyName("context_length")] int ContextLength,
    [property: JsonPropertyName("eval_batch_size")] int? EvalBatchSize,
    [property: JsonPropertyName("parallel")] int? Parallel,
    [property: JsonPropertyName("flash_attention")] bool? FlashAttention,
    [property: JsonPropertyName("num_experts")] int? NumExperts,
    [property: JsonPropertyName("offload_kv_cache_to_gpu")] bool? OffloadKvCacheToGpu);

internal sealed record LmStudioCapabilitiesResponse(
    [property: JsonPropertyName("vision")] bool Vision,
    [property: JsonPropertyName("trained_for_tool_use")] bool TrainedForToolUse,
    [property: JsonPropertyName("reasoning")] LmStudioReasoningResponse? Reasoning);

internal sealed record LmStudioReasoningResponse(
    [property: JsonPropertyName("allowed_options")] IReadOnlyList<string> AllowedOptions,
    [property: JsonPropertyName("default")] string Default);

internal sealed class LmStudioLoadRequest
{
    [JsonPropertyName("model")]
    public string Model { get; init; } = string.Empty;

    [JsonPropertyName("context_length")]
    public int? ContextLength { get; init; }

    [JsonPropertyName("flash_attention")]
    public bool? FlashAttention { get; init; }

    [JsonPropertyName("echo_load_config")]
    public bool EchoLoadConfig { get; init; } = true;
}

internal sealed record LmStudioLoadResponse(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("instance_id")] string InstanceId,
    [property: JsonPropertyName("load_time_seconds")] double LoadTimeSeconds,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("load_config")] LmStudioModelLoadConfigurationResponse? LoadConfig);

internal sealed class LmStudioUnloadRequest
{
    [JsonPropertyName("instance_id")]
    public string InstanceId { get; init; } = string.Empty;
}

internal sealed record LmStudioUnloadResponse([property: JsonPropertyName("instance_id")] string InstanceId);

internal sealed class LmStudioChatRequest
{
    [JsonPropertyName("model")]
    public string Model { get; init; } = string.Empty;

    [JsonPropertyName("input")]
    public object Input { get; init; } = string.Empty;

    [JsonPropertyName("system_prompt")]
    public string? SystemPrompt { get; init; }

    [JsonPropertyName("integrations")]
    public IReadOnlyList<LmStudioPluginIntegration>? Integrations { get; init; }

    [JsonPropertyName("stream")]
    public bool Stream { get; init; } = true;

    [JsonPropertyName("reasoning")]
    public string? Reasoning { get; init; }

    [JsonPropertyName("context_length")]
    public int? ContextLength { get; init; }

    [JsonPropertyName("temperature")]
    public double? Temperature { get; init; }

    [JsonPropertyName("store")]
    public bool Store { get; init; } = true;

    [JsonPropertyName("previous_response_id")]
    public string? PreviousResponseId { get; init; }
}

internal sealed class LmStudioPluginIntegration
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = "plugin";

    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;
}

internal sealed class LmStudioChatResponse
{
    [JsonPropertyName("model_instance_id")]
    public string ModelInstanceId { get; init; } = string.Empty;

    [JsonPropertyName("output")]
    public IReadOnlyList<LmStudioOutputItem> Output { get; init; } = [];

    [JsonPropertyName("stats")]
    public LmStudioChatStats? Stats { get; init; }

    [JsonPropertyName("response_id")]
    public string? ResponseId { get; init; }
}

internal sealed class LmStudioChatEndEvent
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("result")]
    public LmStudioChatResponse? Result { get; init; }
}

internal sealed class LmStudioOutputItem
{
    [JsonPropertyName("type")]
    public string Type { get; init; } = string.Empty;

    [JsonPropertyName("content")]
    public string? Content { get; init; }

    [JsonPropertyName("tool")]
    public string? Tool { get; init; }

    [JsonPropertyName("arguments")]
    public JsonElement Arguments { get; init; }

    [JsonPropertyName("output")]
    public string? Output { get; init; }

    [JsonPropertyName("provider_info")]
    public LmStudioProviderInfo? ProviderInfo { get; init; }

    [JsonPropertyName("reason")]
    public string? Reason { get; init; }

    [JsonPropertyName("metadata")]
    public JsonElement Metadata { get; init; }
}

internal sealed record LmStudioProviderInfo(
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("plugin_id")] string? PluginId,
    [property: JsonPropertyName("server_label")] string? ServerLabel);

internal sealed record LmStudioChatStats(
    [property: JsonPropertyName("input_tokens")] int InputTokens,
    [property: JsonPropertyName("total_output_tokens")] int TotalOutputTokens,
    [property: JsonPropertyName("reasoning_output_tokens")] int ReasoningOutputTokens,
    [property: JsonPropertyName("tokens_per_second")] double TokensPerSecond,
    [property: JsonPropertyName("time_to_first_token_seconds")] double TimeToFirstTokenSeconds,
    [property: JsonPropertyName("model_load_time_seconds")] double? ModelLoadTimeSeconds);

internal sealed record SettingsResponse(
    string BaseUrl,
    string ApiToken,
    string McpConfigPath,
    bool RequireLogin);

internal sealed record SettingsUpdateRequest(
    string BaseUrl,
    string ApiToken,
    string McpConfigPath,
    bool RequireLogin,
    string? Pin);
