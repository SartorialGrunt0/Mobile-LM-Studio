param(
    [string]$Configuration = "Debug",
    [int]$Port = 5081,
    [string]$LmStudioUrl = "http://127.0.0.1:1234",
    [string]$LmStudioApiToken = "",
    [string]$McpConfigPath = "",
    [string]$DataPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Port -lt 1 -or $Port -gt 65535) {
    throw "Port must be between 1 and 65535."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repoRoot "src\MobileLmStudio\MobileLmStudio.csproj"

$sdkList = & dotnet --list-sdks 2>$null
if (-not $sdkList) {
    throw "No .NET SDK was found. Install the .NET 9 SDK before starting the dev server."
}

if ([string]::IsNullOrWhiteSpace($DataPath)) {
    $DataPath = Join-Path $repoRoot "artifacts\dev\mobile-lm-studio.db"
}

$resolvedDataPath = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($DataPath))
$dataDirectory = Split-Path -Parent $resolvedDataPath
if (-not [string]::IsNullOrWhiteSpace($dataDirectory)) {
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
}

$listenUrl = "http://127.0.0.1:$Port"
$connectionString = "Data Source=$resolvedDataPath"

Write-Host "Starting Mobile LM Studio from source"
Write-Host "Project: $projectPath"
Write-Host "URL: $listenUrl"
Write-Host "Data file: $resolvedDataPath"
Write-Host "LM Studio: $LmStudioUrl"

& dotnet run `
    --project $projectPath `
    --configuration $Configuration `
    --no-launch-profile `
    -- `
    "--Web:Urls:0=$listenUrl" `
    "--Storage:ConnectionString=$connectionString" `
    "--LmStudio:BaseUrl=$LmStudioUrl" `
    "--LmStudio:ApiToken=$LmStudioApiToken" `
    "--LmStudio:McpConfigPath=$McpConfigPath" `
    "--Security:PinHash=" `
    "--Security:PinSalt="