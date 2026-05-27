const fs = require("node:fs");
const path = require("node:path");

const { listProviderDefinitions, normalizeProviderId } = require("./provider-config");

function saveSettings(settingsPath, settings, security) {
  const settingsDirectory = path.dirname(settingsPath);
  fs.mkdirSync(settingsDirectory, { recursive: true });

  const rawProviders = settings.providers && typeof settings.providers === "object"
    ? settings.providers
    : {};

  const lmStudioSettings = rawProviders.lmstudio && typeof rawProviders.lmstudio === "object"
    ? rawProviders.lmstudio
    : {};
  let lmStudioMcpConfigPath = lmStudioSettings.mcpConfigPath || settings.mcpConfigPath || "";
  const lmStudioMcpUpload = lmStudioSettings.mcpConfigUpload || settings.mcpConfigUpload;
  if (lmStudioMcpUpload?.content) {
    const uploadedMcpConfigPath = path.join(settingsDirectory, "mcp.uploaded.json");
    fs.writeFileSync(uploadedMcpConfigPath, lmStudioMcpUpload.content, "utf8");
    lmStudioMcpConfigPath = uploadedMcpConfigPath;
  }

  const providerProfiles = {};
  for (const definition of listProviderDefinitions()) {
    const profile = rawProviders[definition.id] && typeof rawProviders[definition.id] === "object"
      ? rawProviders[definition.id]
      : {};

    providerProfiles[definition.id] = {
      BaseUrl: String(profile.baseUrl || "").trim(),
      ApiToken: String(profile.apiToken || "").trim(),
      McpConfigPath: definition.supportsMcp
        ? (definition.id === "lmstudio" ? lmStudioMcpConfigPath : String(profile.mcpConfigPath || "").trim())
        : ""
    };
  }

  const activeProvider = normalizeProviderId(settings.activeProvider);
  const rawChatDefaultsByProvider = settings.chatDefaultsByProvider && typeof settings.chatDefaultsByProvider === "object"
    ? settings.chatDefaultsByProvider
    : {};
  const chatDefaultsByProvider = {};
  for (const definition of listProviderDefinitions()) {
    const defaults = rawChatDefaultsByProvider[definition.id] && typeof rawChatDefaultsByProvider[definition.id] === "object"
      ? rawChatDefaultsByProvider[definition.id]
      : definition.id === activeProvider
        ? settings.chatDefaults
        : null;
    chatDefaultsByProvider[definition.id] = mapChatDefaults(defaults);
  }

  const payload = {
    LmStudio: {
      ...providerProfiles.lmstudio
    },
    Providers: {
      ActiveProvider: activeProvider,
      Profiles: providerProfiles
    },
    Security: {
      PinHash: security.PinHash,
      PinSalt: security.PinSalt,
      Iterations: security.Iterations
    },
    Ui: {
      ChatFontScale: settings.chatFontScale,
      ChatDefaults: mapChatDefaults(settings.chatDefaults),
      ChatDefaultsByProvider: chatDefaultsByProvider,
      AdaptiveMemory: {
        Enabled: settings.adaptiveMemory?.enabled === true,
        MaxWords: settings.adaptiveMemory?.maxWords ?? 500,
        Summary: settings.adaptiveMemory?.summary || "",
        LastUpdatedUtc: settings.adaptiveMemory?.lastUpdatedUtc || "",
        LastReviewedUtc: settings.adaptiveMemory?.lastReviewedUtc || "",
        SourceCursorUtc: settings.adaptiveMemory?.sourceCursorUtc || ""
      }
    }
  };

  const tempPath = `${settingsPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tempPath, settingsPath);
}

function mapChatDefaults(chatDefaults) {
  return {
    ModelKey: chatDefaults?.modelKey || "",
    SystemPrompt: chatDefaults?.systemPrompt || "",
    Reasoning: chatDefaults?.reasoning || "",
    ContextLength: chatDefaults?.contextLength ?? null,
    Temperature: chatDefaults?.temperature ?? null,
    TopK: chatDefaults?.topK ?? null,
    TopP: chatDefaults?.topP ?? null,
    MinP: chatDefaults?.minP ?? null,
    RepeatPenalty: chatDefaults?.repeatPenalty ?? null
  };
}

module.exports = {
  saveSettings
};