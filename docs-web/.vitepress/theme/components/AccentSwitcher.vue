<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type ThemeKind = 'accent' | 'shadcn'
type Theme = { id: string; label: string; color: string; kind: ThemeKind; dataValue: string }

/** Classic accents — applied via html[data-accent] (kept for backwards compat) */
const accentThemes: Theme[] = [
  { id: 'blue', label: 'Blue', color: '#0078d4', kind: 'accent', dataValue: 'blue' },
  { id: 'violet', label: 'Violet', color: '#7c3aed', kind: 'accent', dataValue: 'violet' },
  { id: 'emerald', label: 'Emerald', color: '#059669', kind: 'accent', dataValue: 'emerald' },
  { id: 'coral', label: 'Coral', color: '#ea580c', kind: 'accent', dataValue: 'coral' },
  { id: 'slate-accent', label: 'Slate', color: '#334155', kind: 'accent', dataValue: 'slate' },
]

/** shadcn themes — applied via html[data-theme]; --primary HSL defined in style.css */
const shadcnThemes: Theme[] = [
  { id: 'zinc', label: 'Zinc', color: '#18181b', kind: 'shadcn', dataValue: 'zinc' },
  { id: 'slate', label: 'Slate', color: '#1e293b', kind: 'shadcn', dataValue: 'slate' },
  { id: 'stone', label: 'Stone', color: '#57534e', kind: 'shadcn', dataValue: 'stone' },
  { id: 'gray', label: 'Gray', color: '#71717a', kind: 'shadcn', dataValue: 'gray' },
  { id: 'neutral', label: 'Neutral', color: '#52525b', kind: 'shadcn', dataValue: 'neutral' },
  { id: 'red', label: 'Red', color: '#dc2626', kind: 'shadcn', dataValue: 'red' },
  { id: 'rose', label: 'Rose', color: '#e11d48', kind: 'shadcn', dataValue: 'rose' },
  { id: 'orange', label: 'Orange', color: '#f97316', kind: 'shadcn', dataValue: 'orange' },
  { id: 'green', label: 'Green', color: '#16a34a', kind: 'shadcn', dataValue: 'green' },
  { id: 'blue-shadcn', label: 'Blue', color: '#2563eb', kind: 'shadcn', dataValue: 'blue' },
  { id: 'yellow', label: 'Yellow', color: '#ca8a04', kind: 'shadcn', dataValue: 'yellow' },
  { id: 'violet-shadcn', label: 'Violet', color: '#7c3aed', kind: 'shadcn', dataValue: 'violet' },
]

// ── drop-in extra themes ──
// Any `themes/[^_]*.css` is auto-loaded via `theme/index.ts` (`import.meta.glob` side-effect
// injects the CSS). Here we also read the raw content to auto-register the theme in the
// picker with zero extra edits — just drop a file (see themes/README.md).
function normalizeHex(c: string): string { return c.trim().toLowerCase() }
function titleCase(id: string): string {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}
function hslTripleToHex(triple: string): string | null {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (!m) return null
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r: number, g: number, b: number
  if (s === 0) { r = g = b = l } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  const toHex = (x: number): string => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const rawExtra = import.meta.glob<string>('../themes/*.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const extraShadcnThemes: Theme[] = Object.entries(rawExtra)
  .filter(([p]) => {
    const base = p.split('/').pop() ?? ''
    return !base.startsWith('_') && !base.startsWith('.')
  })
  .map(([path, raw]) => {
    const base = (path.split('/').pop() ?? '').replace(/\.css$/i, '')
    const id = base
    // label/color from header `/* theme-meta: label="Foo" color="#ff0000" */` if present
    const labelMatch = raw.match(/label\s*=\s*["']([^"']+)["']/)
    const colorMatch = raw.match(/color\s*=\s*["'](#[0-9a-fA-F]{3,8})["']/)
    const label = labelMatch ? labelMatch[1] : titleCase(id)
    let color: string | null = colorMatch ? colorMatch[1] : null
    if (!color) {
      const pm = raw.match(/--primary\s*:\s*([^;]+);/)
      if (pm) color = hslTripleToHex(pm[1].trim()) ?? null
    }
    if (!color) color = '#71717a'
    return { id, label, color, kind: 'shadcn' as const, dataValue: id }
  })
  .filter(t => {
    // ignore if id already exists in built-ins (file named `zinc.css` would duplicate)
    const builtinIds = new Set(shadcnThemes.map(x => x.id).concat(shadcnThemes.map(x => x.dataValue)))
    return !builtinIds.has(t.id) && !builtinIds.has(t.dataValue)
  })
  .sort((a, b) => a.label.localeCompare(b.label))

// dedup by color — extra files that reuse an existing primary color are hidden
// (prevents 20 new themes from flooding the picker with same dot)
function dedupByColor(themes: Theme[]): Theme[] {
  const seen = new Set<string>()
  const out: Theme[] = []
  for (const t of themes) {
    const n = normalizeHex(t.color)
    if (seen.has(n)) continue
    seen.add(n)
    out.push(t)
  }
  return out
}
const dedupedExtra = dedupByColor(extraShadcnThemes)

// shadcn (built-in + extra) deduped together
const allShadcnThemes: Theme[] = dedupByColor([...shadcnThemes, ...dedupedExtra])

// cross-section dedup: if a shadcn color duplicates an accent color, hide the accent
// (main dup is violet #7c3aed — keep the shadcn version as canonical)
const shadcnColorSet = new Set(allShadcnThemes.map(t => normalizeHex(t.color)))
const filteredAccentThemes: Theme[] = accentThemes.filter(t => !shadcnColorSet.has(normalizeHex(t.color)))

const _rawAllThemes: Theme[] = [...filteredAccentThemes, ...allShadcnThemes]
// emerald at start of picker
const allThemes: Theme[] = [
  ..._rawAllThemes.filter(t => t.id === 'emerald'),
  ..._rawAllThemes.filter(t => t.id !== 'emerald'),
]

const STORAGE_KEY = 'rspfx-theme'
const LEGACY_KEY = 'rspfx-accent'
const active = ref('emerald')
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const current = computed(() => allThemes.find(a => a.id === active.value) ?? allThemes.find(a => a.id === 'emerald') ?? allThemes[0])

function applyTheme(id: string) {
  active.value = id
  const theme = allThemes.find(t => t.id === id)
  const html = document.documentElement
  if (!theme) return
  if (theme.kind === 'accent') {
    html.removeAttribute('data-theme')
    if (theme.dataValue === 'blue') html.removeAttribute('data-accent')
    else html.setAttribute('data-accent', theme.dataValue)
  } else {
    html.removeAttribute('data-accent')
    html.setAttribute('data-theme', theme.dataValue)
  }
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  try { localStorage.setItem(LEGACY_KEY, id) } catch {}
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.color)
}

function select(id: string) {
  applyTheme(id)
  // keep picker open for live preview — close only via outside click / Escape
}

function onClickOutside(e: MouseEvent) {
  if (!open.value) return
  const target = e.target as Node
  if (rootEl.value && !rootEl.value.contains(target)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    const btn = rootEl.value?.querySelector<HTMLButtonElement>('.rspfx-accent-trigger')
    btn?.focus()
  }
}

function attachNearAppearance() {
  const tryAttach = () => {
    const appearance = document.querySelector('.VPNavBarAppearance')
    const el = rootEl.value
    if (appearance && el && appearance.parentElement) {
      if (el.parentElement !== appearance.parentElement || el.previousElementSibling !== appearance) {
        appearance.insertAdjacentElement('afterend', el)
        el.classList.add('rspfx-accent--attached')
      }
      return true
    }
    return false
  }
  if (!tryAttach()) {
    let retries = 0
    const id = setInterval(() => {
      retries++
      if (tryAttach() || retries > 20) clearInterval(id)
    }, 100)
  }
}

onMounted(() => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
  } catch {}
  // migrate legacy plain values: "violet" etc were accent ids; map slate legacy correctly
  const validIds = new Set(allThemes.map(t => t.id))
  let initial = 'emerald'
  if (saved && validIds.has(saved)) initial = saved
  else if (saved === 'slate') initial = 'slate-accent' // legacy slate was accent
  else if (saved && allThemes.some(t => t.dataValue === saved)) {
    // saved was a raw dataValue like "zinc" from manual edit — map to shadcn id
    const byData = allShadcnThemes.find(t => t.dataValue === saved)
    if (byData) initial = byData.id
  }
  active.value = initial
  const theme = allThemes.find(t => t.id === initial)
  const html = document.documentElement
  if (theme) {
    if (theme.kind === 'accent') {
      html.removeAttribute('data-theme')
      if (theme.dataValue === 'blue') html.removeAttribute('data-accent')
      else html.setAttribute('data-accent', theme.dataValue)
    } else {
      html.removeAttribute('data-accent')
      html.setAttribute('data-theme', theme.dataValue)
    }
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme.color)
  }
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  attachNearAppearance()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootEl" class="rspfx-accent">
    <button
      class="rspfx-accent-trigger"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="menu"
      aria-label="Select theme"
      :data-tooltip="`Theme: ${current.label}`"
      @click.stop="open = !open"
    >
      <span class="rspfx-accent-trigger-dot" :style="{ background: current.color }" aria-hidden="true" />
      <span class="rspfx-accent-trigger-text">{{ current.label }}</span>
      <svg class="rspfx-accent-chevron" :class="{ 'is-open': open }" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Transition name="rspfx-accent-flyout">
      <div v-if="open" class="rspfx-accent-menu" role="menu" aria-label="Theme">
        <div class="rspfx-accent-menu-header">Change theme</div>
        <div class="rspfx-accent-grid">
          <button
            v-for="a in allThemes"
            :key="a.id"
            class="rspfx-accent-swatch"
            :class="{ 'is-active': active === a.id }"
            :data-tooltip="a.label"
            :aria-label="a.label"
            role="menuitemradio"
            :aria-checked="active === a.id ? 'true' : 'false'"
            @click.stop="select(a.id)"
          >
            <span class="rspfx-accent-swatch-dot" :style="{ background: a.color }" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
