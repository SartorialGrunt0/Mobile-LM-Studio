const fs = require("node:fs");
const path = require("node:path");

function saveSettings(settingsPath, settings, security) {
  const settingsDirectory = path.dirname(settingsPath);
  fs.mkdirSync(settingsDirectory, { recursive: true });

  const payload = {
    LmStudio: {
      BaseUrl: settings.baseUrl,
      ApiToken: settings.apiToken,
      McpConfigPath: settings.mcpConfigPath
    },
    Security: {
      PinHash: security.PinHash,
      PinSalt: security.PinSalt,
      Iterations: security.Iterations
    }
  };

  const tempPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, settingsPath);
}

module.exports = {
  saveSettings
};