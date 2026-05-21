const fs = require("node:fs");
const path = require("node:path");

function resolveSharedDataDirectory() {
  const programData = process.env.ProgramData || path.join(process.env.SystemDrive || "C:", "ProgramData");
  return path.join(programData, "MobileLmStudio");
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
  return {
    LmStudio: {
      BaseUrl: "http://127.0.0.1:1234",
      ApiToken: "",
      McpConfigPath: ""
    },
    Security: {
      PinHash: "",
      PinSalt: "",
      Iterations: 100000
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
  const normalized = String(connectionString || "").replaceAll("%PROGRAMDATA%", process.env.ProgramData || "C:\\ProgramData");
  const match = normalized.match(/^\s*Data Source\s*=\s*(.+?)\s*$/i);
  if (!match) {
    return normalized;
  }

  const rawPath = match[1].replace(/^"|"$/g, "");
  return `Data Source=${path.resolve(rawPath)}`;
}

function readConfig(options = {}) {
  const baseConfigPath = options.baseConfigPath || resolveDefaultConfigPath();
  const runtimeSettingsPath = options.runtimeSettingsPath || resolveRuntimeSettingsPath();

  const merged = deepMerge(
    deepMerge(getDefaultConfig(), loadJsonFile(baseConfigPath)),
    loadJsonFile(runtimeSettingsPath)
  );

  const withArgs = applyArgOverrides(merged, process.argv.slice(2));
  withArgs.Storage.ConnectionString = normalizeConnectionString(withArgs.Storage.ConnectionString);
  if (typeof withArgs.urls === "string" && withArgs.urls.trim()) {
    withArgs.Web = withArgs.Web || {};
    withArgs.Web.Urls = withArgs.urls.split(";").map(value => value.trim()).filter(Boolean);
  }

  return {
    config: withArgs,
    baseConfigPath,
    runtimeSettingsPath,
    logDirectory: resolveLogDirectory()
  };
}

module.exports = {
  applyArgOverrides,
  deepMerge,
  getDefaultConfig,
  normalizeConnectionString,
  readConfig,
  resolveDefaultConfigPath,
  resolveLogDirectory,
  resolveRuntimeSettingsPath,
  resolveSharedDataDirectory
};