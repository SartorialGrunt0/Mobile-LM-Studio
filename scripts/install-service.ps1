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

            Write-Utf8NoBomFile -Path $resolvedFailurePath -Value $failureMessage
        } catch {
        }
    }

    throw
}

function Write-Utf8NoBomFile {
    param(
        [string]$Path,
        [string]$Value
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $utf8NoBom)
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
    $deriver = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($PlainTextPin, $saltBytes, $Iterations, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
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

    $nodePath = Join-Path $BasePath "node.exe"
    if (-not (Test-Path $nodePath)) {
        $nodeCommand = Get-Command node -ErrorAction Stop
        $nodePath = $nodeCommand.Source
    }

    $serverCandidates = @(
        (Join-Path $BasePath "src\node\server.js"),
        (Join-Path $BasePath "server.js")
    )

    $serverPath = $serverCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $serverPath) {
        throw "Could not find the Node.js server entry point in $BasePath. Expected src\node\server.js."
    }

    return ('"{0}" "{1}"' -f $nodePath, $serverPath)
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
        try {
            $processName = (Get-Process -Id $processId -ErrorAction Stop).ProcessName
        } catch {
        }

        if ($processName) {
            return ("{0} (PID {1})" -f $processName, $processId)
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

    $ruleName = "Mobile LM Studio Web UI ($Port)"
    $legacyRuleName = "Mobile LM Studio Web UI"

    try {
        foreach ($name in @($legacyRuleName, $ruleName) | Select-Object -Unique) {
            Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
                Remove-NetFirewallRule -ErrorAction SilentlyContinue
        }

        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Enabled True -Profile Any -Protocol TCP -LocalPort $Port | Out-Null
        return
    } catch {
        $netsh = Get-Command netsh.exe -ErrorAction SilentlyContinue
        if (-not $netsh) {
            throw "Unable to create the Windows Firewall rule '$ruleName' for TCP port $Port. $($_.Exception.Message)"
        }

        & $netsh.Source advfirewall firewall delete rule name="$legacyRuleName" protocol=TCP localport=$Port | Out-Null
        & $netsh.Source advfirewall firewall delete rule name="$ruleName" protocol=TCP localport=$Port | Out-Null
        & $netsh.Source advfirewall firewall add rule name="$ruleName" dir=in action=allow enable=yes profile=any protocol=TCP localport=$Port | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to create the Windows Firewall rule '$ruleName' for TCP port $Port. netsh exited with code $LASTEXITCODE."
        }
    }
}

function Get-LogDirectory {
    return (Join-Path (Join-Path $env:ProgramData "MobileLmStudio") "logs")
}

function Get-LatestLogMessage {
    param([string]$LogDirectory)

    try {
        $latestLog = Get-ChildItem -Path $LogDirectory -Filter *.log -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTimeUtc -Descending |
            Select-Object -First 1
        if ($null -eq $latestLog) {
            return $null
        }

        $tail = Get-Content -Path $latestLog.FullName -Tail 20 -ErrorAction SilentlyContinue
        if ($null -eq $tail) {
            return $null
        }

        return (($tail | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) | Select-Object -Last 1)
    } catch {
        return $null
    }
}

function Wait-ForServicePort {
    param(
        [string]$ServiceName,
        [string]$ProbeHost,
        [int]$Port,
        [int]$TimeoutSeconds = 45,
        [string]$LogDirectory
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (($null -eq $service) -or ($service.Status -eq [System.ServiceProcess.ServiceControllerStatus]::Stopped)) {
            $failureMessage = Get-LatestLogMessage -LogDirectory $LogDirectory
            if (-not [string]::IsNullOrWhiteSpace($failureMessage)) {
                throw "Service '$ServiceName' stopped during startup. Latest log entry: $failureMessage"
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

    $failureMessage = Get-LatestLogMessage -LogDirectory $LogDirectory
    if (-not [string]::IsNullOrWhiteSpace($failureMessage)) {
        throw "Service '$ServiceName' did not open port $Port within $TimeoutSeconds seconds. Latest log entry: $failureMessage"
    }

    throw "Service '$ServiceName' did not open port $Port within $TimeoutSeconds seconds. Check %PROGRAMDATA%\MobileLmStudio\logs for the underlying startup error."
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
    Write-Utf8NoBomFile -Path (Join-Path $TargetPath "appsettings.json") -Value $json
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
    Write-Utf8NoBomFile -Path $SettingsPath -Value $json
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
    & sc.exe description $ServiceName "Mobile-first web client for LM Studio (Node.js runtime)." | Out-Null
} else {
    Assert-TcpPortAvailable -Port $listenEndpoint.Port

    New-Service -Name $ServiceName -BinaryPathName $serviceCommand -DisplayName "Mobile LM Studio" -Description "Mobile-first web client for LM Studio (Node.js runtime)." -StartupType Automatic | Out-Null
}

& sc.exe failure $ServiceName "reset= 86400" "actions= restart/5000/restart/5000/restart/15000" | Out-Null
Ensure-WebFirewallRule -Port $listenEndpoint.Port
Start-Service -Name $ServiceName
Wait-ForServicePort -ServiceName $ServiceName -ProbeHost $listenEndpoint.Host -Port $listenEndpoint.Port -LogDirectory (Get-LogDirectory)

if (-not [string]::IsNullOrWhiteSpace($resolvedFailurePath) -and (Test-Path $resolvedFailurePath)) {
    Remove-Item -Path $resolvedFailurePath -Force
}

Write-Host "Installed Mobile LM Studio as service '$ServiceName'."
Write-Host "Runtime: Node.js"
Write-Host "Web URL: $ListenUrl"
Write-Host "Windows Firewall: ensured inbound TCP rule for port $($listenEndpoint.Port)."
Write-Host "Install path: $resolvedInstallPath"
Write-Host "Data file: $DataPath"