import { Preferences } from '@capacitor/preferences';
import bcrypt from 'bcryptjs';
import { verifyPin as apiVerifyPin } from './api.js';
import { isConnected } from './connectivity.js';

let _isAuthenticated = false;
let _companyName = '';
let _tenantId = '';
const _subscribers = new Set();

export function isAuthenticated() {
  return _isAuthenticated;
}

export function getCompanyName() {
  return _companyName;
}

export function onAuthChange(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

function _notify(state) {
  _isAuthenticated = state.isAuthenticated;
  _companyName = state.companyName || '';
  _tenantId = state.tenantId || '';
  for (const cb of _subscribers) {
    try {
      cb({ isAuthenticated: _isAuthenticated, companyName: _companyName, tenantId: _tenantId });
    } catch (err) {
      console.error('[auth] subscriber error:', err);
    }
  }
}

export async function verifyPin(pin) {
  if (!isConnected()) {
    return { ok: false, error: 'network_error' };
  }

  const result = await apiVerifyPin(pin);

  if (result.ok && result.data?.valid) {
    const salt = bcrypt.genSaltSync(6);
    const pinHash = bcrypt.hashSync(pin, salt);

    await Preferences.set({ key: 'accessPin', value: pin });
    await Preferences.set({ key: 'companyName', value: result.data.company_name || '' });
    await Preferences.set({ key: 'tenantId', value: result.data.tenant_id || '' });
    await Preferences.set({ key: 'pinHash', value: pinHash });

    _notify({ isAuthenticated: true, companyName: result.data.company_name, tenantId: result.data.tenant_id });
    return { ok: true, data: result.data };
  }

  return { ok: false, error: 'invalid_pin' };
}

export async function clearSession() {
  await Preferences.remove({ key: 'accessPin' });
  await Preferences.remove({ key: 'companyName' });
  await Preferences.remove({ key: 'tenantId' });
  await Preferences.remove({ key: 'pinHash' });
  _notify({ isAuthenticated: false, companyName: '', tenantId: '' });
}
