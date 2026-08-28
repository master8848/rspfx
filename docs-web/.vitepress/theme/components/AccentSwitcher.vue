<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

type ThemeKind = 'accent' | 'shadcn'
type Theme = { id: string; label: string; color: string; kind: ThemeKind; dataValue: string }

/** Classic accents — applied via html[data-accent] (kept for backwards compat) */
const accentThemes: Theme[] = [
  { id: 'blue', label: 'Default', color: '#0078d4', kind: 'accent', dataValue: 'blue' },
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

const allThemes: Theme[] = [...accentThemes, ...shadcnThemes]

const STORAGE_KEY = 'rspfx-theme'
const LEGACY_KEY = 'rspfx-accent'
const active = ref('blue')
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const current = computed(() => allThemes.find(a => a.id === active.value) ?? allThemes[0])

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
  open.value = false
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
  let initial = 'blue'
  if (saved && validIds.has(saved)) initial = saved
  else if (saved === 'slate') initial = 'slate-accent' // legacy slate was accent
  else if (saved && allThemes.some(t => t.dataValue === saved)) {
    // saved was a raw dataValue like "zinc" from manual edit — map to shadcn id
    const byData = shadcnThemes.find(t => t.dataValue === saved)
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
      :title="`Theme: ${current.label}`"
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
        <div class="rspfx-accent-section-label">Accents</div>
        <button
          v-for="a in accentThemes"
          :key="a.id"
          class="rspfx-accent-option"
          :class="{ 'is-active': active === a.id }"
          role="menuitemradio"
          :aria-checked="active === a.id ? 'true' : 'false'"
          @click.stop="select(a.id)"
        >
          <span class="rspfx-accent-option-dot" :style="{ background: a.color }" aria-hidden="true" />
          <span class="rspfx-accent-option-label">{{ a.label }}</span>
          <svg v-if="active === a.id" class="rspfx-accent-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <hr class="rspfx-accent-sep" />

        <div class="rspfx-accent-section-label">Shadcn themes</div>
        <button
          v-for="a in shadcnThemes"
          :key="a.id"
          class="rspfx-accent-option"
          :class="{ 'is-active': active === a.id }"
          role="menuitemradio"
          :aria-checked="active === a.id ? 'true' : 'false'"
          @click.stop="select(a.id)"
        >
          <span class="rspfx-accent-option-dot" :style="{ background: a.color }" aria-hidden="true" />
          <span class="rspfx-accent-option-label">{{ a.label }}</span>
          <svg v-if="active === a.id" class="rspfx-accent-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>
