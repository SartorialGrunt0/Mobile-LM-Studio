param(
    [string]$ServiceName = "MobileLmStudio",
    [string]$InstallPath = "$env:ProgramFiles\MobileLmStudio",
    [switch]$RemoveInstallPath,
    [switch]$RemoveData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
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