// Capture before React/auth/localization start; the secret never enters router state.
let capturedToken = ''
if (typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').toLowerCase() === '/confirm-email-change') {
  const fragment = new URLSearchParams(window.location.hash.slice(1))
  const tokens = fragment.getAll('token')
  capturedToken = tokens.length === 1 && tokens[0].length <= 4096 ? tokens[0] : ''
  window.history.replaceState(null, '', '/confirm-email-change')
}

export function readConfirmationToken() { return capturedToken }
export function discardConfirmationToken() { capturedToken = '' }
