using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class PinSecurityService
{
    private readonly object _lock = new();
    private SecurityOptions _currentSecurity;

    public PinSecurityService(IOptions<AppOptions> options)
    {
        _currentSecurity = options.Value.Security;
    }

    public bool IsConfigured
    {
        get
        {
            lock (_lock)
            {
                return HasPin(_currentSecurity);
            }
        }
    }

    public SecurityOptions BuildUpdatedSecurity(bool requireLogin, string? pin)
    {
        lock (_lock)
        {
            var iterations = _currentSecurity.Iterations > 0 ? _currentSecurity.Iterations : 100000;

            if (!requireLogin)
            {
                return new SecurityOptions
                {
                    PinHash = string.Empty,
                    PinSalt = string.Empty,
                    Iterations = iterations,
                };
            }

            if (!string.IsNullOrWhiteSpace(pin))
            {
                return CreateSecurityOptions(pin.Trim(), iterations);
            }

            if (HasPin(_currentSecurity))
            {
                return _currentSecurity;
            }

            throw new ArgumentException("Enter a PIN to enable sign-in.", nameof(pin));
        }
    }

    public void UpdateSecurity(SecurityOptions security)
    {
        lock (_lock)
        {
            _currentSecurity = security;
        }
    }

    public bool Verify(string? pin)
    {
        SecurityOptions security;
        lock (_lock)
        {
            security = _currentSecurity;
        }

        if (!HasPin(security))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(pin))
        {
            return false;
        }

        try
        {
            var salt = Convert.FromBase64String(security.PinSalt);
            var expectedHash = Convert.FromBase64String(security.PinHash);
            var actualHash = Rfc2898DeriveBytes.Pbkdf2(pin, salt, security.Iterations, HashAlgorithmName.SHA256, expectedHash.Length);
            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static bool HasPin(SecurityOptions security)
    {
        return !string.IsNullOrWhiteSpace(security.PinHash) && !string.IsNullOrWhiteSpace(security.PinSalt);
    }

    private static SecurityOptions CreateSecurityOptions(string pin, int iterations)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var hashBytes = Rfc2898DeriveBytes.Pbkdf2(pin, saltBytes, iterations, HashAlgorithmName.SHA256, 32);

        return new SecurityOptions
        {
            PinHash = Convert.ToBase64String(hashBytes),
            PinSalt = Convert.ToBase64String(saltBytes),
            Iterations = iterations,
        };
    }
}