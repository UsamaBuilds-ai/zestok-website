import { Network } from '@capacitor/network';

let _currentStatus = { connected: true, connectionType: 'unknown' };
const _subscribers = new Set();

export function isConnected() {
  return _currentStatus.connected;
}

export function getNetworkStatus() {
  return { ..._currentStatus };
}

export function onStatusChange(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

export function offStatusChange(callback) {
  _subscribers.delete(callback);
}

function _notify(status) {
  _currentStatus = status;
  for (const cb of _subscribers) {
    try {
      cb({ ...status });
    } catch (err) {
      console.error('[connectivity] subscriber error:', err);
    }
  }
}

async function _initConnectivity() {
  try {
    const status = await Network.getStatus();
    _notify({
      connected: status.connected,
      connectionType: status.connectionType || 'unknown',
    });
  } catch {
    _notify({ connected: navigator.onLine, connectionType: 'unknown' });
  }
}

export async function initConnectivity() {
  await _initConnectivity();

  try {
    Network.addListener('networkStatusChange', (status) => {
      _notify({
        connected: status.connected,
        connectionType: status.connectionType || 'unknown',
      });
    });
  } catch {
    window.addEventListener('online', () => _notify({ connected: true, connectionType: 'unknown' }));
    window.addEventListener('offline', () => _notify({ connected: false, connectionType: 'unknown' }));
  }
}
