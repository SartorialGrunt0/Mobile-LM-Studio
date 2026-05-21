param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [switch]$SelfContained,
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Copy-Tree {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    if (-not (Test-Path $SourcePath)) {
        throw "Publish source path '$SourcePath' was not found."
    }

    New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
    Copy-Item -Path (Join-Path $SourcePath "*") -Destination $DestinationPath -Recurse -Force
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$publishRoot = if ($OutputPath) { [System.IO.Path]::GetFullPath($OutputPath) } else { Join-Path $repoRoot "artifacts\publish\$Runtime" }
$serverSource = Join-Path $repoRoot "src\node"
$staticSource = Join-Path $repoRoot "src\MobileLmStudio\wwwroot"
$appSettingsSource = Join-Path $repoRoot "src\MobileLmStudio\appsettings.json"
$nodeModulesPath = Join-Path $repoRoot "node_modules"
$packageJsonPath = Join-Path $repoRoot "package.json"
$packageLockPath = Join-Path $repoRoot "package-lock.json"
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $node) {
    throw "Node.js was not found on PATH. Install Node.js before publishing."
}

if (-not $npm) {
    throw "npm was not found on PATH. Install Node.js before publishing."
}

if (-not (Test-Path $packageJsonPath)) {
    throw "package.json was not found at $packageJsonPath."
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

if (Test-Path $publishRoot) {
    Remove-Item -Path $publishRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $publishRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $publishRoot "src\MobileLmStudio") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $publishRoot "scripts") -Force | Out-Null

Write-Host "Publishing Mobile LM Studio"
Write-Host "Runtime: Node.js"
Write-Host "Configuration: $Configuration (compatibility flag; ignored by the Node.js runtime)"
Write-Host "Target runtime: $Runtime"
Write-Host "Output: $publishRoot"
Write-Host "Portable runtime: copying $($node.Source)"

Copy-Tree -SourcePath $serverSource -DestinationPath (Join-Path $publishRoot "src\node")
Copy-Tree -SourcePath $staticSource -DestinationPath (Join-Path $publishRoot "src\MobileLmStudio\wwwroot")
Copy-Tree -SourcePath $nodeModulesPath -DestinationPath (Join-Path $publishRoot "node_modules")

Copy-Item -Path $appSettingsSource -Destination (Join-Path $publishRoot "appsettings.json") -Force
Copy-Item -Path $packageJsonPath -Destination (Join-Path $publishRoot "package.json") -Force

if (Test-Path $packageLockPath) {
    Copy-Item -Path $packageLockPath -Destination (Join-Path $publishRoot "package-lock.json") -Force
}

Copy-Item -Path $node.Source -Destination (Join-Path $publishRoot "node.exe") -Force
Copy-Item -Path (Join-Path $repoRoot "scripts\install-service.ps1") -Destination (Join-Path $publishRoot "scripts\install-service.ps1") -Force
Copy-Item -Path (Join-Path $repoRoot "scripts\uninstall-service.ps1") -Destination (Join-Path $publishRoot "scripts\uninstall-service.ps1") -Force

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if ($iscc) {
    $env:MLS_PUBLISH_DIR = $publishRoot
    & $iscc.Source (Join-Path $repoRoot "installer\MobileLmStudio.iss")

    if ($LASTEXITCODE -ne 0) {
        throw "Inno Setup compilation failed with exit code $LASTEXITCODE."
    }

    Write-Host "Installer built with Inno Setup."
} else {
    Write-Host "Inno Setup was not found. Published files are ready; run scripts\install-service.ps1 against the publish folder or install Inno Setup to build the installer."
}