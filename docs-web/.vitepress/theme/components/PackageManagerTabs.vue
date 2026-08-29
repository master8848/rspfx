<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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
const managers: readonly Manager[] = [
  { id: 'pnpm', label: 'pnpm' },
  { id: 'npm', label: 'npm' },
  { id: 'yarn', label: 'yarn' },
  { id: 'bun', label: 'bun' },
  { id: 'deno', label: 'deno' },
] as const

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})

const selectedCommand = computed(() => {
  // explicit commands map wins
  if (props.commands?.[pm.value]) return props.commands[pm.value]!
  const propByPm: Partial<Record<PackageManager, string>> = {
    npm: props.npm,
    pnpm: props.pnpm,
    yarn: props.yarn,
    bun: props.bun,
    deno: props.deno,
  }
  const direct = propByPm[pm.value]
  if (direct) return direct
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

function onTabKeydown(e: KeyboardEvent) {
  const idx = managers.findIndex(m => m.id === pm.value)
  if (idx === -1) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = (idx + dir + managers.length) % managers.length
    const nextId = managers[next].id
    setPM(nextId)
    // move focus to newly selected tab
    const tabs = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs[next]?.focus()
  }
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
    <div class="rspfx-pm-tabs" role="tablist" aria-label="Package manager" @keydown="onTabKeydown">
      <button
        v-for="m in managers"
        :key="m.id"
        role="tab"
        :aria-selected="pm === m.id ? 'true' : 'false'"
        :tabindex="pm === m.id ? 0 : -1"
        class="rspfx-pm-tab"
        :class="{ 'is-active': pm === m.id }"
        @click="select(m.id)"
      >
        <span class="rspfx-pm-tab-icon" :data-pm="m.id" aria-hidden="true">
          <!-- Simple Icons — official brand logos (https://simpleicons.org) -->
          <svg v-if="m.id === 'npm'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#CB3837" d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>
          <svg v-else-if="m.id === 'pnpm'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#F69220" d="M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM2 2h3.5v3.5H2zm8.25 0h3.498v3.5H10.25zm8.25 0H22v3.5h-3.5zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zm2 2H22v3.5h-3.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z"/></svg>
          <svg v-else-if="m.id === 'yarn'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#2C8EBB" d="M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12 12-5.375 12-12S18.625 0 12 0zm.768 4.105c.183 0 .363.053.525.157.125.083.287.185.755 1.154.31-.088.468-.042.551-.019.204.056.366.19.463.375.477.917.542 2.553.334 3.605-.241 1.232-.755 2.029-1.131 2.576.324.329.778.899 1.117 1.825.278.774.31 1.478.273 2.015a5.51 5.51 0 0 0 .602-.329c.593-.366 1.487-.917 2.553-.931.714-.009 1.269.445 1.353 1.103a1.23 1.23 0 0 1-.945 1.362c-.649.158-.95.278-1.821.843-1.232.797-2.539 1.242-3.012 1.39a1.686 1.686 0 0 1-.704.343c-.737.181-3.266.315-3.466.315h-.046c-.783 0-1.214-.241-1.45-.491-.658.329-1.51.19-2.122-.134a1.078 1.078 0 0 1-.58-1.153 1.243 1.243 0 0 1-.153-.195c-.162-.25-.528-.936-.454-1.946.056-.723.556-1.367.88-1.71a5.522 5.522 0 0 1 .408-2.256c.306-.727.885-1.348 1.32-1.737-.32-.537-.644-1.367-.329-2.21.227-.602.412-.936.82-1.08h-.005c.199-.074.389-.153.486-.259a3.418 3.418 0 0 1 2.298-1.103c.037-.093.079-.185.125-.283.31-.658.639-1.029 1.024-1.168a.94.94 0 0 1 .328-.06zm.006.7c-.507.016-1.001 1.519-1.001 1.519s-1.27-.204-2.266.871c-.199.218-.468.334-.746.44-.079.028-.176.023-.417.672-.371.991.625 2.094.625 2.094s-1.186.839-1.626 1.881c-.486 1.144-.338 2.261-.338 2.261s-.843.732-.899 1.487c-.051.663.139 1.2.343 1.515.227.343.51.176.51.176s-.561.653-.037.931c.477.25 1.283.394 1.71-.037.31-.31.371-1.001.486-1.283.028-.065.12.111.209.199.097.093.264.195.264.195s-.755.324-.445 1.066c.102.246.468.403 1.066.398.222-.005 2.664-.139 3.313-.296.375-.088.505-.283.505-.283s1.566-.431 2.998-1.357c.917-.598 1.293-.76 2.034-.936.612-.148.57-1.098-.241-1.084-.839.009-1.575.44-2.196.825-1.163.718-1.742.672-1.742.672l-.018-.032c-.079-.13.371-1.293-.134-2.678-.547-1.515-1.413-1.881-1.344-1.997.297-.5 1.038-1.297 1.334-2.78.176-.899.13-2.377-.269-3.151-.074-.144-.732.241-.732.241s-.616-1.371-.788-1.483a.271.271 0 0 0-.157-.046z"/></svg>
          <svg v-else-if="m.id === 'bun'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#FBF0DF" stroke="#E3C9A6" stroke-width="0.4" d="M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M1.105 18.02A11.9 11.9 0 0 1 0 12.985q0-.698.078-1.376a12 12 0 0 1 .231-1.34A12 12 0 0 1 4.025 4.02a12 12 0 0 1 5.46-2.771 12 12 0 0 1 3.428-.23c1.452.112 2.825.477 4.077 1.05a12 12 0 0 1 2.78 1.774 12.02 12.02 0 0 1 4.053 7.078A12 12 0 0 1 24 12.985q0 .454-.036.914a12 12 0 0 1-.728 3.305 12 12 0 0 1-2.38 3.875c-1.33 1.357-3.02 1.962-4.43 1.936a4.4 4.4 0 0 1-2.724-1.024c-.99-.853-1.391-1.83-1.53-2.919a5 5 0 0 1 .128-1.518c.105-.38.37-1.116.76-1.437-.455-.197-1.04-.624-1.226-.829-.045-.05-.04-.13 0-.183a.155.155 0 0 1 .177-.053c.392.134.869.267 1.372.35.66.111 1.484.25 2.317.292 2.03.1 4.153-.813 4.812-2.627s.403-3.609-1.96-4.685-3.454-2.356-5.363-3.128c-1.247-.505-2.636-.205-4.06.582-3.838 2.121-7.277 8.822-5.69 15.032a.191.191 0 0 1-.315.19 12 12 0 0 1-1.25-1.634 12 12 0 0 1-.769-1.404M11.57 6.087c.649-.051 1.214.501 1.31 1.236.13.979-.228 1.99-1.41 2.013-1.01.02-1.315-.997-1.248-1.614.066-.616.574-1.575 1.35-1.635"/></svg>
        </span>
        <span class="rspfx-pm-tab-label">{{ m.label }}</span>
      </button>
    </div>
    <div class="rspfx-pm-code-wrap">
      <pre class="rspfx-pm-code"><code><span class="rspfx-pm-cmd-head">{{ commandParts.head }}</span><span class="rspfx-pm-cmd-rest">{{ commandParts.rest }}</span></code></pre>
      <button class="rspfx-pm-copy" :class="{ copied }" :aria-label="copied ? 'Copied' : 'Copy command'" title="Copy" @click="copy">
        <!-- Tabler: copy / check -->
        <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
      </button>
    </div>
  </div>
</template>
