export function errorMessage(error) {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  try { return JSON.stringify(error); } catch { return String(error || 'Erro desconhecido'); }
}

export function classifyTikTokError(error) {
  const message = errorMessage(error).trim();
  const lower = message.toLowerCase();
  const missingRetryAfter =
    /cannot read properties of undefined/.test(lower) &&
    /retry-after/.test(lower);
  const rateLimited =
    /\b429\b/.test(lower) ||
    /too many requests/.test(lower) ||
    /rate[ -]?limit/.test(lower) ||
    /tiktok limitou reconex/i.test(lower);
  const signingPaywall =
    /business plan/.test(lower) ||
    /fetchwebcastsignature/.test(lower) ||
    (/eulerstream/.test(lower) && /sign/.test(lower));
  const timeout = /timeout|timed out|etimedout/.test(lower);

  return { message, missingRetryAfter, rateLimited, signingPaywall, timeout };
}

export function normalizeModernConnectError(error) {
  const info = classifyTikTokError(error);
  if (!info.missingRetryAfter) return error;

  // tiktok-live-connector 2.x can throw while trying to read a missing
  // Retry-After header. The server already has a proven legacy fallback;
  // tag this upstream compatibility failure so the existing fallback path
  // is selected instead of entering a rapid reconnect storm.
  const wrapped = new Error(
    `fetchWebcastSignature compatibility fallback: resposta TikTok sem header retry-after; ${info.message}`
  );
  wrapped.name = 'CaosTikTokCompatibilityError';
  wrapped.code = 'CAOS_TIKTOK_MISSING_RETRY_AFTER';
  wrapped.cause = error;
  return wrapped;
}

export function reconnectDelayMs(attempt, { rateLimited = false } = {}) {
  const n = Math.max(1, Math.min(8, Number(attempt) || 1));
  const normal = Math.min(15000, 1200 * Math.pow(1.65, n - 1));
  if (!rateLimited) return Math.round(normal);
  return Math.max(30000, Math.min(120000, 30000 * Math.pow(1.6, n - 1)));
}
