# Mobile LM Studio

Mobile LM Studio is a lightweight Node.js web client for LM Studio that is designed to run in Docker and be usable from a phone on the same network.

This repository now tracks the Node.js runtime, the static client, and Docker and local development workflows only.

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

- `src/node`: Node.js runtime, SQLite integration, and LM Studio proxy logic
- `src/MobileLmStudio/wwwroot`: static mobile-first client assets served by the Node.js runtime
- `src/MobileLmStudio/appsettings.json`: default application settings used by the Node.js runtime
- `Dockerfile`: container image definition
- `docker-compose.yml`: ready-to-run Compose configuration
- `docker-compose.example.yml`: commented Compose example template
- `scripts/dev-server.ps1`: local development entry point
- `reference/lm_studio_rest_api`: LM Studio API reference used to build the integration

## Docker

Docker is the recommended way to run Mobile LM Studio.

### Quick start

The repo ships a runnable default Compose file:

```sh
docker compose up -d
```

That builds the image, starts the container, and serves the UI on `http://localhost:5080`.
Chat data is stored in the `mobile-lm-studio-data` named volume so it survives container restarts and upgrades.

By default the container expects LM Studio on the host machine at `http://host.docker.internal:1234`.
Docker Desktop resolves that automatically on Windows and macOS.
On Linux, keep the included `extra_hosts` entry or set `LMSTUDIO_URL` to your host IP directly.

### Example docker-compose

The repo also includes a tracked example at `docker-compose.example.yml`:

```yaml
services:
  mobile-lm-studio:
    build:
      context: .
    ports:
      - "5080:5080"
    environment:
      LMSTUDIO_URL: http://host.docker.internal:1234
      # LMSTUDIO_API_TOKEN: your-token-here
      # LMSTUDIO_MCP_CONFIG_PATH: /data/mcp.json
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - mobile-lm-studio-data:/data
      # - ./mcp.json:/data/mcp.json:ro
    restart: unless-stopped

volumes:
  mobile-lm-studio-data:
```

You can run that file directly:

```sh
docker compose -f docker-compose.example.yml up -d
```

### Configuration via environment variables

All settings can be passed as environment variables in `docker-compose.yml`, `docker-compose.example.yml`, or with `-e` on the command line:

| Variable | Description | Default |
|---|---|---|
| `LMSTUDIO_URL` | LM Studio server URL | `http://127.0.0.1:1234` |
| `LMSTUDIO_API_TOKEN` | Bearer token for LM Studio requests | _(empty)_ |
| `LMSTUDIO_MCP_CONFIG_PATH` | Path to `mcp.json` inside the container | _(empty)_ |
| `WEB_PORT` | Port the server listens on | `5080` |
| `DATA_DIR` | Directory for the SQLite database, runtime settings, and logs | `/data` |

Example overriding the LM Studio host at launch time:

```sh
LMSTUDIO_URL=http://192.168.1.10:1234 docker compose up -d
```

### Mounting an MCP config

If you use LM Studio MCP tools, mount the config file into the container and point `LMSTUDIO_MCP_CONFIG_PATH` at it:

```yaml
volumes:
  - mobile-lm-studio-data:/data
  - ./mcp.json:/data/mcp.json:ro
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

If you want to run directly from source without Docker:

```powershell
./scripts/dev-server.ps1
```

That starts the Node.js server on `http://127.0.0.1:5081`, stores chat data in `artifacts/dev/mobile-lm-studio.db`, and isolates runtime settings under `artifacts/dev/programdata` so local iteration stays separate from the shared Docker data volume.

You can override the main development settings:

```powershell
./scripts/dev-server.ps1 -Port 5090 -LmStudioUrl http://127.0.0.1:1234 -McpConfigPath C:\path\to\mcp.json
```

You can enable, disable, or rotate the UI PIN later from the in-app Settings screen.

## Configuration

Settings are loaded in this order, from lowest to highest priority:

1. Built-in defaults in `src/node/config.js`
2. `appsettings.json`
3. Environment variables
4. `appsettings.runtime.json`
5. CLI arguments

Runtime changes made in the UI are written to `appsettings.runtime.json`, so saved settings override environment variables on later restarts.

`appsettings.json` keys:

- `LmStudio:BaseUrl`: LM Studio server URL
- `LmStudio:ApiToken`: bearer token used for LM Studio requests and plugin-based MCP access
- `LmStudio:McpConfigPath`: path to LM Studio `mcp.json`
- `Security:PinHash` and `Security:PinSalt`: PBKDF2-protected PIN values
- `Storage:ConnectionString`: SQLite connection string
- `Web:Urls`: URL binding for the server

In Docker the data directory defaults to `/data`.
When you use `scripts/dev-server.ps1`, the runtime settings and logs are redirected under `artifacts/dev/programdata`.

Logs are written to `{data-dir}/logs/YYYYMMDD.log`.