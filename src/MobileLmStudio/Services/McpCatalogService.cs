using System.Text.Json;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class McpCatalogService
{
    private readonly LmStudioConnectionService _connectionService;

    public McpCatalogService(LmStudioConnectionService connectionService)
    {
        _connectionService = connectionService;
    }

    public async Task<IReadOnlyList<McpServerDto>> GetServersAsync(CancellationToken cancellationToken)
    {
        var configuredPath = _connectionService.McpConfigPath;
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            return [];
        }

        var resolvedPath = Path.GetFullPath(Environment.ExpandEnvironmentVariables(configuredPath));
        if (!File.Exists(resolvedPath))
        {
            return [];
        }

        await using var stream = File.OpenRead(resolvedPath);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        return ParseServers(document.RootElement);
    }

    private static IReadOnlyList<McpServerDto> ParseServers(JsonElement root)
    {
        var servers = new List<McpServerDto>();

        if (TryReadServerObject(root, "mcpServers", servers) || TryReadServerObject(root, "servers", servers))
        {
            return servers;
        }

        if (root.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in root.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Object && LooksLikeServerDefinition(property.Value))
                {
                    servers.Add(CreateServer(property.Name, property.Value));
                }
            }
        }

        return servers;
    }

    private static bool TryReadServerObject(JsonElement root, string propertyName, List<McpServerDto> servers)
    {
        if (!root.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        if (property.ValueKind == JsonValueKind.Object)
        {
            foreach (var server in property.EnumerateObject())
            {
                servers.Add(CreateServer(server.Name, server.Value));
            }

            return true;
        }

        if (property.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in property.EnumerateArray())
            {
                var label = ReadString(item, "label") ?? ReadString(item, "name") ?? ReadString(item, "id");
                if (!string.IsNullOrWhiteSpace(label))
                {
                    servers.Add(CreateServer(label, item));
                }
            }

            return true;
        }

        return false;
    }

    private static bool LooksLikeServerDefinition(JsonElement element)
    {
        return element.TryGetProperty("command", out _) || element.TryGetProperty("url", out _) || element.TryGetProperty("transport", out _);
    }

    private static McpServerDto CreateServer(string id, JsonElement server)
    {
        var description = ReadString(server, "description") ?? ReadString(server, "url") ?? ReadString(server, "command");
        var transport = ReadString(server, "transport");

        if (string.IsNullOrWhiteSpace(transport))
        {
            transport = server.TryGetProperty("url", out _) ? "url" : server.TryGetProperty("command", out _) ? "stdio" : null;
        }

        return new McpServerDto(id, id, description, transport);
    }

    private static string? ReadString(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    }
}