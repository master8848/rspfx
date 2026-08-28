export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall through to legacy fallback (e.g. permission denied, insecure context)
    }
  }
  if (typeof document === 'undefined' || !document.body) {
    throw new Error('copyToClipboard: document.body unavailable')
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.setAttribute('aria-hidden', 'true')
  ta.style.position = 'fixed'
  ta.style.top = '-9999px'
  ta.style.left = '-9999px'
  ta.style.opacity = '0'
  ta.style.pointerEvents = 'none'
  document.body.appendChild(ta)
  try {
    ta.focus()
    ta.select()
    // setSelectionRange improves reliability on iOS / mobile
    try {
      ta.setSelectionRange(0, ta.value.length)
    } catch {}
    const copied = document.execCommand('copy')
    if (!copied) throw new Error('execCommand copy failed')
  } finally {
    if (ta.parentNode) ta.parentNode.removeChild(ta)
  }
}
