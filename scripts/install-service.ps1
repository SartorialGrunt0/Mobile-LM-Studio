param(
    [string]$PublishPath = "",
    [string]$InstallPath = "$env:ProgramFiles\MobileLmStudio",
    [string]$ServiceName = "MobileLmStudio",
    [string]$SettingsPath = "",
    [string]$ListenUrl = "http://0.0.0.0:5080",
    [string]$LmStudioUrl = "http://127.0.0.1:1234",
    [string]$LmStudioApiToken = "",
    [string]$McpConfigPath = "",
    [string]$DataPath = "$env:ProgramData\MobileLmStudio\mobile-lm-studio.db",
    [string]$Pin = "",
    [int]$PinIterations = 100000,
    [string]$FailurePath = "",
    [switch]$PromptForMissingValues,
    [switch]$SkipCopy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedFailurePath = if ([string]::IsNullOrWhiteSpace($FailurePath)) {
    ""
} else {
    [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($FailurePath))
}

trap {
    if (-not [string]::IsNullOrWhiteSpace($resolvedFailurePath)) {
        try {
            $failureMessage = $_.Exception.Message
            if ([string]::IsNullOrWhiteSpace($failureMessage)) {
                $failureMessage = $_.ToString()
            }

            Set-Content -Path $resolvedFailurePath -Value $failureMessage -Encoding UTF8
        } catch {
        }
    }

    throw
}

function Read-SecretText {
    param([string]$Prompt)

    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function New-HashedPin {
    param(
        [string]$PlainTextPin,
        [int]$Iterations
    )

    $saltBytes = New-Object byte[] 16
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($saltBytes)

    try {
        $deriver = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($PlainTextPin, $saltBytes, $Iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
    } catch {
        throw "This PowerShell host cannot create a SHA256 PBKDF2 hash. Use PowerShell 7 or generate the hash with a newer .NET runtime."
    }

    try {
        $hashBytes = $deriver.GetBytes(32)
    } finally {
        $deriver.Dispose()
    }

    return @{
        PinHash = [Convert]::ToBase64String($hashBytes)
        PinSalt = [Convert]::ToBase64String($saltBytes)
    }
}

function Resolve-SourcePath {
    if ($SkipCopy.IsPresent) {
        return (Resolve-Path $InstallPath).Path
    }

    if ([string]::IsNullOrWhiteSpace($PublishPath)) {
        throw "PublishPath is required unless -SkipCopy is used."
    }

    return (Resolve-Path $PublishPath).Path
}

function Resolve-ServiceCommand {
    param([string]$BasePath)

    $exePath = Join-Path $BasePath "MobileLmStudio.exe"
    if (Test-Path $exePath) {
        return ('"{0}"' -f $exePath)
    }

    $dllPath = Join-Path $BasePath "MobileLmStudio.dll"
    if (Test-Path $dllPath) {
        $dotnet = (Get-Command dotnet -ErrorAction Stop).Source
        return ('"{0}" "{1}"' -f $dotnet, $dllPath)
    }

    throw "Could not find MobileLmStudio.exe or MobileLmStudio.dll in $BasePath."
}

function Get-ConnectionString {
    param([string]$DatabasePath)

    if ([string]::IsNullOrWhiteSpace($DatabasePath)) {
        throw "DataPath cannot be empty."
    }

    $expandedPath = [Environment]::ExpandEnvironmentVariables($DatabasePath)
    $fullPath = [System.IO.Path]::GetFullPath($expandedPath)
    $dataDirectory = Split-Path -Parent $fullPath
    if (-not [string]::IsNullOrWhiteSpace($dataDirectory)) {
        New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
    }

    return "Data Source=$fullPath"
}

function Test-SettingProperty {
    param(
        [object]$Settings,
        [string]$PropertyName
    )

    return $null -ne $Settings -and $null -ne $Settings.PSObject.Properties[$PropertyName]
}

function Get-ListenEndpoint {
    param([string]$Url)

    try {
        $uri = [System.Uri]$Url
    } catch {
        throw "ListenUrl '$Url' is not a valid absolute URL."
    }

    if (-not $uri.IsAbsoluteUri) {
        throw "ListenUrl '$Url' is not a valid absolute URL."
    }

    $probeHost = switch ($uri.Host.ToLowerInvariant()) {
        "0.0.0.0" { "127.0.0.1"; break }
        "localhost" { "127.0.0.1"; break }
        "+" { "127.0.0.1"; break }
        "*" { "127.0.0.1"; break }
        default { $uri.DnsSafeHost; break }
    }

    return [ordered]@{
        Host = $probeHost
        Port = $uri.Port
    }
}

function Test-TcpPortAvailable {
    param([int]$Port)

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return -not ($listeners | Where-Object { $_.Port -eq $Port })
}

function Get-PortUsageDescription {
    param([int]$Port)

    try {
        $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -eq $listener) {
            return $null
        }

        $processId = $listener.OwningProcess
        $processName = $null
        $commandLine = $null

        try {
            $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
        } catch {
        }

        try {
            $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop).CommandLine
        } catch {
        }

        $parts = @()
        if ($processName) {
            $parts += ("{0} (PID {1})" -f $processName, $processId)
        } elseif ($processId) {
            $parts += ("PID {0}" -f $processId)
        }

        if (-not [string]::IsNullOrWhiteSpace($commandLine)) {
            $parts += $commandLine
        }

        if ($parts.Count -gt 0) {
            return ($parts -join ", ")
        }
    } catch {
    }

    return $null
}

function Assert-TcpPortAvailable {
    param([int]$Port)

    if (Test-TcpPortAvailable -Port $Port) {
        return
    }

    $portUsage = Get-PortUsageDescription -Port $Port
    if (-not [string]::IsNullOrWhiteSpace($portUsage)) {
        throw "Web UI port $Port is already in use by $portUsage. Choose a different port or stop that process before installing Mobile LM Studio."
    }

    throw "Web UI port $Port is already in use. Choose a different port or stop the process using it before installing Mobile LM Studio."
}

function Ensure-WebFirewallRule {
    param([int]$Port)

    $ruleName = "Mobile LM Studio Web UI"

    try {
        Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
            Remove-NetFirewallRule -ErrorAction SilentlyContinue
    } catch {
    }

    try {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalPort $Port | Out-Null
    } catch {
        throw "Unable to create the Windows Firewall rule '$ruleName' for TCP port $Port. $($_.Exception.Message)"
    }
}

function Get-RecentStartupFailureMessage {
    param(
        [string]$ProcessName = "MobileLmStudio.exe",
        [int]$LookbackMinutes = 5
    )

    try {
        $events = Get-WinEvent -FilterHashtable @{
            LogName = 'Application'
            StartTime = (Get-Date).AddMinutes(-$LookbackMinutes)
        } -ErrorAction SilentlyContinue |
            Where-Object {
                ($_.ProviderName -eq '.NET Runtime' -or $_.ProviderName -eq 'Application Error') -and
                $_.Message -like ("*{0}*" -f $ProcessName)
            } |
            Select-Object -First 1

        if ($null -eq $events) {
            return $null
        }

        $match = [regex]::Match($events.Message, 'System\.[^\r\n]+')
        if ($match.Success) {
            return $match.Value.Trim()
        }

        $lines = $events.Message -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        if ($lines.Count -gt 0) {
            return $lines[0].Trim()
        }
    } catch {
    }

    return $null
}

function Wait-ForServicePort {
    param(
        [string]$ServiceName,
        [string]$ProbeHost,
        [int]$Port,
        [int]$TimeoutSeconds = 45,
        [string]$ProcessName = "MobileLmStudio.exe"
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (($null -eq $service) -or ($service.Status -eq [System.ServiceProcess.ServiceControllerStatus]::Stopped)) {
            $failureMessage = Get-RecentStartupFailureMessage -ProcessName $ProcessName
            if (-not [string]::IsNullOrWhiteSpace($failureMessage)) {
                throw "Service '$ServiceName' stopped during startup. Latest failure: $failureMessage"
            }

            throw "Service '$ServiceName' stopped during startup before opening port $Port."
        }

        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $async = $client.BeginConnect($ProbeHost, $Port, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(1000)) {
                $client.EndConnect($async)
                return
            }
        } catch {
        } finally {
            $client.Dispose()
        }

        Start-Sleep -Milliseconds 500
    }

    $failureMessage = Get-RecentStartupFailureMessage -ProcessName $ProcessName
    if (-not [string]::IsNullOrWhiteSpace($failureMessage)) {
        throw "Service '$ServiceName' did not open port $Port within $TimeoutSeconds seconds. Latest failure: $failureMessage"
    }

    throw "Service '$ServiceName' did not open port $Port within $TimeoutSeconds seconds. Check Windows Event Viewer for the underlying startup error."
}

function Write-AppSettings {
    param(
        [string]$TargetPath,
        [string]$Url,
        [string]$ApiToken,
        [string]$McpPath,
        [AllowNull()][hashtable]$PinPayload,
        [int]$Iterations,
        [string]$ListenAddress,
        [string]$ConnectionString
    )

    $settings = [ordered]@{
        LmStudio = [ordered]@{
            BaseUrl = $Url
            ApiToken = $ApiToken
            McpConfigPath = $McpPath
        }
        Security = [ordered]@{
            PinHash = if ($PinPayload) { $PinPayload.PinHash } else { "" }
            PinSalt = if ($PinPayload) { $PinPayload.PinSalt } else { "" }
            Iterations = $Iterations
        }
        Storage = [ordered]@{
            ConnectionString = $ConnectionString
        }
        Web = [ordered]@{
            Urls = @($ListenAddress)
        }
    }

    $json = $settings | ConvertTo-Json -Depth 5
    Set-Content -Path (Join-Path $TargetPath "appsettings.json") -Value $json -Encoding UTF8
}

function Get-RuntimeSettingsPath {
    $appDataPath = Join-Path $env:ProgramData "MobileLmStudio"
    New-Item -ItemType Directory -Path $appDataPath -Force | Out-Null
    return (Join-Path $appDataPath "appsettings.runtime.json")
}

function Write-RuntimeSettings {
    param(
        [string]$SettingsPath,
        [string]$Url,
        [string]$ApiToken,
        [string]$McpPath
    )

    $settings = [ordered]@{
        LmStudio = [ordered]@{
            BaseUrl = $Url
            ApiToken = $ApiToken
            McpConfigPath = $McpPath
        }
    }

    $json = $settings | ConvertTo-Json -Depth 3
    Set-Content -Path $SettingsPath -Value $json -Encoding UTF8
}

$resolvedInstallPath = [System.IO.Path]::GetFullPath($InstallPath)
$sourcePath = Resolve-SourcePath

if (-not [string]::IsNullOrWhiteSpace($SettingsPath)) {
    $resolvedSettingsPath = (Resolve-Path $SettingsPath).Path
    $settings = Get-Content -Path $resolvedSettingsPath -Raw | ConvertFrom-Json

    if (Test-SettingProperty -Settings $settings -PropertyName "ListenUrl") {
        $ListenUrl = [string]$settings.ListenUrl
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "LmStudioUrl") {
        $LmStudioUrl = [string]$settings.LmStudioUrl
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "LmStudioApiToken") {
        $LmStudioApiToken = [string]$settings.LmStudioApiToken
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "McpConfigPath") {
        $McpConfigPath = [string]$settings.McpConfigPath
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "DataPath") {
        $DataPath = [string]$settings.DataPath
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "Pin") {
        $Pin = [string]$settings.Pin
    }

    if (Test-SettingProperty -Settings $settings -PropertyName "PinIterations") {
        $PinIterations = [int]$settings.PinIterations
    }
}

if ($PromptForMissingValues.IsPresent -and [string]::IsNullOrWhiteSpace($Pin)) {
    $Pin = Read-SecretText "Enter the app PIN (leave blank to disable sign-in)"
}

if ($PromptForMissingValues.IsPresent -and [string]::IsNullOrWhiteSpace($LmStudioApiToken)) {
    $LmStudioApiToken = Read-SecretText "Enter the LM Studio API token"
}

if ($PromptForMissingValues.IsPresent -and [string]::IsNullOrWhiteSpace($McpConfigPath)) {
    $McpConfigPath = Read-Host -Prompt "Enter the path to LM Studio mcp.json"
}

if ($PromptForMissingValues.IsPresent -and [string]::IsNullOrWhiteSpace($DataPath)) {
    $DataPath = Read-Host -Prompt "Enter the full path for the Mobile LM Studio data file"
}

if (-not $SkipCopy.IsPresent) {
    New-Item -ItemType Directory -Path $resolvedInstallPath -Force | Out-Null
    Copy-Item -Path (Join-Path $sourcePath "*") -Destination $resolvedInstallPath -Recurse -Force
}

$listenEndpoint = Get-ListenEndpoint -Url $ListenUrl

$connectionString = Get-ConnectionString -DatabasePath $DataPath
$pinPayload = if ([string]::IsNullOrWhiteSpace($Pin)) {
    $null
} else {
    New-HashedPin -PlainTextPin $Pin -Iterations $PinIterations
}

Write-AppSettings -TargetPath $resolvedInstallPath -Url $LmStudioUrl -ApiToken $LmStudioApiToken -McpPath $McpConfigPath -PinPayload $pinPayload -Iterations $PinIterations -ListenAddress $ListenUrl -ConnectionString $connectionString
Write-RuntimeSettings -SettingsPath (Get-RuntimeSettingsPath) -Url $LmStudioUrl -ApiToken $LmStudioApiToken -McpPath $McpConfigPath

$serviceCommand = Resolve-ServiceCommand -BasePath $resolvedInstallPath
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($service) {
    if ($service.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        $service.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(15))
    }

    Assert-TcpPortAvailable -Port $listenEndpoint.Port

    & sc.exe config $ServiceName "start= auto" "binPath= $serviceCommand" | Out-Null
    & sc.exe description $ServiceName "Mobile-first web client for LM Studio." | Out-Null
} else {
    Assert-TcpPortAvailable -Port $listenEndpoint.Port

    New-Service -Name $ServiceName -BinaryPathName $serviceCommand -DisplayName "Mobile LM Studio" -Description "Mobile-first web client for LM Studio." -StartupType Automatic | Out-Null
}

& sc.exe failure $ServiceName "reset= 86400" "actions= restart/5000/restart/5000/restart/15000" | Out-Null
Ensure-WebFirewallRule -Port $listenEndpoint.Port
Start-Service -Name $ServiceName
Wait-ForServicePort -ServiceName $ServiceName -ProbeHost $listenEndpoint.Host -Port $listenEndpoint.Port -ProcessName "MobileLmStudio.exe"

if (-not [string]::IsNullOrWhiteSpace($resolvedFailurePath) -and (Test-Path $resolvedFailurePath)) {
    Remove-Item -Path $resolvedFailurePath -Force
}

Write-Host "Installed Mobile LM Studio as service '$ServiceName'."
Write-Host "Web URL: $ListenUrl"
Write-Host "Windows Firewall: opened TCP port $($listenEndpoint.Port)."
Write-Host "Install path: $resolvedInstallPath"
Write-Host "Data file: $DataPath"