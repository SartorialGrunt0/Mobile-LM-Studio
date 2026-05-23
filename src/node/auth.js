const crypto = require("node:crypto");

const AUTH_COOKIE_NAME = "mobile-lm-studio";
const AUTH_COOKIE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_ITERATIONS = 600000;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

// In-memory store: ip -> { count, resetAt }
const loginAttempts = new Map();

function hasPin(security) {
  return Boolean(security?.PinHash && security?.PinSalt);
}

function getIterations(security) {
  const iterations = Number.parseInt(String(security?.Iterations || DEFAULT_ITERATIONS), 10);
  return Number.isFinite(iterations) && iterations > 0 ? iterations : DEFAULT_ITERATIONS;
}

function isLoginRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now >= record.resetAt) {
    return false;
  }
  return record.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginAttempt(ip, success) {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now >= record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    record.count++;
  }
}

function verifyPin(pin, security) {
  if (!hasPin(security)) {
    return true;
  }

  if (!pin || !String(pin).trim()) {
    return false;
  }

  try {
    const salt = Buffer.from(security.PinSalt, "base64");
    const expectedHash = Buffer.from(security.PinHash, "base64");
    const actualHash = crypto.pbkdf2Sync(String(pin), salt, getIterations(security), expectedHash.length, "sha256");
    return actualHash.length === expectedHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

function createSecurityOptions(pin, iterations) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(String(pin).trim(), salt, iterations, 32, "sha256");

  return {
    PinHash: hash.toString("base64"),
    PinSalt: salt.toString("base64"),
    Iterations: iterations
  };
}

function buildUpdatedSecurity(requireLogin, pin, currentSecurity) {
  const iterations = getIterations(currentSecurity);

  if (!requireLogin) {
    return {
      PinHash: "",
      PinSalt: "",
      Iterations: iterations
    };
  }

  if (pin && String(pin).trim()) {
    return createSecurityOptions(pin, iterations);
  }

  if (hasPin(currentSecurity)) {
    return {
      PinHash: currentSecurity.PinHash,
      PinSalt: currentSecurity.PinSalt,
      Iterations: iterations
    };
  }

  throw new Error("Enter a PIN to enable sign-in.");
}

function buildCookieSecret(security) {
  if (hasPin(security)) {
    return `${security.PinHash}:${security.PinSalt}:${getIterations(security)}`;
  }

  return "mobile-lm-studio";
}

function signAuthCookie(security) {
  const expiresAt = Date.now() + AUTH_COOKIE_TTL_MS;
  const payload = `${expiresAt}:authenticated`;
  const signature = crypto.createHmac("sha256", buildCookieSecret(security)).update(payload).digest("base64url");
  return `v1.${expiresAt}.${signature}`;
}

function verifyAuthCookie(cookieValue, security) {
  if (!hasPin(security)) {
    return true;
  }

  if (!cookieValue || typeof cookieValue !== "string") {
    return false;
  }

  const match = cookieValue.match(/^v1\.(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!match) {
    return false;
  }

  const expiresAt = Number.parseInt(match[1], 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const payload = `${expiresAt}:authenticated`;
  const expectedSignature = crypto.createHmac("sha256", buildCookieSecret(security)).update(payload).digest("base64url");
  const actualSignature = match[2];
  return expectedSignature.length === actualSignature.length
    && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actualSignature));
}

function appendAuthCookie(response, security) {
  response.cookie(AUTH_COOKIE_NAME, signAuthCookie(security), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: AUTH_COOKIE_TTL_MS,
    path: "/"
  });
}

function clearAuthCookie(response) {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

function isAuthenticated(request, security) {
  return verifyAuthCookie(request.cookies?.[AUTH_COOKIE_NAME], security);
}

module.exports = {
  AUTH_COOKIE_NAME,
  appendAuthCookie,
  buildUpdatedSecurity,
  clearAuthCookie,
  hasPin,
  isAuthenticated,
  isLoginRateLimited,
  recordLoginAttempt,
  verifyPin
};