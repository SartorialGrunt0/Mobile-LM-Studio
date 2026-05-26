const fs = require("node:fs/promises");
const path = require("node:path");

async function getServers(mcpConfigPath) {
  if (!mcpConfigPath || !String(mcpConfigPath).trim()) {
    return [];
  }

  const resolvedPath = path.resolve(expandEnvironmentVariables(String(mcpConfigPath).trim()));

  try {
    const payload = await fs.readFile(resolvedPath, "utf8");
    return parseServers(JSON.parse(payload));
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return [];
    }

    throw error;
  }
}

function expandEnvironmentVariables(value) {
  return value.replace(/%([^%]+)%/g, (_match, key) => process.env[key] || "");
}

function parseServers(root) {
  const servers = [];

  if (tryReadServerObject(root, "mcpServers", servers) || tryReadServerObject(root, "servers", servers)) {
    return servers;
  }

  if (root && typeof root === "object" && !Array.isArray(root)) {
    for (const [id, value] of Object.entries(root)) {
      if (value && typeof value === "object" && looksLikeServerDefinition(value)) {
        const label = readString(value, "label") || readString(value, "name") || id;
        servers.push(createServer(id, label, value));
      }
    }
  }

  return servers;
}

function tryReadServerObject(root, propertyName, servers) {
  const property = root?.[propertyName];
  if (!property) {
    return false;
  }

  if (Array.isArray(property)) {
    for (const item of property) {
      const id = readString(item, "id") || readString(item, "name") || readString(item, "label");
      const label = readString(item, "label") || readString(item, "name") || id;
      if (id) {
        servers.push(createServer(id, label || id, item));
      }
    }
    return true;
  }

  if (property && typeof property === "object") {
    for (const [id, value] of Object.entries(property)) {
      const label = readString(value, "label") || readString(value, "name") || id;
      servers.push(createServer(id, label, value));
    }
    return true;
  }

  return false;
}

function looksLikeServerDefinition(value) {
  return Boolean(value?.command || value?.url || value?.transport);
}

function createServer(id, label, value) {
  let transport = readString(value, "transport");
  if (!transport) {
    transport = value?.url ? "url" : value?.command ? "stdio" : null;
  }

  return {
    id,
    label,
    description: readString(value, "description") || readString(value, "url") || readString(value, "command") || null,
    transport
  };
}

function readString(value, key) {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : null;
}

module.exports = {
  getServers
};