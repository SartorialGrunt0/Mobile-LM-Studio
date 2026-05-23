class LmStudioClient {
  constructor(getConnectionSettings) {
    this.getConnectionSettings = getConnectionSettings;
  }

  async getModels() {
    const response = await this.send("GET", "/api/v1/models");
    const payload = await response.json().catch(() => ({ models: [] }));
    const models = Array.isArray(payload.models) ? payload.models.map(mapModel) : [];
    return { models };
  }

  async loadModel(requestModel) {
    const response = await this.send("POST", "/api/v1/models/load", {
      model: requestModel.model,
      context_length: requestModel.contextLength,
      flash_attention: requestModel.flashAttention,
      echo_load_config: true
    });

    const payload = await response.json();
    return {
      type: payload.type,
      instanceId: payload.instance_id,
      loadTimeSeconds: payload.load_time_seconds,
      status: payload.status,
      loadConfig: payload.load_config ? mapLoadConfig(payload.load_config) : null
    };
  }

  async unloadModel(requestModel) {
    const response = await this.send("POST", "/api/v1/models/unload", {
      instance_id: requestModel.instanceId
    });

    const payload = await response.json();
    return {
      instanceId: payload.instance_id
    };
  }

  async startChatStream(chatRequest, signal) {
    return this.send("POST", "/api/v1/chat", chatRequest, {
      acceptEventStream: true,
      signal,
      allowFailure: true
    });
  }

  async generateTitle(model, input) {
    const prompt = String(input || "").slice(0, 500);
    const response = await this.send("POST", "/api/v1/chat", {
      model,
      input: prompt,
      system_prompt: "Generate a short chat title (5 words max). Respond with only the title, no quotes or extra text.",
      stream: false,
      store: false
    }, {
      allowFailure: true
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    const output = Array.isArray(payload?.output) ? payload.output : [];
    const item = output.find(candidate => candidate?.type === "message" && candidate?.content);
    if (!item?.content) {
      return null;
    }

    const title = String(item.content).trim().replace(/^['"]|['"]$/g, "");
    return title.length > 60 ? `${title.slice(0, 57)}...` : title;
  }

  async readError(response) {
    const content = await response.text();
    if (!content.trim()) {
      return `LM Studio returned ${response.status} ${response.statusText}.`;
    }

    try {
      const payload = JSON.parse(content);
      const value = payload.detail || payload.error || payload.message || payload.title || content;
      return typeof value === "string" ? value : JSON.stringify(value);
    } catch {
      return content;
    }
  }

  async send(method, routePath, body, options = {}) {
    const url = new URL(routePath, ensureTrailingSlash(this.getConnectionSettings().baseUrl)).toString();
    const headers = {
      Accept: options.acceptEventStream ? "text/event-stream" : "application/json"
    };

    const apiToken = this.getConnectionSettings().apiToken;
    if (apiToken) {
      headers.Authorization = `Bearer ${apiToken.trim()}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal
    });

    if (!options.allowFailure && !response.ok) {
      throw new Error(await this.readError(response));
    }

    return response;
  }
}

function mapModel(model) {
  return {
    key: model.key,
    displayName: model.display_name,
    type: model.type,
    publisher: model.publisher,
    architecture: model.architecture ?? null,
    quantization: model.quantization
      ? {
          name: model.quantization.name ?? null,
          bitsPerWeight: model.quantization.bits_per_weight ?? null
        }
      : null,
    sizeBytes: model.size_bytes,
    paramsString: model.params_string ?? null,
    maxContextLength: model.max_context_length,
    format: model.format ?? null,
    loadedInstances: Array.isArray(model.loaded_instances)
      ? model.loaded_instances.map(instance => ({
          id: instance.id,
          config: mapLoadConfig(instance.config)
        }))
      : [],
    capabilities: model.capabilities
      ? {
          vision: Boolean(model.capabilities.vision),
          trainedForToolUse: Boolean(model.capabilities.trained_for_tool_use),
          reasoning: model.capabilities.reasoning
            ? {
                allowedOptions: Array.isArray(model.capabilities.reasoning.allowed_options) ? model.capabilities.reasoning.allowed_options : [],
                default: model.capabilities.reasoning.default
              }
            : null
        }
      : null,
    variants: Array.isArray(model.variants) ? model.variants : [],
    selectedVariant: model.selected_variant ?? null,
    description: model.description ?? null
  };
}

function mapLoadConfig(config) {
  return {
    contextLength: config.context_length,
    evalBatchSize: config.eval_batch_size ?? null,
    parallel: config.parallel ?? null,
    flashAttention: config.flash_attention ?? null,
    numExperts: config.num_experts ?? null,
    offloadKvCacheToGpu: config.offload_kv_cache_to_gpu ?? null
  };
}

function ensureTrailingSlash(baseUrl) {
  return String(baseUrl || "").endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
}

module.exports = {
  LmStudioClient
};