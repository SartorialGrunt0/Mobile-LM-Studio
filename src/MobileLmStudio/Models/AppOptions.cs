namespace MobileLmStudio.Models;

internal sealed class AppOptions
{
    public LmStudioOptions LmStudio { get; init; } = new();

    public SecurityOptions Security { get; init; } = new();

    public StorageOptions Storage { get; init; } = new();

    public WebOptions Web { get; init; } = new();
}

internal sealed class LmStudioOptions
{
    public string BaseUrl { get; init; } = "http://127.0.0.1:1234";

    public string ApiToken { get; init; } = string.Empty;

    public string McpConfigPath { get; init; } = string.Empty;
}

internal sealed class SecurityOptions
{
    public string PinHash { get; init; } = string.Empty;

    public string PinSalt { get; init; } = string.Empty;

    public int Iterations { get; init; } = 100000;
}

internal sealed class StorageOptions
{
    public string ConnectionString { get; init; } = "Data Source=%PROGRAMDATA%\\MobileLmStudio\\mobile-lm-studio.db";
}

internal sealed class WebOptions
{
    public string[] Urls { get; init; } = ["http://0.0.0.0:5080"];
}