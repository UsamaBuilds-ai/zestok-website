import { getHealth } from './api.js';

const indicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const retryBtn = document.getElementById('retry-btn');

function setStatus(state, text) {
  indicator.className = state;
  statusText.textContent = text;
}

async function checkHealth() {
  setStatus('checking', 'Checking server...');

  const result = await getHealth();

  if (result.ok) {
    setStatus('connected', 'Connected');
  } else if (result.error === 'network_error') {
    setStatus('error', 'Server unreachable');
  } else {
    setStatus('error', `Server error: ${result.status}`);
  }
}

retryBtn.addEventListener('click', checkHealth);
document.addEventListener('DOMContentLoaded', checkHealth);
