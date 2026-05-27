const fs = require("node:fs");
const path = require("node:path");

const { getDefaultChatDefaultsByProvider, getDefaultProviderProfiles, normalizeProviderConfiguration } = require("./provider-config");

function resolveSharedDataDirectory() {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }

  const programData = process.env.ProgramData;
  if (!programData && process.platform !== "win32") {
    return "/data";
  }

  return path.join(programData || path.join(process.env.SystemDrive || "C:", "ProgramData"), "MobileLmStudio");
}

function resolveRuntimeSettingsPath() {
  return path.join(resolveSharedDataDirectory(), "appsettings.runtime.json");
}

function resolveLogDirectory() {
  return path.join(resolveSharedDataDirectory(), "logs");
}

function resolveDefaultConfigPath() {
  const candidates = [
    path.join(__dirname, "..", "..", "appsettings.json"),
    path.join(__dirname, "..", "MobileLmStudio", "appsettings.json")
  ];

  return candidates.find(candidate => fs.existsSync(candidate)) || candidates[0];
}

function getDefaultConfig() {
  const defaultProviderProfiles = getDefaultProviderProfiles();
  const defaultChatDefaultsByProvider = getDefaultChatDefaultsByProvider();

  return {
    LmStudio: {
      ...defaultProviderProfiles.lmstudio
    },
    Providers: {
      ActiveProvider: "lmstudio",
      Profiles: defaultProviderProfiles
    },
    Security: {
      PinHash: "",
      PinSalt: "",
      Iterations: 600000
    },
    Ui: {
      ChatFontScale: 1,
      ChatDefaults: {
        ModelKey: "",
        SystemPrompt: "",
        Reasoning: "",
        ContextLength: null,
        Temperature: null,
        TopK: null,
        TopP: null,
        MinP: null,
        RepeatPenalty: null
      },
      ChatDefaultsByProvider: defaultChatDefaultsByProvider,
      AdaptiveMemory: {
        Enabled: false,
        MaxWords: 500,
        Summary: "",
        LastUpdatedUtc: "",
        LastReviewedUtc: "",
        SourceCursorUtc: ""
      }
    },
    Storage: {
      ConnectionString: "Data Source=%PROGRAMDATA%\\MobileLmStudio\\mobile-lm-studio.db"
    },
    Web: {
      Urls: ["http://0.0.0.0:5080"]
    }
  };
}

function loadJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Unable to read config file ${filePath}: ${error.message}`);
  }
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return override === undefined ? base : override;
  }

  const output = Array.isArray(base) ? [...base] : { ...(base || {}) };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = deepMerge(output[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function applyArgOverrides(config, args) {
  const nextConfig = deepMerge({}, config);

  for (const rawArg of args) {
    if (!rawArg.startsWith("--")) {
      continue;
    }

    const withoutPrefix = rawArg.slice(2);
    const separatorIndex = withoutPrefix.indexOf("=");
    const key = separatorIndex >= 0 ? withoutPrefix.slice(0, separatorIndex) : withoutPrefix;
    const rawValue = separatorIndex >= 0 ? withoutPrefix.slice(separatorIndex + 1) : "true";
    assignNestedValue(nextConfig, key, rawValue);
  }

  return nextConfig;
}

function assignNestedValue(target, dottedKey, rawValue) {
  const segments = dottedKey.split(":").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!cursor[segment] || typeof cursor[segment] !== "object" || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }

  const leafKey = segments[segments.length - 1];
  if (leafKey === "Urls") {
    cursor[leafKey] = rawValue.split(";").map(value => value.trim()).filter(Boolean);
    return;
  }

  cursor[leafKey] = rawValue;
}

function normalizeConnectionString(connectionString) {
  const dataDir = resolveSharedDataDirectory();
  const programData = process.env.ProgramData || path.join(process.env.SystemDrive || "C:", "ProgramData");
  const normalized = String(connectionString || "")
    .replaceAll("%PROGRAMDATA%\\MobileLmStudio", dataDir)
    .replaceAll("%PROGRAMDATA%/MobileLmStudio", dataDir)
    .replaceAll("%PROGRAMDATA%", programData);
  const match = normalized.match(/^\s*Data Source\s*=\s*(.+?)\s*$/i);
  if (!match) {
    return normalized;
  }

  const rawPath = match[1].replace(/^"|"$/g, "");
  const platformPath = process.platform === "win32"
    ? rawPath.replaceAll("/", path.sep)
    : rawPath.replaceAll("\\", path.sep);
  return `Data Source=${path.resolve(platformPath)}`;
}

function applyEnvOverrides(config) {
  const next = deepMerge({}, config);

  if (process.env.LMSTUDIO_URL) {
    next.LmStudio = next.LmStudio || {};
    next.LmStudio.BaseUrl = process.env.LMSTUDIO_URL;
  }

  if (process.env.LMSTUDIO_API_TOKEN !== undefined && process.env.LMSTUDIO_API_TOKEN !== "") {
    next.LmStudio = next.LmStudio || {};
    next.LmStudio.ApiToken = process.env.LMSTUDIO_API_TOKEN;
  }

  if (process.env.LMSTUDIO_MCP_CONFIG_PATH) {
    next.LmStudio = next.LmStudio || {};
    next.LmStudio.McpConfigPath = process.env.LMSTUDIO_MCP_CONFIG_PATH;
  }

  if (process.env.WEB_PORT) {
    next.Web = next.Web || {};
    next.Web.Urls = [`http://0.0.0.0:${process.env.WEB_PORT}`];
  }

  return next;
}

function readConfig(options = {}) {
  const baseConfigPath = options.baseConfigPath || resolveDefaultConfigPath();
  const runtimeSettingsPath = options.runtimeSettingsPath || resolveRuntimeSettingsPath();

  // Priority (lowest to highest): defaults → appsettings.json → env vars → runtime settings file → CLI args.
  // Env vars seed initial values but are overridden by anything the user saves via the UI.
  const withEnv = applyEnvOverrides(
    deepMerge(getDefaultConfig(), loadJsonFile(baseConfigPath))
  );

  const merged = deepMerge(withEnv, loadJsonFile(runtimeSettingsPath));
  const withArgs = applyArgOverrides(merged, process.argv.slice(2));
  const normalizedConfig = normalizeProviderConfiguration(withArgs);
  normalizedConfig.Storage.ConnectionString = normalizeConnectionString(normalizedConfig.Storage.ConnectionString);
  if (typeof normalizedConfig.urls === "string" && normalizedConfig.urls.trim()) {
    normalizedConfig.Web = normalizedConfig.Web || {};
    normalizedConfig.Web.Urls = normalizedConfig.urls.split(";").map(value => value.trim()).filter(Boolean);
  }

  return {
    config: normalizedConfig,
    baseConfigPath,
    runtimeSettingsPath,
    logDirectory: resolveLogDirectory()
  };
}

module.exports = {
  applyArgOverrides,
  applyEnvOverrides,
  deepMerge,
  getDefaultConfig,
  normalizeConnectionString,
  readConfig,
  resolveDefaultConfigPath,
  resolveLogDirectory,
  resolveRuntimeSettingsPath,
  resolveSharedDataDirectory
};