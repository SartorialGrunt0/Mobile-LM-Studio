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
      ChatFontScale: settings.chatFontScale,
      ChatDefaults: {
        ModelKey: settings.chatDefaults?.modelKey || "",
        SystemPrompt: settings.chatDefaults?.systemPrompt || "",
        Reasoning: settings.chatDefaults?.reasoning || "",
        ContextLength: settings.chatDefaults?.contextLength ?? null,
        Temperature: settings.chatDefaults?.temperature ?? null,
        TopK: settings.chatDefaults?.topK ?? null,
        TopP: settings.chatDefaults?.topP ?? null,
        MinP: settings.chatDefaults?.minP ?? null,
        RepeatPenalty: settings.chatDefaults?.repeatPenalty ?? null
      },
      AdaptiveMemory: {
        Enabled: settings.adaptiveMemory?.enabled === true,
        MaxWords: settings.adaptiveMemory?.maxWords ?? 500,
        Summary: settings.adaptiveMemory?.summary || "",
        LastUpdatedUtc: settings.adaptiveMemory?.lastUpdatedUtc || "",
        LastReviewedUtc: settings.adaptiveMemory?.lastReviewedUtc || "",
        SourceCursorUtc: settings.adaptiveMemory?.sourceCursorUtc || ""
      },
      Tts: {
        Provider: settings.tts?.provider || "browser",
        Voice: settings.tts?.voice || "af_heart"
      }
    }
  };

  const tempPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, settingsPath);
}

module.exports = {
  saveSettings
};