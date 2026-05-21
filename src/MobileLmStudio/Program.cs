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

api.MapGet("/settings", (LmStudioConnectionService connectionService, PinSecurityService pinSecurity) =>
{
    return Results.Ok(connectionService.GetSettings(pinSecurity.IsConfigured));
});

api.MapPost("/settings", async Task<IResult> (SettingsUpdateRequest request, HttpContext context, LmStudioConnectionService connectionService, LmStudioSettingsStore settingsStore, PinSecurityService pinSecurity, ILogger<Program> logger) =>
{
    var normalizedSettings = NormalizeSettings(request);
    var validationErrors = ValidateSettings(normalizedSettings);
    if (validationErrors is not null)
    {
        return Results.ValidationProblem(validationErrors);
    }

    SecurityOptions securitySettings;
    try
    {
        securitySettings = pinSecurity.BuildUpdatedSecurity(request.RequireLogin, request.Pin);
    }
    catch (ArgumentException exception)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["pin"] = [exception.Message],
        });
    }

    try
    {
        settingsStore.Save(normalizedSettings, securitySettings);
        connectionService.UpdateSettings(normalizedSettings.BaseUrl, normalizedSettings.ApiToken, normalizedSettings.McpConfigPath);
        pinSecurity.UpdateSecurity(securitySettings);

        if (!string.IsNullOrWhiteSpace(securitySettings.PinHash))
        {
            if (context.User.Identity?.IsAuthenticated != true)
            {
                var claims = new[] { new Claim(ClaimTypes.Name, "mobile-user") };
                var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
                await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
            }
        }
        else if (context.User.Identity?.IsAuthenticated == true)
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }

        logger.LogInformation(
            "LM Studio settings updated. BaseUrl={BaseUrl}; McpConfigPath={McpConfigPath}; ApiTokenConfigured={HasApiToken}; RequireLogin={RequireLogin}; RuntimeSettingsPath={RuntimeSettingsPath}",
            normalizedSettings.BaseUrl,
            normalizedSettings.McpConfigPath,
            !string.IsNullOrWhiteSpace(normalizedSettings.ApiToken),
            !string.IsNullOrWhiteSpace(securitySettings.PinHash),
            settingsStore.SettingsPath);

        return Results.Ok(connectionService.GetSettings(!string.IsNullOrWhiteSpace(securitySettings.PinHash)));
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

api.MapDelete("/chats/{chatId}", async Task<IResult> (string chatId, ChatRepository repository, CancellationToken cancellationToken) =>
{
    return await repository.DeleteChatAsync(chatId, cancellationToken)
        ? Results.NoContent()
        : Results.NotFound();
});

api.MapGet("/chats/{chatId}/export", async Task<IResult> (string chatId, ChatRepository repository, CancellationToken cancellationToken) =>
{
    var chat = await repository.GetChatAsync(chatId, cancellationToken);
    if (chat is null)
    {
        return Results.NotFound();
    }

    var markdown = BuildChatMarkdown(chat);
    var fileName = $"{SanitizeFileName(chat.Title)}.md";
    return Results.File(Encoding.UTF8.GetBytes(markdown), "text/markdown; charset=utf-8", fileName);
});

api.MapGet("/chats/{chatId}/messages/{messageId}/export", async Task<IResult> (string chatId, string messageId, ChatRepository repository, CancellationToken cancellationToken) =>
{
    var chat = await repository.GetChatAsync(chatId, cancellationToken);
    if (chat is null)
    {
        return Results.NotFound();
    }

    var message = chat.Messages.FirstOrDefault(candidate => string.Equals(candidate.Id, messageId, StringComparison.Ordinal));
    if (message is null)
    {
        return Results.NotFound();
    }

    var markdown = BuildMessageMarkdown(chat, message);
    var fileName = $"{SanitizeFileName(chat.Title)}-{message.Role}-{message.Id}.md";
    return Results.File(Encoding.UTF8.GetBytes(markdown), "text/markdown; charset=utf-8", fileName);
});

api.MapPost("/chats/{chatId}/retry/stream", async Task (HttpContext context, string chatId, ChatRepository repository, McpCatalogService catalog, LmStudioClient client) =>
{
    var processingToken = app.Lifetime.ApplicationStopping;
    var retryContext = await repository.GetRetryContextAsync(chatId, processingToken);
    if (retryContext is null)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        await context.Response.WriteAsJsonAsync(new { error = "There is no prompt available to retry in this chat." }, context.RequestAborted);
        return;
    }

    var chat = await repository.GetChatRecordAsync(chatId, processingToken)
        ?? throw new InvalidOperationException($"Chat '{chatId}' was not found.");

    var retryRequest = new ChatStreamRequest(
        retryContext.ChatId,
        retryContext.Model,
        retryContext.Input,
        retryContext.SystemPrompt,
        retryContext.Reasoning,
        retryContext.ContextLength,
        retryContext.Temperature,
        retryContext.McpServerIds.ToArray(),
        retryContext.Attachments.ToArray());

    await ExecuteChatStreamAsync(
        context,
        retryRequest,
        chat,
        repository,
        catalog,
        client,
        retryContext.PreviousResponseId,
        saveUserMessage: false,
        processingToken);
});

api.MapPost("/chats/stream", async Task (HttpContext context, ChatStreamRequest request, ChatRepository repository, McpCatalogService catalog, LmStudioClient client) =>
{
    if (string.IsNullOrWhiteSpace(request.Model) || (string.IsNullOrWhiteSpace(request.Input) && (request.Attachments?.Length ?? 0) == 0))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = "Model and either text or an attachment are required." }, context.RequestAborted);
        return;
    }

    var processingToken = app.Lifetime.ApplicationStopping;
    StoredChatRecord chat;
    if (string.IsNullOrWhiteSpace(request.ChatId))
    {
        chat = await repository.CreateChatAsync(request, processingToken);
    }
    else
    {
        chat = await repository.GetChatRecordAsync(request.ChatId, processingToken)
            ?? throw new InvalidOperationException($"Chat '{request.ChatId}' was not found.");
    }

    await ExecuteChatStreamAsync(
        context,
        request,
        chat,
        repository,
        catalog,
        client,
        chat.LastResponseId,
        saveUserMessage: true,
        processingToken);
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
    request.McpConfigPath.Trim(),
    request.RequireLogin);
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

static async Task ExecuteChatStreamAsync(
    HttpContext context,
    ChatStreamRequest request,
    StoredChatRecord chat,
    ChatRepository repository,
    McpCatalogService catalog,
    LmStudioClient client,
    string? previousResponseId,
    bool saveUserMessage,
    CancellationToken cancellationToken)
{
    if (saveUserMessage)
    {
        await repository.SaveUserMessageAsync(chat.Id, request, cancellationToken);
    }

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
        Input = BuildLmStudioInput(request),
        SystemPrompt = request.SystemPrompt,
        Reasoning = request.Reasoning,
        ContextLength = request.ContextLength,
        Temperature = request.Temperature,
        PreviousResponseId = previousResponseId,
        Integrations = integrations.Length == 0 ? null : integrations,
    }, cancellationToken);

    if (!lmResponse.IsSuccessStatusCode)
    {
        var details = await client.ReadErrorAsync(lmResponse, cancellationToken);
        await ChatStreamHelpers.TryWriteSseAsync(context.Response, "error", JsonSerializer.Serialize(new { message = details }), cancellationToken);
        return;
    }

    await using var stream = await lmResponse.Content.ReadAsStreamAsync(cancellationToken);
    var finalResponse = await ChatStreamHelpers.RelayLmStudioStreamAsync(stream, context.Response, cancellationToken);
    if (finalResponse is null)
    {
        return;
    }

    var assistant = ChatStreamHelpers.BuildAssistantPersistence(finalResponse, request);
    await repository.SaveAssistantMessageAsync(chat.Id, request, assistant, cancellationToken);
}

static object BuildLmStudioInput(ChatStreamRequest request)
{
    var attachments = request.Attachments ?? [];
    var imageAttachments = attachments
        .Where(attachment => string.Equals(attachment.Kind, "image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(attachment.DataUrl))
        .ToArray();

    var fileAttachments = attachments
        .Where(attachment => !string.Equals(attachment.Kind, "image", StringComparison.OrdinalIgnoreCase))
        .ToArray();

    var promptText = request.Input.Trim();
    if (string.IsNullOrWhiteSpace(promptText) && attachments.Length > 0)
    {
        promptText = imageAttachments.Length > 0 && fileAttachments.Length > 0
            ? "Please analyze the attached content and files."
            : imageAttachments.Length > 0
                ? "Please analyze the attached image."
                : "Please use the attached file as context.";
    }

    var promptBuilder = new StringBuilder(promptText);
    if (fileAttachments.Length > 0)
    {
        promptBuilder.AppendLine();
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("Attached file context:");

        foreach (var attachment in fileAttachments)
        {
            promptBuilder.AppendLine();
            promptBuilder.AppendLine(BuildFileAttachmentPromptBlock(attachment));
        }
    }

    if (imageAttachments.Length == 0)
    {
        return promptBuilder.ToString();
    }

    var items = new List<object>
    {
        new { type = "text", content = promptBuilder.ToString() },
    };

    items.AddRange(imageAttachments.Select(attachment => new { type = "image", data_url = attachment.DataUrl }));
    return items;
}

static string BuildFileAttachmentPromptBlock(ChatAttachmentDto attachment)
{
    var builder = new StringBuilder();
    builder.Append("File: ").Append(attachment.Name);
    if (!string.IsNullOrWhiteSpace(attachment.ContentType))
    {
        builder.Append(" (").Append(attachment.ContentType).Append(')');
    }

    builder.AppendLine();

    if (!string.IsNullOrWhiteSpace(attachment.TextContent))
    {
        builder.AppendLine("```text");
        builder.AppendLine(attachment.TextContent.TrimEnd());
        builder.AppendLine("```");
        if (attachment.Truncated)
        {
            builder.AppendLine("File content was truncated before sending.");
        }
    }
    else
    {
        builder.AppendLine("Binary file attached. Text extraction was not available.");
    }

    return builder.ToString().TrimEnd();
}

static string BuildChatMarkdown(ChatDetailDto chat)
{
    var builder = new StringBuilder();
    builder.AppendLine($"# {chat.Title}");
    builder.AppendLine();
    builder.AppendLine($"- Model: {chat.ModelKey}");
    builder.AppendLine($"- Created: {chat.CreatedAt:O}");
    builder.AppendLine($"- Updated: {chat.UpdatedAt:O}");
    if (!string.IsNullOrWhiteSpace(chat.SystemPrompt))
    {
        builder.AppendLine($"- System prompt configured: yes");
    }
    if (!string.IsNullOrWhiteSpace(chat.Reasoning))
    {
        builder.AppendLine($"- Reasoning: {chat.Reasoning}");
    }
    if (chat.ContextLength.HasValue)
    {
        builder.AppendLine($"- Context length: {chat.ContextLength.Value}");
    }
    if (chat.Temperature.HasValue)
    {
        builder.AppendLine($"- Temperature: {chat.Temperature.Value:0.##}");
    }
    if (chat.SelectedMcpServerIds.Count > 0)
    {
        builder.AppendLine($"- MCP servers: {string.Join(", ", chat.SelectedMcpServerIds)}");
    }

    if (!string.IsNullOrWhiteSpace(chat.SystemPrompt))
    {
        builder.AppendLine();
        builder.AppendLine("## System Prompt");
        builder.AppendLine();
        builder.AppendLine(chat.SystemPrompt.TrimEnd());
    }

    foreach (var message in chat.Messages)
    {
        builder.AppendLine();
        builder.AppendLine("---");
        builder.AppendLine();
        AppendMessageMarkdown(builder, message);
    }

    return builder.ToString().TrimEnd();
}

static string BuildMessageMarkdown(ChatDetailDto chat, ChatMessageDto message)
{
    var builder = new StringBuilder();
    builder.AppendLine($"# {chat.Title}");
    builder.AppendLine();
    AppendMessageMarkdown(builder, message);
    return builder.ToString().TrimEnd();
}

static void AppendMessageMarkdown(StringBuilder builder, ChatMessageDto message)
{
    builder.Append("## ").Append(message.Role switch
    {
        "assistant" => "Assistant",
        "user" => "User",
        _ => message.Role,
    });

    if (!string.IsNullOrWhiteSpace(message.ModelKey) && string.Equals(message.Role, "assistant", StringComparison.OrdinalIgnoreCase))
    {
        builder.Append(" • ").Append(message.ModelKey);
    }

    builder.AppendLine();
    builder.AppendLine();
    builder.AppendLine($"- Timestamp: {message.CreatedAt:O}");

    if (!string.IsNullOrWhiteSpace(message.Content))
    {
        builder.AppendLine();
        builder.AppendLine(message.Content.TrimEnd());
    }

    if (!string.IsNullOrWhiteSpace(message.Reasoning))
    {
        builder.AppendLine();
        builder.AppendLine("### Thinking");
        builder.AppendLine();
        builder.AppendLine(message.Reasoning.TrimEnd());
    }

    if (message.Attachments.Count > 0)
    {
        builder.AppendLine();
        builder.AppendLine("### Attachments");

        foreach (var attachment in message.Attachments)
        {
            builder.AppendLine();
            builder.AppendLine($"- Kind: {attachment.Kind}");
            builder.AppendLine($"- Name: {attachment.Name}");
            if (!string.IsNullOrWhiteSpace(attachment.ContentType))
            {
                builder.AppendLine($"- Content type: {attachment.ContentType}");
            }
            builder.AppendLine($"- Size bytes: {attachment.SizeBytes}");
            builder.AppendLine($"- Truncated: {attachment.Truncated}");

            if (!string.IsNullOrWhiteSpace(attachment.TextContent))
            {
                builder.AppendLine();
                builder.AppendLine("```text");
                builder.AppendLine(attachment.TextContent.TrimEnd());
                builder.AppendLine("```");
            }

            if (!string.IsNullOrWhiteSpace(attachment.DataUrl))
            {
                builder.AppendLine();
                builder.AppendLine("```text");
                builder.AppendLine(attachment.DataUrl.Trim());
                builder.AppendLine("```");
            }
        }
    }

    if (message.ToolCalls.Count > 0)
    {
        builder.AppendLine();
        builder.AppendLine("### Tools Used");

        foreach (var toolCall in message.ToolCalls)
        {
            builder.AppendLine();
            builder.AppendLine($"#### {toolCall.Tool}");
            builder.AppendLine();
            builder.AppendLine("```json");
            builder.AppendLine(toolCall.ArgumentsJson.Trim());
            builder.AppendLine("```");

            if (!string.IsNullOrWhiteSpace(toolCall.Output))
            {
                builder.AppendLine();
                builder.AppendLine("```text");
                builder.AppendLine(toolCall.Output.TrimEnd());
                builder.AppendLine("```");
            }
        }
    }

    if (message.InvalidToolCalls.Count > 0)
    {
        builder.AppendLine();
        builder.AppendLine("### Tool Errors");

        foreach (var toolCall in message.InvalidToolCalls)
        {
            builder.AppendLine();
            builder.AppendLine($"#### {toolCall.Reason}");
            builder.AppendLine();
            builder.AppendLine("```json");
            builder.AppendLine(toolCall.MetadataJson.Trim());
            builder.AppendLine("```");
        }
    }

    if (message.Stats is not null)
    {
        builder.AppendLine();
        builder.AppendLine("### Stats");
        builder.AppendLine();
        builder.AppendLine($"- Input tokens: {message.Stats.InputTokens}");
        builder.AppendLine($"- Output tokens: {message.Stats.TotalOutputTokens}");
        builder.AppendLine($"- Reasoning tokens: {message.Stats.ReasoningOutputTokens}");
        builder.AppendLine($"- Tokens per second: {message.Stats.TokensPerSecond}");
        builder.AppendLine($"- Time to first token: {message.Stats.TimeToFirstTokenSeconds}");
        if (message.Stats.ModelLoadTimeSeconds.HasValue)
        {
            builder.AppendLine($"- Model load time seconds: {message.Stats.ModelLoadTimeSeconds.Value}");
        }
        if (message.Stats.ContextLimit.HasValue)
        {
            builder.AppendLine($"- Context limit: {message.Stats.ContextLimit.Value}");
        }
    }
}

static string SanitizeFileName(string value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return "chat-export";
    }

    var invalidCharacters = Path.GetInvalidFileNameChars();
    var sanitized = new string(value
        .Select(character => invalidCharacters.Contains(character) ? '-' : character)
        .ToArray())
        .Trim();

    return string.IsNullOrWhiteSpace(sanitized) ? "chat-export" : sanitized;
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
        var canWriteDownstream = true;

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

                    if (canWriteDownstream)
                    {
                        canWriteDownstream = await TryWriteSseAsync(response, eventType, downstreamPayload, cancellationToken);
                    }
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

    internal static AssistantPersistenceResult BuildAssistantPersistence(LmStudioChatResponse response, ChatStreamRequest request)
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
                    response.Stats.ModelLoadTimeSeconds,
                    request.ContextLength),
            response.ResponseId,
            request.Model);
    }

    internal static async Task<bool> TryWriteSseAsync(HttpResponse response, string eventType, string payload, CancellationToken cancellationToken)
    {
        try
        {
            await WriteSseAsync(response, eventType, payload, cancellationToken);
            return true;
        }
        catch (IOException)
        {
            return false;
        }
        catch (ObjectDisposedException)
        {
            return false;
        }
        catch (OperationCanceledException) when (response.HttpContext.RequestAborted.IsCancellationRequested)
        {
            return false;
        }
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