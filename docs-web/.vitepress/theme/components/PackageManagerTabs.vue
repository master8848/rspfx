<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePackageManager, type PackageManager } from '../composables/usePackageManager.js'
import { copyToClipboard } from '../utils/copy.js'

type Props = {
  commands?: Partial<Record<PackageManager, string>>
  npm?: string
  pnpm?: string
  yarn?: string
  bun?: string
  deno?: string
  command?: string
  /** optional label for title, not used */
  id?: string
}

const props = defineProps<Props>()

const { pm, init, setPM } = usePackageManager()
onMounted(init)

type Manager = { id: PackageManager; label: string }
const managers: Manager[] = [
  { id: 'pnpm', label: 'pnpm' },
  { id: 'npm', label: 'npm' },
  { id: 'yarn', label: 'yarn' },
  { id: 'bun', label: 'bun' },
  { id: 'deno', label: 'deno' },
]

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const selectedCommand = computed(() => {
  // explicit commands map wins
  if (props.commands?.[pm.value]) return props.commands[pm.value]!
  if (pm.value === 'npm' && props.npm) return props.npm
  if (pm.value === 'pnpm' && props.pnpm) return props.pnpm
  if (pm.value === 'yarn' && props.yarn) return props.yarn
  if (pm.value === 'bun' && props.bun) return props.bun
  if (pm.value === 'deno' && props.deno) return props.deno
  if (props.command) {
    // handle deno special for npx/dlx style? keep simple: `${pm} ${command}`
    // for deno dlx we expect explicit deno prop, but fallback is naive
    return `${pm.value} ${props.command}`
  }
  return ''
})

function select(id: PackageManager) {
  setPM(id)
}

async function copy() {
  if (!selectedCommand.value) return
  try {
    await copyToClipboard(selectedCommand.value)
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1800)
  } catch {}
}

// simple token color: first word = pm, rest dim
const commandParts = computed(() => {
  const cmd = selectedCommand.value
  const idx = cmd.indexOf(' ')
  if (idx === -1) return { head: cmd, rest: '' }
  return { head: cmd.slice(0, idx), rest: cmd.slice(idx) }
})
</script>

<template>
  <div class="rspfx-pm">
    <div class="rspfx-pm-tabs" role="tablist" aria-label="Package manager">
      <button
        v-for="m in managers"
        :key="m.id"
        role="tab"
        :aria-selected="pm === m.id ? 'true' : 'false'"
        class="rspfx-pm-tab"
        :class="{ 'is-active': pm === m.id }"
        @click="select(m.id)"
      >
        <span class="rspfx-pm-tab-icon" :data-pm="m.id" aria-hidden="true">
          <!-- pnpm: 2x2 squares -->
          <svg v-if="m.id === 'pnpm'" width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f9ad02"/><rect x="9" y="1" width="6" height="6" rx="1" fill="#f9ad02"/><rect x="1" y="9" width="6" height="6" rx="1" fill="#4e4e4e"/><rect x="9" y="9" width="6" height="6" rx="1" fill="#f9ad02" opacity="0.95"/></svg>
          <!-- npm: red square with n -->
          <svg v-else-if="m.id === 'npm'" width="14" height="14" viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#cb3837"/><text x="8" y="11.2" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="system-ui">n</text></svg>
          <!-- yarn: blue circle -->
          <svg v-else-if="m.id === 'yarn'" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#368fb9"/><path d="M8 4c1.5 1.2 2.5 2.8 2.2 5-.2 1.6-1.4 2.5-2.2 2.5S5.9 10.6 5.8 9C5.5 6.8 6.5 5.2 8 4z" stroke="#fff" stroke-width="1" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="7" r="0.8" fill="#fff"/><circle cx="9.5" cy="7" r="0.8" fill="#fff"/></svg>
          <!-- bun: bunny -->
          <svg v-else-if="m.id === 'bun'" width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#fdf6e3" stroke="#e8d5a8" stroke-width="0.8"/><ellipse cx="5.2" cy="4.2" rx="1.6" ry="2.2" fill="#f5d0a9" stroke="#e8b48a" stroke-width="0.6"/><ellipse cx="10.8" cy="4.2" rx="1.6" ry="2.2" fill="#f5d0a9" stroke="#e8b48a" stroke-width="0.6"/><circle cx="6" cy="8.2" r="1" fill="#2b2b2b"/><circle cx="10" cy="8.2" r="1" fill="#2b2b2b"/><circle cx="6" cy="8" r="0.35" fill="#fff"/><circle cx="10" cy="8" r="0.35" fill="#fff"/><path d="M7 10.5c0.6 0.7 1.4 0.7 2 0" stroke="#2b2b2b" stroke-width="0.8" stroke-linecap="round" fill="none"/></svg>
          <!-- deno: simple -->
          <svg v-else width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#222" stroke="#444" stroke-width="0.8"/><path d="M5 9c0-2.2 1.8-4 4-4 1.2 0 2.2 0.5 2.9 1.3" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/><circle cx="8" cy="9.5" r="1" fill="#fff"/></svg>
        </span>
        <span class="rspfx-pm-tab-label">{{ m.label }}</span>
      </button>
    </div>
    <div class="rspfx-pm-code-wrap">
      <pre class="rspfx-pm-code"><code><span class="rspfx-pm-cmd-head">{{ commandParts.head }}</span><span class="rspfx-pm-cmd-rest">{{ commandParts.rest }}</span></code></pre>
      <button class="rspfx-pm-copy" :class="{ copied }" :aria-label="copied ? 'Copied' : 'Copy command'" title="Copy" @click="copy">
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</template>
