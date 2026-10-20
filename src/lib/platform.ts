/** Running from the Home Screen icon (not inside Safari). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

/**
 * iOS only opens the keyboard when an input is focused inside the tap handler.
 * Call this in the tap that opens a sheet; the sheet's input can then take focus a moment later.
 */
export function primeKeyboard() {
  const proxy = document.createElement('input')
  proxy.setAttribute('aria-hidden', 'true')
  proxy.tabIndex = -1
  proxy.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0'
  document.body.appendChild(proxy)
  proxy.focus({ preventScroll: true })
  setTimeout(() => proxy.remove(), 1000)
}
