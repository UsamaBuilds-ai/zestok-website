import { Preferences } from '@capacitor/preferences';
import { getApiUrl, getAppSecret } from './config.js';

const DEFAULT_TIMEOUT = 10000;

let _apiBase = null;

async function getApiBase() {
  if (!_apiBase) {
    _apiBase = await getApiUrl();
  }
  return _apiBase;
}

export async function getAuthHeaders() {
  const { value: accessPin } = await Preferences.get({ key: 'accessPin' });
  const headers = {};
  if (accessPin) {
    headers['x-access-pin'] = accessPin;
  }
  const secret = await getAppSecret();
  if (secret) {
    headers['x-app-secret'] = secret;
  }
  return headers;
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
    const authHeaders = await getAuthHeaders();
    Object.assign(headers, authHeaders);
  } else {
    const secret = await getAppSecret();
    if (secret) {
      headers['x-app-secret'] = secret;
    }
  }

  try {
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}${path}`, {
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
    method: 'GET',
    headers: { 'x-access-pin': pin },
  });
}
