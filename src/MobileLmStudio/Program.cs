using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;
using MobileLmStudio.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseWindowsService();
builder.Services.Configure<AppOptions>(builder.Configuration);

var configuredOptions = builder.Configuration.Get<AppOptions>() ?? new AppOptions();
if (configuredOptions.Web.Urls.Length > 0)
{
    builder.WebHost.UseUrls(configuredOptions.Web.Urls);
}

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
builder.Services.AddHttpClient<LmStudioClient>();

var app = builder.Build();

await app.Services.GetRequiredService<ChatRepository>().InitializeAsync(app.Lifetime.ApplicationStopping);

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/bootstrap", (HttpContext context, IOptions<AppOptions> options, PinSecurityService pinSecurity) =>
{
    var current = options.Value;
    return Results.Ok(new BootstrapResponse(
        pinSecurity.IsConfigured,
        !pinSecurity.IsConfigured || context.User.Identity?.IsAuthenticated == true,
        !string.IsNullOrWhiteSpace(current.LmStudio.BaseUrl),
        !string.IsNullOrWhiteSpace(current.LmStudio.McpConfigPath),
        !string.IsNullOrWhiteSpace(current.LmStudio.ApiToken),
        current.Web.Urls.FirstOrDefault() ?? "http://0.0.0.0:5080"));
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
api.RequireAuthorization();

api.MapGet("/models", async Task<IResult> (LmStudioClient client, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.GetModelsAsync(cancellationToken));
    }
    catch (Exception exception)
    {
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapPost("/models/load", async Task<IResult> (ModelLoadRequest request, LmStudioClient client, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.LoadModelAsync(request, cancellationToken));
    }
    catch (Exception exception)
    {
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapPost("/models/unload", async Task<IResult> (ModelUnloadRequest request, LmStudioClient client, CancellationToken cancellationToken) =>
{
    try
    {
        return Results.Ok(await client.UnloadModelAsync(request, cancellationToken));
    }
    catch (Exception exception)
    {
        return Results.Problem(exception.Message, statusCode: StatusCodes.Status502BadGateway);
    }
});

api.MapGet("/mcp/servers", async (McpCatalogService catalog, CancellationToken cancellationToken) =>
    Results.Ok(await catalog.GetServersAsync(cancellationToken)));

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

app.Run();

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
                            finalResponse = chatEndEvent.Result;
                            downstreamPayload = JsonSerializer.Serialize(chatEndEvent.Result, JsonOptions);
                        }
                        else
                        {
                            finalResponse = JsonSerializer.Deserialize<LmStudioChatResponse>(payload, JsonOptions);
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