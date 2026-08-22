import assert from 'node:assert/strict';
import {
  classifyTikTokError,
  normalizeModernConnectError,
  reconnectDelayMs
} from '../cloud/tiktok-resilience.mjs';

const missingHeader = new TypeError("Cannot read properties of undefined (reading 'retry-after')");
const missingInfo = classifyTikTokError(missingHeader);
assert.equal(missingInfo.missingRetryAfter, true, 'deve detectar parser quebrado de retry-after');
assert.equal(missingInfo.rateLimited, false, 'parser quebrado não deve ser confundido automaticamente com 429 real');

const normalized = normalizeModernConnectError(missingHeader);
assert.notEqual(normalized, missingHeader, 'deve embrulhar a falha upstream');
assert.equal(normalized.code, 'CAOS_TIKTOK_MISSING_RETRY_AFTER');
assert.match(normalized.message, /fetchWebcastSignature/i, 'deve acionar o fallback legado existente');
assert.match(normalized.message, /retry-after/i);

const ordinary = new Error('socket hang up');
assert.equal(normalizeModernConnectError(ordinary), ordinary, 'erros comuns não devem ser reclassificados');

for (const sample of [
  new Error('HTTP 429 Too Many Requests'),
  new Error('rate limit reached'),
  new Error('TikTok limitou reconexões')
]) {
  assert.equal(classifyTikTokError(sample).rateLimited, true, `rate limit não detectado: ${sample.message}`);
}

assert.equal(classifyTikTokError(new Error('probe timeout')).timeout, true);
assert.equal(classifyTikTokError(new Error('Business plan required')).signingPaywall, true);
assert.equal(classifyTikTokError(new Error('fetchWebcastSignature denied')).signingPaywall, true);

const normal1 = reconnectDelayMs(1);
const normal8 = reconnectDelayMs(8);
const limited1 = reconnectDelayMs(1, { rateLimited: true });
const limited8 = reconnectDelayMs(8, { rateLimited: true });
assert.ok(normal1 >= 1000 && normal1 < normal8, 'backoff normal deve crescer');
assert.ok(normal8 <= 15000, 'backoff normal deve ter teto');
assert.ok(limited1 >= 30000, 'rate limit deve esperar no mínimo 30s');
assert.ok(limited8 <= 120000, 'rate limit deve ter teto de 120s');

console.log('OK: TikTok resilience cobre retry-after ausente, 429, timeout e backoff.');
