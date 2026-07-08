const API_BASE = 'http://84.235.249.239:3000/api';
const DEFAULT_TIMEOUT = 10000;

export function getAuthHeaders() {
  // Phase 2: skeleton — returns empty object.
  // Phase 3 will populate from Preferences:
  //   { 'x-access-pin': pin, 'x-device-token': deviceToken }
  return {};
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, timeout = DEFAULT_TIMEOUT, auth = false, headers: extraHeaders = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (auth) {
    Object.assign(headers, getAuthHeaders());
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.ok) {
      return { ok: true, data, status: res.status };
    }

    return { ok: false, data, error: 'server_error', status: res.status };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { ok: false, error: 'network_error', status: 0 };
    }

    return { ok: false, error: 'network_error', status: 0 };
  }
}

export async function getHealth() {
  return apiRequest('/health');
}

export async function getEntries(options = {}) {
  return apiRequest('/entries', { ...options, auth: true });
}

export async function verifyPin(pin) {
  return apiRequest('/pin/verify', {
    method: 'POST',
    body: {},
    headers: { 'x-access-pin': pin },
  });
}
