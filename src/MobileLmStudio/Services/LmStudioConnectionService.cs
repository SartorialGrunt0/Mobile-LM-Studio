using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

/// <summary>
/// Provides runtime-overridable LM Studio connection settings.
/// Changes take effect immediately without requiring an app restart.
/// </summary>
internal sealed class LmStudioConnectionService
{
    private readonly object _lock = new();
    private readonly string _initialBaseUrl;
    private readonly string _initialApiToken;
    private readonly string _initialMcpConfigPath;
    private string _baseUrl;
    private string _apiToken;
    private string _mcpConfigPath;

    public LmStudioConnectionService(LmStudioOptions initialOptions)
    {
        _initialBaseUrl = initialOptions.BaseUrl;
        _initialApiToken = initialOptions.ApiToken;
        _initialMcpConfigPath = initialOptions.McpConfigPath;
        _baseUrl = initialOptions.BaseUrl;
        _apiToken = initialOptions.ApiToken;
        _mcpConfigPath = initialOptions.McpConfigPath;
    }

    public string BaseUrl
    {
        get { lock (_lock) { return _baseUrl; } }
        set { lock (_lock) { _baseUrl = value; } }
    }

    public string ApiToken
    {
        get { lock (_lock) { return _apiToken; } }
        set { lock (_lock) { _apiToken = value; } }
    }

    public string McpConfigPath
    {
        get { lock (_lock) { return _mcpConfigPath; } }
        set { lock (_lock) { _mcpConfigPath = value; } }
    }

    public SettingsResponse GetSettings(bool requireLogin)
    {
        lock (_lock)
        {
            return new SettingsResponse(_baseUrl, _apiToken, _mcpConfigPath, requireLogin);
        }
    }

    public void UpdateSettings(string baseUrl, string apiToken, string mcpConfigPath)
    {
        lock (_lock)
        {
            _baseUrl = baseUrl;
            _apiToken = apiToken;
            _mcpConfigPath = mcpConfigPath;
        }
    }

    public bool HasChanges()
    {
        lock (_lock)
        {
            return _baseUrl != _initialBaseUrl
                || _apiToken != _initialApiToken
                || _mcpConfigPath != _initialMcpConfigPath;
        }
    }
}