# Mobile LM Studio

Mobile LM Studio is a lightweight Node.js web client for LM Studio that is designed to run as a Windows service and be usable from a phone on the same network.

## Features

- Mobile-first chat UI with a minimal layout
- Saved chat history in SQLite
- Model list, load, and unload controls
- Model temperature control alongside context and reasoning settings
- Streamed responses with live text rendering
- Expandable reasoning and tool call sections
- End-of-response stats including tokens per second and input context usage
- MCP server selection based on the configured `mcp.json`
- Cookie-protected PIN login for LAN use

## Project Layout

- `src/node`: Node.js backend runtime, SQLite integration, and LM Studio proxy logic
- `src/MobileLmStudio/wwwroot`: static mobile-first client assets served by the Node.js runtime
- `src/MobileLmStudio/appsettings.json`: default application settings used by the Node.js runtime
- `scripts/publish.ps1`: publish script for a portable Windows build that bundles `node.exe` and `node_modules`
- `scripts/install-service.ps1`: copies published files, writes config, and registers the Windows service
- `scripts/uninstall-service.ps1`: removes the Windows service
- `installer/MobileLmStudio.iss`: optional Inno Setup packaging script
- `reference/lm_studio_rest_api`: LM Studio API reference used to build the integration

## Build

You need Node.js installed to build or run the app from source.

Install dependencies once:

```powershell
npm install
```

```powershell
./scripts/publish.ps1 -SelfContained
```

That publishes the app to `artifacts/publish/win-x64`, including the Node.js server, static client assets, runtime `appsettings.json`, `node_modules`, and a portable `node.exe`. If Inno Setup is installed and `iscc` is on `PATH`, the same script also builds `artifacts/installer/MobileLmStudioSetup.exe`.

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

That starts the Node.js server directly from source on `http://127.0.0.1:5081` and stores chat data in `artifacts/dev/mobile-lm-studio.db` inside the repo. The script also isolates runtime settings under `artifacts/dev/programdata` so local iteration does not interfere with the installed Windows service on port `5080`.

You can override the main dev settings:

```powershell
./scripts/dev-server.ps1 -Port 5090 -LmStudioUrl http://127.0.0.1:1234 -McpConfigPath C:\path\to\mcp.json
```

This path does not require .NET; it runs the Node.js server directly.

When you run the setup executable, the install wizard lets you choose:

- The install folder
- The web UI port
- The SQLite data file location
- The LM Studio server address
- The LM Studio server API key
- The optional path to LM Studio `mcp.json`
- Whether sign-in is required, plus the PIN when enabled

After installation finishes, the final page shows a link to `http://localhost:{port}` using the port selected in the wizard.

You can also enable, disable, or rotate the UI PIN later from the in-app Settings screen.

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

Runtime changes made in the UI are also persisted to `%PROGRAMDATA%\MobileLmStudio\appsettings.runtime.json` so the service keeps the latest LM Studio base URL, API token, MCP config path, and PIN requirement across restarts.

Service diagnostics are written to `%PROGRAMDATA%\MobileLmStudio\logs\YYYYMMDD.log`.

## Migration Note

The runtime scripts and installer now target the Node.js backend in `src/node`. The older .NET host sources remain in the repo temporarily as migration reference, but `scripts/dev-server.ps1`, `scripts/publish.ps1`, and `scripts/install-service.ps1` all use the Node.js runtime path.

## Uninstall

```powershell
./scripts/uninstall-service.ps1 -RemoveInstallPath -RemoveData
```