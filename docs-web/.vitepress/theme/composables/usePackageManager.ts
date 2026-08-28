import { ref } from 'vue'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'deno'

const STORAGE_KEY = 'rspfx-pm'
const getInitialPM = (): PackageManager => {
  if (typeof window !== 'undefined') {
    try {
      const w = (window as any).__RSPFX_PM as string | undefined
      if (w && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(w)) return w as PackageManager
      const attr = document.documentElement.getAttribute('data-pm') as PackageManager | null
      if (attr && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(attr)) return attr
      const saved = localStorage.getItem(STORAGE_KEY) as PackageManager | null
      if (saved && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(saved)) return saved
    } catch {}
  }
  return 'npm'
}
const pm = ref<PackageManager>(getInitialPM())
let initialized = false

export function usePackageManager() {
  function init() {
    if (initialized) return
    initialized = true
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PackageManager | null
      if (saved && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(saved)) {
        pm.value = saved
      }
    } catch {}
  }

  function setPM(value: PackageManager) {
    pm.value = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {}
    // dispatch storage event for cross-tab sync
    try {
      window.dispatchEvent(new CustomEvent('rspfx-pm-change', { detail: value }))
    } catch {}
  }

  return { pm, init, setPM, STORAGE_KEY }
}

// listen for external changes (other component or storage event)
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(e.newValue)) {
        pm.value = e.newValue as PackageManager
      }
    })
    window.addEventListener('rspfx-pm-change' as any, (e: any) => {
      if (e.detail && ['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(e.detail)) {
        pm.value = e.detail as PackageManager
      }
    })
  } catch {}
}
