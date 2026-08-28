import { ref } from 'vue'

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'deno'

const STORAGE_KEY = 'rspfx-pm'
const PM_LIST: readonly PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun', 'deno'] as const
const PM_SET: ReadonlySet<string> = new Set(PM_LIST)

function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === 'string' && PM_SET.has(value)
}

interface RspfxWindow extends Window {
  __RSPFX_PM?: string
}

type PmChangeDetail = PackageManager
type PmChangeEvent = CustomEvent<PmChangeDetail>

const getInitialPM = (): PackageManager => {
  if (typeof window !== 'undefined') {
    try {
      const w = (window as RspfxWindow).__RSPFX_PM
      if (isPackageManager(w)) return w
      const attr = document.documentElement.getAttribute('data-pm')
      if (isPackageManager(attr)) return attr
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isPackageManager(saved)) return saved
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
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isPackageManager(saved)) {
        pm.value = saved
      }
    } catch {}
  }

  function setPM(value: PackageManager) {
    if (!isPackageManager(value)) return
    pm.value = value
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {}
    // dispatch storage event for cross-tab sync
    try {
      window.dispatchEvent(new CustomEvent<PmChangeDetail>('rspfx-pm-change', { detail: value }))
    } catch {}
  }

  return { pm, init, setPM, STORAGE_KEY }
}

// listen for external changes (other component or storage event)
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isPackageManager(e.newValue)) {
        pm.value = e.newValue
      }
    })
    window.addEventListener('rspfx-pm-change' as keyof WindowEventMap, ((e: PmChangeEvent) => {
      if (isPackageManager(e.detail)) {
        pm.value = e.detail
      }
    }) as EventListener)
  } catch {}
}
