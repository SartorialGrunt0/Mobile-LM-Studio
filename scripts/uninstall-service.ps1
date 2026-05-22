param(
    [string]$ServiceName = "MobileLmStudio",
    [string]$InstallPath = "$env:ProgramFiles\MobileLmStudio",
    [switch]$RemoveInstallPath,
    [switch]$RemoveData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$firewallRuleName = "Mobile LM Studio Web UI"

function Resolve-NssmPath {
    param([string]$BasePath)

    $localNssm = Join-Path $BasePath "nssm.exe"
    if (Test-Path $localNssm) {
        return $localNssm
    }

    $pathNssm = Get-Command nssm -ErrorAction SilentlyContinue
    if ($pathNssm) {
        return $pathNssm.Source
    }

    return $null
}

try {
    Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue

    $portPattern = "Mobile LM Studio Web UI (*)"
    Get-NetFirewallRule -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like $portPattern } |
        Remove-NetFirewallRule -ErrorAction SilentlyContinue

    Write-Host "Removed Windows Firewall rule(s)."
} catch {
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    $nssmPath = Resolve-NssmPath -BasePath $InstallPath
    if ($nssmPath) {
        & $nssmPath stop $ServiceName 2>$null | Out-Null
        & $nssmPath remove $ServiceName confirm 2>$null | Out-Null
    } else {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        & sc.exe delete $ServiceName | Out-Null
    }
    Write-Host "Removed Windows service '$ServiceName'."
} else {
    Write-Host "Windows service '$ServiceName' was not installed."
}

if ($RemoveInstallPath.IsPresent -and (Test-Path $InstallPath)) {
    Remove-Item -Path $InstallPath -Recurse -Force
    Write-Host "Removed install path $InstallPath."
}

if ($RemoveData.IsPresent) {
    $dataPath = Join-Path $env:ProgramData "MobileLmStudio"
    if (Test-Path $dataPath) {
        Remove-Item -Path $dataPath -Recurse -Force
        Write-Host "Removed application data at $dataPath."
    }
}