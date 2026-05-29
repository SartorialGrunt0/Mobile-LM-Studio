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
$serverPath = Join-Path $repoRoot "src\node\server.js"
$nodeModulesPath = Join-Path $repoRoot "node_modules"
$packageLockPath = Join-Path $repoRoot "package-lock.json"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw "Node.js was not found on PATH. Install Node.js before starting the dev server."
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    throw "npm was not found on PATH. Install Node.js before starting the dev server."
}

if (-not (Test-Path $serverPath)) {
    throw "The Node.js server entry point was not found at $serverPath."
}

if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing Node.js dependencies..."
    Push-Location $repoRoot
    try {
        if (Test-Path $packageLockPath) {
            & $npm.Source ci --omit=dev
        } else {
            & $npm.Source install
        }

        if ($LASTEXITCODE -ne 0) {
            throw "npm dependency installation failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

if ([string]::IsNullOrWhiteSpace($DataPath)) {
    $DataPath = Join-Path $repoRoot "artifacts\dev\mobile-lm-studio.db"
}

$resolvedDataPath = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($DataPath))
$dataDirectory = Split-Path -Parent $resolvedDataPath
if (-not [string]::IsNullOrWhiteSpace($dataDirectory)) {
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
}

$programDataPath = Join-Path $repoRoot "artifacts\dev\programdata"
New-Item -ItemType Directory -Path $programDataPath -Force | Out-Null

$listenUrl = "http://127.0.0.1:$Port"
$connectionString = "Data Source=$resolvedDataPath"
$serverArguments = @(
    $serverPath,
    "--Web:Urls=$listenUrl",
    "--LmStudio:BaseUrl=$LmStudioUrl",
    "--LmStudio:ApiToken=$LmStudioApiToken",
    "--LmStudio:McpConfigPath=$McpConfigPath",
    "--Storage:ConnectionString=$connectionString",
    "--Security:PinHash=",
    "--Security:PinSalt="
)

Write-Host "Starting Mobile AI Chat from source"
Write-Host "Runtime: Node.js"
Write-Host "Configuration: $Configuration (compatibility flag; ignored by the Node.js runtime)"
Write-Host "Entry: $serverPath"
Write-Host "URL: $listenUrl"
Write-Host "Data file: $resolvedDataPath"
Write-Host "ProgramData override: $programDataPath"
Write-Host "LM Studio: $LmStudioUrl"

Push-Location $repoRoot
try {
    $env:ProgramData = $programDataPath
    & $node.Source @serverArguments
    if ($LASTEXITCODE -ne 0) {
        throw "The Node.js dev server exited with code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}