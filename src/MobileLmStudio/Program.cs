using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;
using MobileLmStudio.Services;

var builder = WebApplication.CreateBuilder(args);
var runtimeSettingsPath = ApplicationPaths.ResolveRuntimeSettingsPath();
var runtimeSettingsDirectory = Path.GetDirectoryName(runtimeSettingsPath)
    ?? throw new InvalidOperationException("A runtime settings directory is required.");
Directory.CreateDirectory(runtimeSettingsDirectory);

builder.Configuration.AddJsonFile(
    new PhysicalFileProvider(runtimeSettingsDirectory),
    Path.GetFileName(runtimeSettingsPath),
    optional: true,
    reloadOnChange: false);

builder.Host.UseWindowsService();
builder.Logging.AddProvider(new FileLoggerProvider(ApplicationPaths.ResolveLogDirectory()));
builder.Services.Configure<AppOptions>(builder.Configuration);

var configuredOptions = builder.Configuration.Get<AppOptions>() ?? new AppOptions();
var hostOverrideUrls = ResolveHostOverrideUrls(builder.Configuration);
var configuredWebUrls = hostOverrideUrls.Length > 0
    ? hostOverrideUrls
    : ResolveConfiguredWebUrls(builder.Configuration);
if (hostOverrideUrls.Length == 0 && configuredWebUrls.Length > 0)
{
    builder.WebHost.UseUrls(configuredWebUrls);
}

var defaultListenUrl = configuredWebUrls.FirstOrDefault() ?? "http://0.0.0.0:5080";

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "mobile-lm-studio";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton<PinSecurityService>();
builder.Services.AddSingleton<McpCatalogService>();
builder.Services.AddSingleton<ChatRepository>();
builder.Services.AddSingleton(new LmStudioSettingsStore(runtimeSettingsPath));
builder.Services.AddSingleton<LmStudioConnectionService>(sp =>
{
    var options = sp.GetRequiredService<IOptions<AppOptions>>().Value;
    return new LmStudioConnectionService(options.LmStudio);
});
builder.Services.AddHttpClient<LmStudioClient>();

var app = builder.Build();

app.Logger.LogInformation(
    "Mobile LM Studio starting. ContentRoot={ContentRoot}; WebRoot={WebRoot}; DefaultUrl={DefaultUrl}; LmStudioBaseUrl={LmStudioBaseUrl}; McpConfigPath={McpConfigPath}; RuntimeSettingsPath={RuntimeSettingsPath}; LogDirectory={LogDirectory}",
    app.Environment.ContentRootPath,
    app.Environment.WebRootPath ?? "(none)",
    defaultListenUrl,
    configuredOptions.LmStudio.BaseUrl,
    configuredOptions.LmStudio.McpConfigPath,
    runtimeSettingsPath,
    ApplicationPaths.ResolveLogDirectory());

if (string.IsNullOrWhiteSpace(app.Environment.WebRootPath) || !Directory.Exists(app.Environment.WebRootPath))
{
    app.Logger.LogWarning("Web root path {WebRootPath} was not found. Static files may be unavailable.", app.Environment.WebRootPath ?? "(none)");
}

app.Lifetime.ApplicationStarted.Register(() =>
    app.Logger.LogInformation("Mobile LM Studio started. Listening on {Urls}.", string.Join(", ", app.Urls)));
app.Lifetime.ApplicationStopping.Register(() =>
    app.Logger.LogInformation("Mobile LM Studio is stopping."));

try
{
    await app.Services.GetRequiredService<ChatRepository>().InitializeAsync(app.Lifetime.ApplicationStopping);
}
catch (Exception exception)
{
    app.Logger.LogCritical(exception, "Failed to initialize chat storage.");
    throw;
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerPathFeature>()?.Error;
        if (exception is not null)
        {
            app.Logger.LogError(exception, "Unhandled exception for {Method} {Path}.", context.Request.Method, context.Request.Path);
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await Results.Problem("An unexpected server error occurred. Check the service log for details.", statusCode: StatusCodes.Status500InternalServerError)
            .ExecuteAsync(context);
    });
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/bootstrap", (HttpContext context, IOptions<AppOptions> options, PinSecurityService pinSecurity, LmStudioConnectionService connectionService) =>
{
    var current = options.Value;
    var baseUrl = connectionService.BaseUrl;
    var apiToken = connectionService.ApiToken;
    var mcpConfigPath = connectionService.McpConfigPath;
    return Results.Ok(new BootstrapResponse(
        pinSecurity.IsConfigured,
        !pinSecurity.IsConfigured || context.User.Identity?.IsAuthenticated == true,
        !string.IsNullOrWhiteSpace(baseUrl),
        !string.IsNullOrWhiteSpace(mcpConfigPath),
        !string.IsNullOrWhiteSpace(apiToken),
        defaultListenUrl));
});

app.MapPost("/api/auth/login", async Task<IResult> (LoginRequest request, HttpContext context, PinSecurityService pinSecurity) =>
{
    if (!pinSecurity.IsConfigured)
    {
        return Results.Ok(new AuthStateResponse(false, true));
    }

    if (!pinSecurity.Verify(request.Pin))
    {
        return Results.Unauthorized();
    }

    var claims = new[] { new Claim(ClaimTypes.Name, "mobile-user") };
    var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

    return Results.Ok(new AuthStateResponse(true, true));
});

app.MapPost("/api/auth/logout", async (HttpContext context, PinSecurityService pinSecurity) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new AuthStateResponse(pinSecurity.IsConfigured, !pinSecurity.IsConfigured));
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

var api = app.MapGroup("/api");
api.AddEndpointFilter(async (invocationContext, next) =>
{
    var httpContext = invocationContext.HttpContext;
    var pinSecurity = httpContext.RequestServices.GetRequiredService<PinSecurityService>();
    if (!pinSecurity.IsConfigured || httpContext.User.Identity?.IsAuthenticated == true)
    {
        return await next(invocationContext);
    }

    return Results.Unauthorized();
});

api.MapGet("/settings", (LmStudioConnectionService connectionService) =>
{
    return Results.Ok(connectionService.GetSettings());
});

api.MapPost("/settings", (SettingsUpdateRequest request, LmStudioConnectionService connectionService, LmStudioSettingsStore settingsStore, ILogger<Program> logger) =>
{
    var normalizedSettings = NormalizeSettings(request);
    var validationErrors = ValidateSettings(normalizedSettings);
    if (validationErrors is not null)
    {
        return Results.ValidationProblem(validationErrors);
    }

    try
    {
        settingsStore.Save(normalizedSettings);
        connectionService.UpdateSettings(normalizedSettings.BaseUrl, normalizedSettings.ApiToken, normalizedSettings.McpConfigPath);

        logger.LogInformation(
            "LM Studio settings updated. BaseUrl={BaseUrl}; McpConfigPath={McpConfigPath}; ApiTokenConfigured={HasApiToken}; RuntimeSettingsPath={RuntimeSettingsPath}",
            normalizedSettings.BaseUrl,
            normalizedSettings.McpConfigPath,
            !string.IsNullOrWhiteSpace(normalizedSettings.ApiToken),
            settingsStore.SettingsPath);

        return Results.Ok(connectionService.GetSettings());
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Failed to persist LM Studio settings to {RuntimeSettingsPath}.", settingsStore.SettingsPath);
        return Results.Problem("Unable to save settings. Check the service log for details.", statusCode: StatusCodes.Status500InternalServerError);
    }
});

api.MapGet("/models", async Task<IResult> (LmStudioClient client, LmStudioConnectionService connectionService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.GetModelsAsync(cancellationToken));
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Failed to load the LM Studio model catalog from {BaseUrl}.", connectionService.BaseUrl);
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapPost("/models/load", async Task<IResult> (ModelLoadRequest request, LmStudioClient client, LmStudioConnectionService connectionService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.LoadModelAsync(request, cancellationToken));
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Failed to load model {Model} through LM Studio at {BaseUrl}.", request.Model, connectionService.BaseUrl);
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapPost("/models/unload", async Task<IResult> (ModelUnloadRequest request, LmStudioClient client, LmStudioConnectionService connectionService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.UnloadModelAsync(request, cancellationToken));
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Failed to unload model instance {InstanceId} through LM Studio at {BaseUrl}.", request.InstanceId, connectionService.BaseUrl);
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapGet("/mcp/servers", async Task<IResult> (McpCatalogService catalog, LmStudioConnectionService connectionService, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await catalog.GetServersAsync(cancellationToken));
    }
    catch (Exception exception)
    {
        logger.LogError(exception, "Failed to load MCP servers from {McpConfigPath}.", connectionService.McpConfigPath);
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status500InternalServerError);
    }
});

api.MapGet("/chats", async (ChatRepository repository, CancellationToken cancellationToken) =>
    Results.Ok(await repository.ListChatsAsync(cancellationToken)));

api.MapGet("/chats/{chatId}", async Task<IResult> (string chatId, ChatRepository repository, CancellationToken cancellationToken) =>
{
    var chat = await repository.GetChatAsync(chatId, cancellationToken);
    return chat is null ? Results.NotFound() : Results.Ok(chat);
});

api.MapPost("/chats/stream", async Task (HttpContext context, ChatStreamRequest request, ChatRepository repository, McpCatalogService catalog, LmStudioClient client, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Model) || string.IsNullOrWhiteSpace(request.Input))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = "Model and input are required." }, cancellationToken);
        return;
    }

    StoredChatRecord chat;
    if (string.IsNullOrWhiteSpace(request.ChatId))
    {
        chat = await repository.CreateChatAsync(request, cancellationToken);
    }
    else
    {
        chat = await repository.GetChatRecordAsync(request.ChatId, cancellationToken)
            ?? throw new InvalidOperationException($"Chat '{request.ChatId}' was not found.");
    }

    await repository.SaveUserMessageAsync(chat.Id, request, cancellationToken);

    var availableServers = await catalog.GetServersAsync(cancellationToken);
    var selectedServerIds = (request.McpServerIds ?? [])
        .Where(serverId => !string.IsNullOrWhiteSpace(serverId))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    var integrations = availableServers
        .Where(server => selectedServerIds.Contains(server.Id))
        .Select(server => new LmStudioPluginIntegration { Id = $"mcp/{server.Id}" })
        .ToArray();

    context.Response.StatusCode = StatusCodes.Status200OK;
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.Append("Cache-Control", "no-cache");
    context.Response.Headers.Append("X-Chat-Id", chat.Id);

    using var lmResponse = await client.StartChatStreamAsync(new LmStudioChatRequest
    {
        Model = request.Model,
        Input = request.Input,
        SystemPrompt = request.SystemPrompt,
        Reasoning = request.Reasoning,
        ContextLength = request.ContextLength,
        PreviousResponseId = chat.LastResponseId,
        Integrations = integrations.Length == 0 ? null : integrations,
    }, cancellationToken);

    if (!lmResponse.IsSuccessStatusCode)
    {
        var details = await client.ReadErrorAsync(lmResponse, cancellationToken);
        await ChatStreamHelpers.WriteSseAsync(context.Response, "error", JsonSerializer.Serialize(new { message = details }), cancellationToken);
        return;
    }

    await using var stream = await lmResponse.Content.ReadAsStreamAsync(cancellationToken);
    var finalResponse = await ChatStreamHelpers.RelayLmStudioStreamAsync(stream, context.Response, cancellationToken);
    if (finalResponse is null)
    {
        return;
    }

    var assistant = ChatStreamHelpers.BuildAssistantPersistence(finalResponse);
    await repository.SaveAssistantMessageAsync(chat.Id, request, assistant, cancellationToken);
});

app.MapFallbackToFile("index.html");

try
{
    await app.RunAsync();
}
catch (Exception exception)
{
    app.Logger.LogCritical(exception, "Mobile LM Studio terminated unexpectedly.");
    throw;
}

static SettingsResponse NormalizeSettings(SettingsUpdateRequest request)
{
    return new SettingsResponse(
        request.BaseUrl.Trim(),
        request.ApiToken.Trim(),
        request.McpConfigPath.Trim());
}

static Dictionary<string, string[]>? ValidateSettings(SettingsResponse settings)
{
    Dictionary<string, string[]>? errors = null;

    if (!string.IsNullOrWhiteSpace(settings.BaseUrl)
        && (!Uri.TryCreate(settings.BaseUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)))
    {
        errors = [];
        errors["baseUrl"] = ["Base URL must be an absolute http:// or https:// URL."];
    }

    return errors;
}

static string[] ResolveConfiguredWebUrls(IConfiguration configuration)
{
    return configuration
        .GetSection("Web:Urls")
        .GetChildren()
        .Select(section => section.Value)
        .Where(value => !string.IsNullOrWhiteSpace(value))
        .Cast<string>()
        .ToArray();
}

static string[] ResolveHostOverrideUrls(IConfiguration configuration)
{
    var urls = configuration["urls"];
    if (string.IsNullOrWhiteSpace(urls))
    {
        return [];
    }

    return urls
        .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(value => !string.IsNullOrWhiteSpace(value))
        .ToArray();
}

internal static class ChatStreamHelpers
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    internal static async Task<LmStudioChatResponse?> RelayLmStudioStreamAsync(Stream source, HttpResponse response, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(source);
        var dataLines = new List<string>();
        string? eventType = null;
        LmStudioChatResponse? finalResponse = null;

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (line is null)
            {
                break;
            }

            if (line.Length == 0)
            {
                if (!string.IsNullOrWhiteSpace(eventType))
                {
                    var payload = string.Join("\n", dataLines);
                    var downstreamPayload = payload;

                    if (string.Equals(eventType, "chat.end", StringComparison.Ordinal))
                    {
                        var chatEndEvent = JsonSerializer.Deserialize<LmStudioChatEndEvent>(payload, JsonOptions);
                        if (chatEndEvent?.Result is not null)
                        {
                            finalResponse = CloneChatResponse(chatEndEvent.Result);
                        }
                        else
                        {
                            var chatResponse = JsonSerializer.Deserialize<LmStudioChatResponse>(payload, JsonOptions);
                            finalResponse = chatResponse is null ? null : CloneChatResponse(chatResponse);
                        }
                    }

                    await WriteSseAsync(response, eventType, downstreamPayload, cancellationToken);
                }

                eventType = null;
                dataLines.Clear();
                continue;
            }

            if (line.StartsWith("event:", StringComparison.OrdinalIgnoreCase))
            {
                eventType = line[6..].Trim();
                continue;
            }

            if (line.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                dataLines.Add(line[5..].TrimStart());
            }
        }

        return finalResponse;
    }

    private static LmStudioChatResponse CloneChatResponse(LmStudioChatResponse response)
    {
        return new LmStudioChatResponse
        {
            ModelInstanceId = response.ModelInstanceId,
            ResponseId = response.ResponseId,
            Stats = response.Stats is null
                ? null
                : new LmStudioChatStats(
                    response.Stats.InputTokens,
                    response.Stats.TotalOutputTokens,
                    response.Stats.ReasoningOutputTokens,
                    response.Stats.TokensPerSecond,
                    response.Stats.TimeToFirstTokenSeconds,
                    response.Stats.ModelLoadTimeSeconds),
            Output = response.Output.Select(item => new LmStudioOutputItem
            {
                Type = item.Type,
                Content = item.Content,
                Tool = item.Tool,
                Arguments = item.Arguments.ValueKind is JsonValueKind.Undefined ? default : item.Arguments.Clone(),
                Output = item.Output,
                ProviderInfo = item.ProviderInfo is null ? null : new LmStudioProviderInfo(item.ProviderInfo.Type, item.ProviderInfo.PluginId, item.ProviderInfo.ServerLabel),
                Reason = item.Reason,
                Metadata = item.Metadata.ValueKind is JsonValueKind.Undefined ? default : item.Metadata.Clone(),
            }).ToArray(),
        };
    }

    internal static AssistantPersistenceResult BuildAssistantPersistence(LmStudioChatResponse response)
    {
        var messages = new List<string>();
        var reasoning = new List<string>();
        var toolCalls = new List<ToolCallDto>();
        var invalidToolCalls = new List<InvalidToolCallDto>();

        foreach (var item in response.Output)
        {
            switch (item.Type)
            {
                case "message" when !string.IsNullOrWhiteSpace(item.Content):
                    messages.Add(item.Content);
                    break;
                case "reasoning" when !string.IsNullOrWhiteSpace(item.Content):
                    reasoning.Add(item.Content);
                    break;
                case "tool_call":
                    toolCalls.Add(new ToolCallDto(
                        item.Tool ?? "tool",
                        item.Arguments.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : item.Arguments.GetRawText(),
                        item.Output,
                        item.ProviderInfo is null ? null : new ToolProviderDto(item.ProviderInfo.Type, item.ProviderInfo.PluginId, item.ProviderInfo.ServerLabel)));
                    break;
                case "invalid_tool_call":
                    invalidToolCalls.Add(new InvalidToolCallDto(
                        item.Reason ?? "Invalid tool call",
                        item.Metadata.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : item.Metadata.GetRawText()));
                    break;
            }
        }

        return new AssistantPersistenceResult(
            string.Join(Environment.NewLine + Environment.NewLine, messages).Trim(),
            reasoning.Count == 0 ? null : string.Join(Environment.NewLine + Environment.NewLine, reasoning).Trim(),
            toolCalls,
            invalidToolCalls,
            response.Stats is null
                ? null
                : new ChatStatsDto(
                    response.Stats.InputTokens,
                    response.Stats.TotalOutputTokens,
                    response.Stats.ReasoningOutputTokens,
                    response.Stats.TokensPerSecond,
                    response.Stats.TimeToFirstTokenSeconds,
                    response.Stats.ModelLoadTimeSeconds),
            response.ResponseId);
    }

    internal static async Task WriteSseAsync(HttpResponse response, string eventType, string payload, CancellationToken cancellationToken)
    {
        var builder = new StringBuilder();
        builder.Append("event: ").Append(eventType).Append('\n');

        var lines = string.IsNullOrEmpty(payload) ? [string.Empty] : payload.Replace("\r", string.Empty).Split('\n');
        foreach (var line in lines)
        {
            builder.Append("data: ").Append(line).Append('\n');
        }

        builder.Append('\n');
        await response.WriteAsync(builder.ToString(), cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}