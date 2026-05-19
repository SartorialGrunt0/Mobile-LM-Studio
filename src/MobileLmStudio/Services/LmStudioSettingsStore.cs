using System.Text;
using System.Text.Json;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class LmStudioSettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    public LmStudioSettingsStore(string settingsPath)
    {
        SettingsPath = settingsPath;
    }

    public string SettingsPath { get; }

    public void Save(SettingsResponse settings)
    {
        var settingsDirectory = Path.GetDirectoryName(SettingsPath);
        if (!string.IsNullOrWhiteSpace(settingsDirectory))
        {
            Directory.CreateDirectory(settingsDirectory);
        }

        var payload = new
        {
            LmStudio = new
            {
                BaseUrl = settings.BaseUrl,
                ApiToken = settings.ApiToken,
                McpConfigPath = settings.McpConfigPath,
            },
        };

        var tempPath = $"{SettingsPath}.tmp";
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        File.WriteAllText(tempPath, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        File.Move(tempPath, SettingsPath, overwrite: true);
    }
}