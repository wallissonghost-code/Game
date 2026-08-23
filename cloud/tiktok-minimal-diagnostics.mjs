import { RouteConfig } from 'tiktok-live-connector';

function errorSnapshot(error) {
  if (!error) return { name: 'UnknownError', message: 'Erro vazio/indefinido' };
  const out = {
    name: String(error?.name || error?.constructor?.name || 'Error'),
    message: String(error?.message || error),
    code: error?.code ?? null,
    reason: error?.reason ?? null,
    status: error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.response?.statusCode ?? null,
    cause: error?.cause ? {
      name: String(error.cause?.name || error.cause?.constructor?.name || 'Error'),
      message: String(error.cause?.message || error.cause),
      code: error.cause?.code ?? null,
      status: error.cause?.status ?? error.cause?.statusCode ?? error.cause?.response?.status ?? null
    } : null,
    keys: Object.keys(error || {}).slice(0, 30),
    responseKeys: error?.response && typeof error.response === 'object' ? Object.keys(error.response).slice(0, 30) : [],
    headers: error?.response?.headers || error?.headers || null,
    stack: String(error?.stack || '').split('\n').slice(0, 14).join('\n')
  };
  return out;
}

function wrapRoute(name) {
  const original = RouteConfig?.[name];
  if (typeof original !== 'function' || original.__caosDiagWrapped) return;

  const wrapped = async (...args) => {
    const startedAt = Date.now();
    try {
      return await original(...args);
    } catch (error) {
      const snapshot = errorSnapshot(error);
      const retryAfterBug = /retry-after/i.test(snapshot.message) && /undefined/i.test(snapshot.message);
      console.error('[CAOS_SIGNER_DIAG]', JSON.stringify({
        route: name,
        elapsedMs: Date.now() - startedAt,
        retryAfterBug,
        ...snapshot
      }));

      if (retryAfterBug) {
        const diagnostic = new Error('SIGNER_RESPONSE_INVALIDA: serviço de assinatura falhou antes de fornecer headers/retry-after. Consulte CAOS_SIGNER_DIAG no log do Render.');
        diagnostic.name = 'CaosSignerResponseError';
        diagnostic.cause = error;
        diagnostic.caosOriginal = snapshot;
        throw diagnostic;
      }
      throw error;
    }
  };

  wrapped.__caosDiagWrapped = true;
  RouteConfig[name] = wrapped;
}

wrapRoute('fetchSignedWebSocketFromProvider');
wrapRoute('fetchWebcastSignatureFromProvider');
wrapRoute('fetchRoomIdFromProvider');

console.log('[CAOS_SIGNER_DIAG] sonda de assinatura ativa; auto-reconnect continua desativado.');
