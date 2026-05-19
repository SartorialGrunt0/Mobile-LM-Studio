using System.Text;
using Microsoft.Extensions.Logging;

namespace MobileLmStudio.Services;

internal static class ApplicationPaths
{
    internal static string ResolveSharedDataDirectory()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MobileLmStudio");
    }

    internal static string ResolveRuntimeSettingsPath()
    {
        return Path.Combine(ResolveSharedDataDirectory(), "appsettings.runtime.json");
    }

    internal static string ResolveLogDirectory()
    {
        return Path.Combine(ResolveSharedDataDirectory(), "logs");
    }
}

internal sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly FileLogWriter _writer;
    private readonly LogLevel _minimumLevel;

    public FileLoggerProvider(string logDirectory, LogLevel minimumLevel = LogLevel.Information)
    {
        _writer = new FileLogWriter(logDirectory);
        _minimumLevel = minimumLevel;
    }

    public ILogger CreateLogger(string categoryName)
    {
        return new FileLogger(categoryName, _writer, _minimumLevel);
    }

    public void Dispose()
    {
        _writer.Dispose();
    }
}

internal sealed class FileLogger : ILogger
{
    private readonly string _categoryName;
    private readonly FileLogWriter _writer;
    private readonly LogLevel _minimumLevel;

    public FileLogger(string categoryName, FileLogWriter writer, LogLevel minimumLevel)
    {
        _categoryName = categoryName;
        _writer = writer;
        _minimumLevel = minimumLevel;
    }

    public IDisposable BeginScope<TState>(TState state) where TState : notnull
    {
        return NullScope.Instance;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        return logLevel != LogLevel.None && logLevel >= _minimumLevel;
    }

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel))
        {
            return;
        }

        var message = formatter(state, exception);
        if (string.IsNullOrWhiteSpace(message) && exception is null)
        {
            return;
        }

        _writer.WriteLine(_categoryName, logLevel, eventId, message, exception);
    }

    private sealed class NullScope : IDisposable
    {
        internal static NullScope Instance { get; } = new();

        public void Dispose()
        {
        }
    }
}

internal sealed class FileLogWriter : IDisposable
{
    private readonly string _logDirectory;
    private readonly object _lock = new();

    public FileLogWriter(string logDirectory)
    {
        _logDirectory = logDirectory;
    }

    public void WriteLine(string categoryName, LogLevel logLevel, EventId eventId, string message, Exception? exception)
    {
        Directory.CreateDirectory(_logDirectory);

        var logFilePath = Path.Combine(_logDirectory, $"{DateTime.UtcNow:yyyyMMdd}.log");
        var entry = new StringBuilder()
            .Append(DateTimeOffset.Now.ToString("O"))
            .Append(' ')
            .Append('[')
            .Append(logLevel)
            .Append("] ")
            .Append(categoryName);

        if (eventId.Id != 0)
        {
            entry.Append(" (").Append(eventId.Id).Append(')');
        }

        if (!string.IsNullOrWhiteSpace(message))
        {
            entry.Append(": ").Append(message);
        }

        if (exception is not null)
        {
            entry.AppendLine().Append(exception);
        }

        entry.AppendLine();

        lock (_lock)
        {
            File.AppendAllText(logFilePath, entry.ToString(), Encoding.UTF8);
        }
    }

    public void Dispose()
    {
    }
}