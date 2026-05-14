param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [switch]$SelfContained,
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $repoRoot "src\MobileLmStudio\MobileLmStudio.csproj"
$publishRoot = if ($OutputPath) { $OutputPath } else { Join-Path $repoRoot "artifacts\publish\$Runtime" }
$selfContainedValue = if ($SelfContained.IsPresent) { "true" } else { "false" }

Write-Host "Publishing Mobile LM Studio"
Write-Host "Project: $projectPath"
Write-Host "Runtime: $Runtime"
Write-Host "Output: $publishRoot"

$sdkList = & dotnet --list-sdks 2>$null
if (-not $sdkList) {
    throw "No .NET SDK was found. Install the .NET 9 SDK before publishing. The runtime alone is not enough to build this project."
}

New-Item -ItemType Directory -Path $publishRoot -Force | Out-Null

& dotnet publish $projectPath `
    -c $Configuration `
    -r $Runtime `
    --self-contained $selfContainedValue `
    /p:PublishSingleFile=true `
    /p:IncludeNativeLibrariesForSelfExtract=true `
    -o $publishRoot

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE."
}

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