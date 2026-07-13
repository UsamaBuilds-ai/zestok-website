/**
 * Escape HTML special characters to prevent XSS injection.
 * @param {*} str - Input value to escape
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
