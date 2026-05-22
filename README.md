# Mobile LM Studio

Mobile LM Studio is a lightweight Node.js web client for LM Studio that is designed to run as a Docker container (or Windows service) and be usable from a phone on the same network.

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
- `Dockerfile`: container image definition
- `docker-compose.yml`: compose configuration for running the container
- `scripts/publish.ps1`: publish script for a portable Windows build that bundles `node.exe` and `node_modules`
- `scripts/install-service.ps1`: copies published files, writes config, and registers the Windows service
- `scripts/uninstall-service.ps1`: removes the Windows service
- `reference/lm_studio_rest_api`: LM Studio API reference used to build the integration

## Docker

The recommended way to run Mobile LM Studio is with Docker.

### Quick start

```sh
docker compose up -d
```

That builds the image, starts the container, and serves the UI on `http://localhost:5080`.
Chat data is stored in the `mobile-lm-studio-data` named volume so it survives container restarts and upgrades.

By default the container expects LM Studio running on the host machine at `http://host.docker.internal:1234` (Docker Desktop on Windows/Mac resolves this automatically). If you are on Linux without Docker Desktop, use `--add-host=host.docker.internal:host-gateway` or set `LMSTUDIO_URL` to the host IP directly.

### Configuration via environment variables

All settings can be passed as environment variables in `docker-compose.yml` or with `-e` on the command line:

| Variable | Description | Default |
|---|---|---|
| `LMSTUDIO_URL` | LM Studio server URL | `http://127.0.0.1:1234` |
| `LMSTUDIO_API_TOKEN` | Bearer token for LM Studio requests | _(empty)_ |
| `LMSTUDIO_MCP_CONFIG_PATH` | Path to `mcp.json` inside the container | _(empty)_ |
| `WEB_PORT` | Port the server listens on | `5080` |
| `DATA_DIR` | Directory for the SQLite database, runtime settings, and logs | `/data` |

Example overriding a few values at `docker compose up` time:

```sh
LMSTUDIO_URL=http://192.168.1.10:1234 docker compose up -d
```

Or edit `docker-compose.yml` to set them permanently.

### Mounting an MCP config

If you use LM Studio MCP tools, mount the config file into the container and point `LMSTUDIO_MCP_CONFIG_PATH` at it:

```yaml
volumes:
  - mobile-lm-studio-data:/data
  - C:/Users/you/AppData/Roaming/LM Studio/mcp.json:/data/mcp.json:ro
environment:
  LMSTUDIO_MCP_CONFIG_PATH: /data/mcp.json
```

### Upgrading

```sh
docker compose build --pull
docker compose up -d
```

### Removing

```sh
docker compose down
```

To also delete the chat database and all stored data:

```sh
docker compose down -v
```

## Run The UI Locally

If you just want to see the UI without Docker, run:

```powershell
./scripts/dev-server.ps1
```

That starts the Node.js server directly from source on `http://127.0.0.1:5081` and stores chat data in `artifacts/dev/mobile-lm-studio.db` inside the repo. The script also isolates runtime settings under `artifacts/dev/programdata` so local iteration does not interfere with any installed service on port `5080`.

You can override the main dev settings:

```powershell
./scripts/dev-server.ps1 -Port 5090 -LmStudioUrl http://127.0.0.1:1234 -McpConfigPath C:\path\to\mcp.json
```

You can also enable, disable, or rotate the UI PIN later from the in-app Settings screen.

## Install As A Windows Service

If you prefer running without Docker, publish the app and install it as a Windows service:

```powershell
./scripts/publish.ps1 -SelfContained
./scripts/install-service.ps1 -PublishPath .\artifacts\publish\win-x64 -PromptForMissingValues
```

The installer script prompts for the app PIN, LM Studio API token, path to `mcp.json`, and data file location.
By default the service listens on `http://0.0.0.0:5080` and stores chat data in `%PROGRAMDATA%\MobileLmStudio\mobile-lm-studio.db`.

To remove the service:

```powershell
./scripts/uninstall-service.ps1 -RemoveInstallPath -RemoveData
```

## Configuration

Settings are read in priority order: environment variables override `appsettings.json`, which is merged with the runtime settings file.

`appsettings.json` keys (also configurable via env vars — see the Docker section):

- `LmStudio:BaseUrl`: LM Studio server URL
- `LmStudio:ApiToken`: bearer token used for LM Studio requests and plugin-based MCP access
- `LmStudio:McpConfigPath`: path to LM Studio `mcp.json`
- `Security:PinHash` and `Security:PinSalt`: PBKDF2-protected PIN values
- `Web:Urls`: URL binding for the server

Runtime changes made in the UI (LM Studio URL, API token, MCP config path, PIN) are also persisted to `appsettings.runtime.json` in the data directory so they survive restarts. In Docker the data directory is `/data` (the mounted volume). On Windows it is `%PROGRAMDATA%\MobileLmStudio`.

Logs are written to `{data-dir}/logs/YYYYMMDD.log`.

## Migration Note

The runtime scripts and installer now target the Node.js backend in `src/node`. The older .NET host sources remain in the repo temporarily as migration reference, but `scripts/dev-server.ps1`, `scripts/publish.ps1`, and `scripts/install-service.ps1` all use the Node.js runtime path.