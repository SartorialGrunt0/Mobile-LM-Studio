using System.Security.Cryptography;
using Microsoft.Extensions.Options;
using MobileLmStudio.Models;

namespace MobileLmStudio.Services;

internal sealed class PinSecurityService
{
    private readonly IOptionsMonitor<AppOptions> _options;

    public PinSecurityService(IOptionsMonitor<AppOptions> options)
    {
        _options = options;
    }

    public bool IsConfigured
    {
        get
        {
            var security = _options.CurrentValue.Security;
            return !string.IsNullOrWhiteSpace(security.PinHash) && !string.IsNullOrWhiteSpace(security.PinSalt);
        }
    }

    public bool Verify(string? pin)
    {
        if (!IsConfigured)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(pin))
        {
            return false;
        }

        try
        {
            var security = _options.CurrentValue.Security;
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
}