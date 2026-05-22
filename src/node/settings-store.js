const fs = require("node:fs");
const path = require("node:path");

function saveSettings(settingsPath, settings, security) {
  const settingsDirectory = path.dirname(settingsPath);
  fs.mkdirSync(settingsDirectory, { recursive: true });

  let mcpConfigPath = settings.mcpConfigPath;
  if (settings.mcpConfigUpload?.content) {
    const uploadedMcpConfigPath = path.join(settingsDirectory, "mcp.uploaded.json");
    fs.writeFileSync(uploadedMcpConfigPath, settings.mcpConfigUpload.content, "utf8");
    mcpConfigPath = uploadedMcpConfigPath;
  }

  const payload = {
    LmStudio: {
      BaseUrl: settings.baseUrl,
      ApiToken: settings.apiToken,
      McpConfigPath: mcpConfigPath
    },
    Security: {
      PinHash: security.PinHash,
      PinSalt: security.PinSalt,
      Iterations: security.Iterations
    },
    Ui: {
      ChatFontScale: settings.chatFontScale
    }
  };

  const tempPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, settingsPath);
}

module.exports = {
  saveSettings
};