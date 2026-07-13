import { Preferences } from '@capacitor/preferences';
import bcrypt from 'bcryptjs';
import { verifyPin as apiVerifyPin } from './api.js';
import { isConnected } from './connectivity.js';
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';

let _isAuthenticated = false;
let _companyName = '';
let _tenantId = '';
const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';
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

async function _verifyOffline(pin) {
  const { value: storedHash } = await Preferences.get({ key: 'pinHash' });
  if (!storedHash) {
    return { ok: false, error: 'offline_no_session' };
  }
  const match = bcrypt.compareSync(pin, storedHash);
  if (match) {
    const { value: companyName } = await Preferences.get({ key: 'companyName' });
    const { value: tenantId } = await Preferences.get({ key: 'tenantId' });
    _notify({ isAuthenticated: true, companyName: companyName || '', tenantId: tenantId || '' });
    return { ok: true, data: { company_name: companyName, tenant_id: tenantId } };
  }
  return { ok: false, error: 'invalid_pin' };
}

export async function verifyPin(pin) {
  if (!isConnected()) {
    return _verifyOffline(pin);
  }

  let result;
  try {
    result = await apiVerifyPin(pin);
  } catch {
    return _verifyOffline(pin);
  }

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

  if (result.status === 429) {
    return { ok: false, error: 'rate_limited' };
  }

  return { ok: false, error: 'invalid_pin' };
}

export async function clearSession() {
  await Preferences.remove({ key: 'accessPin' });
  await Preferences.remove({ key: 'companyName' });
  await Preferences.remove({ key: 'tenantId' });
  await Preferences.remove({ key: 'pinHash' });
  await Preferences.remove({ key: BIOMETRIC_ENABLED_KEY });
  _notify({ isAuthenticated: false, companyName: '', tenantId: '' });
}

export async function signOut() {
  await clearSession();
}

export async function tryBiometricAuth() {
  const { value: enabled } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  if (!enabled) return { ok: false, reason: 'not_enabled' };

  let biometryInfo;
  try {
    biometryInfo = await BiometricAuth.checkBiometry();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (!biometryInfo.isAvailable) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Zestok',
      cancelTitle: 'Use PIN',
      allowDeviceCredential: true,
    });
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: 'true' });
    const { value: companyName } = await Preferences.get({ key: 'companyName' });
    const { value: tenantId } = await Preferences.get({ key: 'tenantId' });
    _notify({ isAuthenticated: true, companyName: companyName || '', tenantId: tenantId || '' });
    return { ok: true };
  } catch (error) {
    if (error instanceof BiometryError) {
      if (error.code === BiometryErrorType.userCancel) {
        return { ok: false, reason: 'cancelled' };
      }
      return { ok: false, reason: 'error', code: error.code };
    }
    return { ok: false, reason: 'error' };
  }
}

export async function isBiometricEnabled() {
  const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
  return value === 'true';
}

export async function handleSessionExpiry() {
  await clearSession();
  return { cleared: true };
}

export async function checkSessionTimeout() {
  const { value: storedHash } = await Preferences.get({ key: 'pinHash' });
  return { expired: !storedHash };
}
