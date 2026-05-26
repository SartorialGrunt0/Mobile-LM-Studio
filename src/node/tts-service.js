const fs = require("node:fs");
const path = require("node:path");

const SUPPORTED_TTS_PROVIDERS = ["browser", "kokoro"];
const DEFAULT_TTS_PROVIDER = "browser";
const DEFAULT_TTS_VOICE = "af_heart";
const DEFAULT_KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const DEFAULT_KOKORO_DTYPE = "q8";
const DEFAULT_KOKORO_DEVICE = "cpu";
const SUPPORTED_KOKORO_DTYPES = ["auto", "fp32", "fp16", "q8", "q4", "q4f16"];
const SUPPORTED_KOKORO_DEVICES = ["auto", "gpu", "cpu", "cuda", "dml"];

let kokoroRuntime = null;
let kokoroRuntimeError = null;

function normalizeTtsProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "kokoro" ? "kokoro" : DEFAULT_TTS_PROVIDER;
}

function normalizeTtsVoice(value) {
  const trimmed = String(value || "").trim();
  return trimmed || DEFAULT_TTS_VOICE;
}

function normalizeKokoroDtype(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SUPPORTED_KOKORO_DTYPES.includes(normalized) ? normalized : DEFAULT_KOKORO_DTYPE;
}

function normalizeKokoroDevice(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "directml") {
    return "dml";
  }

  return SUPPORTED_KOKORO_DEVICES.includes(normalized) ? normalized : DEFAULT_KOKORO_DEVICE;
}

function directoryHasFiles(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return false;
  }

  try {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (entry.isFile()) {
        return true;
      }

      if (entry.isDirectory() && directoryHasFiles(path.join(targetPath, entry.name))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function normalizeProgress(progress) {
  if (!progress || typeof progress !== "object") {
    return null;
  }

  const next = {};
  for (const key of ["status", "name", "file", "progress", "loaded", "total"]) {
    if (Object.prototype.hasOwnProperty.call(progress, key)) {
      next[key] = progress[key];
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function loadKokoroRuntime() {
  if (kokoroRuntime) {
    return kokoroRuntime;
  }

  if (kokoroRuntimeError) {
    throw kokoroRuntimeError;
  }

  try {
    const { KokoroTTS } = require("kokoro-js");
    const { env: transformersEnv } = require("@huggingface/transformers");
    kokoroRuntime = {
      KokoroTTS,
      transformersEnv
    };
    return kokoroRuntime;
  } catch (error) {
    kokoroRuntimeError = new Error(`Unable to load the Kokoro runtime: ${error.message}`);
    kokoroRuntimeError.cause = error;
    throw kokoroRuntimeError;
  }
}

function buildVoiceResponse(voices) {
  return Object.entries(voices || {}).map(([id, metadata]) => ({
    id,
    name: metadata?.name || id,
    language: metadata?.language || "",
    gender: metadata?.gender || "",
    traits: metadata?.traits || "",
    targetQuality: metadata?.targetQuality || "",
    overallGrade: metadata?.overallGrade || ""
  }));
}

class TtsService {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.cacheDir = options.cacheDir || path.join(process.cwd(), ".cache", "kokoro");
    this.modelId = options.modelId || DEFAULT_KOKORO_MODEL_ID;
    this.dtype = normalizeKokoroDtype(options.dtype);
    this.requestedDevice = normalizeKokoroDevice(options.device);
    this.activeDevice = this.requestedDevice;
    this.kokoro = null;
    this.kokoroLoadPromise = null;
    this.lastError = null;
    this.lastProgress = null;
    this.warning = "";
  }

  getStatus() {
    let runtimeError = null;

    try {
      loadKokoroRuntime();
    } catch (error) {
      runtimeError = error;
    }

    return {
      supported: runtimeError === null,
      installed: directoryHasFiles(this.cacheDir),
      ready: Boolean(this.kokoro),
      installing: Boolean(this.kokoroLoadPromise),
      modelId: this.modelId,
      cacheDir: this.cacheDir,
      requestedDevice: this.requestedDevice,
      activeDevice: this.activeDevice,
      dtype: this.dtype,
      voiceCount: this.kokoro ? Object.keys(this.kokoro.voices || {}).length : 0,
      progress: this.lastProgress,
      warning: this.warning,
      error: runtimeError?.message || this.lastError?.message || ""
    };
  }

  async install() {
    await this.ensureReady();
    return this.getStatus();
  }

  async listVoices() {
    if (!this.kokoro && !directoryHasFiles(this.cacheDir)) {
      return [];
    }

    const kokoro = await this.ensureReady();
    return buildVoiceResponse(kokoro.voices);
  }

  async synthesize(text, options = {}) {
    const trimmedText = String(text || "").trim();
    if (!trimmedText) {
      throw new Error("Text is required.");
    }

    const kokoro = await this.ensureReady();
    return kokoro.generate(trimmedText, {
      voice: normalizeTtsVoice(options.voice)
    });
  }

  async ensureReady() {
    if (this.kokoro) {
      return this.kokoro;
    }

    if (this.kokoroLoadPromise) {
      return this.kokoroLoadPromise;
    }

    this.kokoroLoadPromise = this.loadKokoro();

    try {
      const kokoro = await this.kokoroLoadPromise;
      this.kokoro = kokoro;
      this.lastError = null;
      return kokoro;
    } catch (error) {
      this.lastError = error;
      throw error;
    } finally {
      this.kokoroLoadPromise = null;
      this.lastProgress = null;
    }
  }

  async loadKokoro() {
    const { KokoroTTS, transformersEnv } = loadKokoroRuntime();

    fs.mkdirSync(this.cacheDir, { recursive: true });
    transformersEnv.cacheDir = this.cacheDir;
    transformersEnv.useFS = true;
    transformersEnv.useFSCache = true;
    transformersEnv.useBrowserCache = false;
    transformersEnv.allowLocalModels = true;
    transformersEnv.allowRemoteModels = true;

    try {
      const kokoro = await this.loadKokoroOnDevice(KokoroTTS, this.requestedDevice);
      this.activeDevice = this.requestedDevice;
      this.warning = "";
      return kokoro;
    } catch (error) {
      if (this.requestedDevice === DEFAULT_KOKORO_DEVICE) {
        this.activeDevice = DEFAULT_KOKORO_DEVICE;
        this.warning = "";
        throw error;
      }

      this.logger.warn(`Unable to load Kokoro using ${this.requestedDevice}. Falling back to ${DEFAULT_KOKORO_DEVICE}.`, error);
      const kokoro = await this.loadKokoroOnDevice(KokoroTTS, DEFAULT_KOKORO_DEVICE);
      this.activeDevice = DEFAULT_KOKORO_DEVICE;
      this.warning = `Requested ${this.requestedDevice}, but the runtime fell back to ${DEFAULT_KOKORO_DEVICE}.`;
      return kokoro;
    }
  }

  async loadKokoroOnDevice(KokoroTTS, device) {
    this.logger.info(`Loading Kokoro TTS from ${this.modelId} using ${device} (${this.dtype}).`);
    return KokoroTTS.from_pretrained(this.modelId, {
      dtype: this.dtype,
      device,
      progress_callback: progress => {
        this.lastProgress = normalizeProgress(progress);
      }
    });
  }
}

module.exports = {
  DEFAULT_KOKORO_DEVICE,
  DEFAULT_KOKORO_DTYPE,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_TTS_VOICE,
  SUPPORTED_TTS_PROVIDERS,
  TtsService,
  normalizeKokoroDevice,
  normalizeKokoroDtype,
  normalizeTtsProvider,
  normalizeTtsVoice
};