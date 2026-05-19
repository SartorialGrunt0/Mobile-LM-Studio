# Mobile LM Studio

Mobile LM Studio is a lightweight ASP.NET Core web client for LM Studio that is designed to run as a Windows service and be usable from a phone on the same network.

## Features

- Mobile-first chat UI with a minimal layout
- Saved chat history in SQLite
- Model list, load, and unload controls
- Streamed responses with live text rendering
- Expandable reasoning and tool call sections
- End-of-response stats including tokens per second and input context usage
- MCP server selection based on the configured `mcp.json`
- Cookie-protected PIN login for LAN use

## Project Layout

- `src/MobileLmStudio`: ASP.NET Core app and static client
- `scripts/publish.ps1`: publish script for a self-contained Windows build
- `scripts/install-service.ps1`: copies published files, writes config, and registers the service
- `scripts/uninstall-service.ps1`: removes the Windows service
- `installer/MobileLmStudio.iss`: optional Inno Setup packaging script
- `reference/lm_studio_rest_api`: LM Studio API reference used to build the integration

## Build

You need the .NET 9 SDK installed to build the app. The .NET runtime alone is not enough.

```powershell
./scripts/publish.ps1 -SelfContained
```

That publishes the app to `artifacts/publish/win-x64`. If Inno Setup is installed and `iscc` is on `PATH`, the same script also builds `artifacts/installer/MobileLmStudioSetup.exe`.

To build the installer executable directly, use:

```powershell
./scripts/build-installer.ps1
```

That script requires Inno Setup on `PATH`, publishes a self-contained Windows build, and produces `artifacts/installer/MobileLmStudioSetup.exe`.

## Run The UI Locally

If you just want to see the UI without installing the Windows service, run:

```powershell
./scripts/dev-server.ps1
```

That starts the app directly from source on `http://127.0.0.1:5081` and stores chat data in `artifacts/dev/mobile-lm-studio.db` inside the repo. The non-service default avoids colliding with the installed Windows service on port `5080`.

You can override the main dev settings:

```powershell
./scripts/dev-server.ps1 -Port 5090 -LmStudioUrl http://127.0.0.1:1234 -McpConfigPath C:\path\to\mcp.json
```

This path still requires the .NET 9 SDK because it uses `dotnet run`.

When you run the setup executable, the install wizard lets you choose:

- The install folder
- The web UI port
- The SQLite data file location
- The LM Studio server address
- The LM Studio server API key
- The optional path to LM Studio `mcp.json`
- Whether sign-in is required, plus the PIN when enabled

After installation finishes, the final page shows a link to `http://localhost:{port}` using the port selected in the wizard.

## Install As A Service

Publish the app first, then run:

```powershell
./scripts/install-service.ps1 -PublishPath .\artifacts\publish\win-x64 -PromptForMissingValues
```

The installer script prompts for:

- The app PIN, if you want sign-in enabled
- The LM Studio API token
- The path to LM Studio `mcp.json`
- The data file location

You can also pass all values directly without prompts, including `-ListenUrl`, `-LmStudioUrl`, `-LmStudioApiToken`, `-DataPath`, and a blank `-Pin` to disable sign-in.

By default the service listens on `http://0.0.0.0:5080` and stores chat data in `%PROGRAMDATA%\MobileLmStudio\mobile-lm-studio.db`.

## Configuration

The generated `appsettings.json` contains:

- `LmStudio:BaseUrl`: LM Studio server URL
- `LmStudio:ApiToken`: bearer token used for LM Studio requests and plugin-based MCP access
- `LmStudio:McpConfigPath`: path to LM Studio `mcp.json`
- `Security:PinHash` and `Security:PinSalt`: PBKDF2-protected PIN values
- `Web:Urls`: URL binding for the service

Runtime changes made in the UI are also persisted to `%PROGRAMDATA%\MobileLmStudio\appsettings.runtime.json` so the service keeps the latest LM Studio base URL, API token, and MCP config path across restarts.

Service diagnostics are written to `%PROGRAMDATA%\MobileLmStudio\logs\YYYYMMDD.log`.

## Uninstall

```powershell
./scripts/uninstall-service.ps1 -RemoveInstallPath -RemoveData
```