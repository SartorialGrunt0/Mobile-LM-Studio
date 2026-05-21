using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class LmStudioClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;
    private readonly IOptionsMonitor<AppOptions> _options;
    private readonly LmStudioConnectionService _connectionService;

    public LmStudioClient(HttpClient httpClient, IOptionsMonitor<AppOptions> options, LmStudioConnectionService connectionService)
    {
        _httpClient = httpClient;
        _options = options;
        _connectionService = connectionService;
        _httpClient.Timeout = Timeout.InfiniteTimeSpan;
    }

    public async Task<ModelCatalogResponse> GetModelsAsync(CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Get, "/api/v1/models");
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<LmStudioModelCatalogResponse>(JsonOptions, cancellationToken)
            ?? new LmStudioModelCatalogResponse([]);

        var models = payload.Models
            .Select(model => new ModelDto(
                model.Key,
                model.DisplayName,
                model.Type,
                model.Publisher,
                model.Architecture,
                model.Quantization is null ? null : new QuantizationDto(model.Quantization.Name, model.Quantization.BitsPerWeight),
                model.SizeBytes,
                model.ParamsString,
                model.MaxContextLength,
                model.Format,
                model.LoadedInstances?.Select(instance => new LoadedModelInstanceDto(
                    instance.Id,
                    new ModelLoadConfigurationDto(
                        instance.Config.ContextLength,
                        instance.Config.EvalBatchSize,
                        instance.Config.Parallel,
                        instance.Config.FlashAttention,
                        instance.Config.NumExperts,
                        instance.Config.OffloadKvCacheToGpu))).ToArray() ?? [],
                model.Capabilities is null ? null : new ModelCapabilitiesDto(
                    model.Capabilities.Vision,
                    model.Capabilities.TrainedForToolUse,
                    model.Capabilities.Reasoning is null
                        ? null
                        : new ModelReasoningOptionsDto(model.Capabilities.Reasoning.AllowedOptions, model.Capabilities.Reasoning.Default)),
                model.Variants ?? [],
                model.SelectedVariant,
                model.Description))
            .ToArray();

        return new ModelCatalogResponse(models);
    }

    public async Task<LoadModelResponseDto> LoadModelAsync(ModelLoadRequest requestModel, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, "/api/v1/models/load", new LmStudioLoadRequest
        {
            Model = requestModel.Model,
            ContextLength = requestModel.ContextLength,
            FlashAttention = requestModel.FlashAttention,
            EchoLoadConfig = true,
        });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<LmStudioLoadResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("LM Studio returned an empty load response.");

        return new LoadModelResponseDto(
            payload.Type,
            payload.InstanceId,
            payload.LoadTimeSeconds,
            payload.Status,
            payload.LoadConfig is null
                ? null
                : new ModelLoadConfigurationDto(
                    payload.LoadConfig.ContextLength,
                    payload.LoadConfig.EvalBatchSize,
                    payload.LoadConfig.Parallel,
                    payload.LoadConfig.FlashAttention,
                    payload.LoadConfig.NumExperts,
                    payload.LoadConfig.OffloadKvCacheToGpu));
    }

    public async Task<UnloadModelResponseDto> UnloadModelAsync(ModelUnloadRequest requestModel, CancellationToken cancellationToken)
    {
        using var request = CreateRequest(HttpMethod.Post, "/api/v1/models/unload", new LmStudioUnloadRequest
        {
            InstanceId = requestModel.InstanceId,
        });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);

        var payload = await response.Content.ReadFromJsonAsync<LmStudioUnloadResponse>(JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("LM Studio returned an empty unload response.");

        return new UnloadModelResponseDto(payload.InstanceId);
    }

    public Task<HttpResponseMessage> StartChatStreamAsync(LmStudioChatRequest chatRequest, CancellationToken cancellationToken)
    {
        var request = CreateRequest(HttpMethod.Post, "/api/v1/chat", chatRequest, acceptEventStream: true);
        return _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    public async Task<string?> GenerateTitleAsync(string model, string input, CancellationToken cancellationToken)
    {
        var prompt = input.Length > 500 ? input[..500] : input;
        using var request = CreateRequest(HttpMethod.Post, "/api/v1/chat", new LmStudioChatRequest
        {
            Model = model,
            Input = prompt,
            SystemPrompt = "Generate a short chat title (5 words max). Respond with only the title, no quotes or extra text.",
            Stream = false,
            Store = false,
        });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var result = await response.Content.ReadFromJsonAsync<LmStudioChatResponse>(JsonOptions, cancellationToken);
        var title = result?.Output?.FirstOrDefault(o => o.Type == "message")?.Content?.Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }

        title = title.Trim('"', '\'');
        return title.Length > 60 ? $"{title[..57]}..." : title;
    }

    public async Task<string> ReadErrorAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(content)
            ? $"LM Studio returned {(int)response.StatusCode} {response.ReasonPhrase}."
            : content;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path, object? content = null, bool acceptEventStream = false)
    {
        var baseUrl = _connectionService.BaseUrl;
        var apiToken = _connectionService.ApiToken;
        var baseUri = new Uri(EnsureTrailingSlash(baseUrl), UriKind.Absolute);
        var request = new HttpRequestMessage(method, new Uri(baseUri, path));

        request.Headers.Accept.Clear();
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(acceptEventStream ? "text/event-stream" : "application/json"));

        if (!string.IsNullOrWhiteSpace(apiToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiToken.Trim());
        }

        if (content is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(content, JsonOptions), Encoding.UTF8, "application/json");
        }

        return request;
    }

    private static string EnsureTrailingSlash(string baseUrl)
    {
        return baseUrl.EndsWith('/') ? baseUrl : $"{baseUrl}/";
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var details = await ReadErrorAsync(response, cancellationToken);
        throw new HttpRequestException(details, null, response.StatusCode);
    }
}