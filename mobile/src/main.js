const API_BASE = 'http://84.235.249.239:3000';

const indicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const retryBtn = document.getElementById('retry-btn');

function setStatus(state, text) {
  indicator.className = state;
  statusText.textContent = text;
}

async function checkHealth() {
  setStatus('checking', 'Checking server...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      setStatus('connected', 'Connected');
    } else {
      setStatus('error', `Server error: ${res.status}`);
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      setStatus('error', 'Server unreachable');
    } else {
      setStatus('error', 'Server unreachable');
    }
  }
}

retryBtn.addEventListener('click', checkHealth);

document.addEventListener('DOMContentLoaded', checkHealth);
