const fs = require("node:fs");
const path = require("node:path");

function createLogger(logDirectory) {
  function write(level, message, error) {
    fs.mkdirSync(logDirectory, { recursive: true });
    const logFilePath = path.join(logDirectory, `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.log`);
    const parts = [new Date().toISOString(), `[${level}]`, "mobile-ai-chat:", message];
    if (error) {
      parts.push(error.stack || error.message || String(error));
    }

    fs.appendFileSync(logFilePath, `${parts.filter(Boolean).join(" ")}\n`, "utf8");
  }

  return {
    debug(message, error) {
      write("DEBUG", message, error);
    },
    info(message, error) {
      write("INFO", message, error);
    },
    warn(message, error) {
      write("WARN", message, error);
    },
    error(message, error) {
      write("ERROR", message, error);
    }
  };
}

module.exports = {
  createLogger
};