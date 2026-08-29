<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { usePackageManager, type PackageManager } from '../composables/usePackageManager.js'
import { copyToClipboard } from '../utils/copy.js'

// ── Hero: Copy Prompt (inline, no slot dependency — layout: page has no home-hero-actions-after) ──
const RSPFX_PROMPT = `Use RSPFx from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read skills/rspfx/SKILL.md and docs/ in that repo (or https://rspfx.mbsks.me) for all toolchain details (Vite is default, Rsbuild/Rspack only if needed). Check ARCHITECTURE.md and packages/*/src if docs lag — code is truth. Do not use webpack/Heft/gulp.
You can use vite or rsbuild to scafold the app and follow docs on github to add plugin
Build with RSPFx's Vite-first pipeline: zero-config from config/config.json and *.manifest.json, single spfxVersion switch for SPFx 1.20–1.24, any framework via preset (React/Vue/Svelte/Solid/Preact/custom), CSS bundled into JS, dev server at localhost:4321, output to sharepoint/solution/*.sppkg, deploy with rspfx deploy. Keep manifests as contract and target the SharePoint runtime without changing the app model.`
const promptCopied = ref(false)
const promptFailed = ref(false)
let promptTimer: ReturnType<typeof setTimeout> | null = null
async function copyPrompt() {
  try {
    await copyToClipboard(RSPFX_PROMPT)
    promptCopied.value = true
    promptFailed.value = false
    if (promptTimer) clearTimeout(promptTimer)
    promptTimer = setTimeout(() => (promptCopied.value = false), 2000)
  } catch {
    promptFailed.value = true
    promptCopied.value = false
    if (promptTimer) clearTimeout(promptTimer)
    promptTimer = setTimeout(() => (promptFailed.value = false), 2000)
  }
}
onBeforeUnmount(() => { if (promptTimer) clearTimeout(promptTimer) })

// ── Package manager ──
const { pm, init, setPM } = usePackageManager()
onMounted(init)

type PM = PackageManager
const managers: readonly { id: PM; label: string }[] = [
  { id: 'pnpm', label: 'pnpm' },
  { id: 'npm', label: 'npm' },
  { id: 'yarn', label: 'yarn' },
  { id: 'bun', label: 'bun' },
  { id: 'deno', label: 'deno' },
]

function selectPM(id: PM) { setPM(id) }

// Commands tables (duplicated from pmTransform for home use)
const createViteCmds: Record<PM, string> = {
  npm: 'npm create vite@latest my-app -- --template react-ts',
  pnpm: 'pnpm create vite@latest my-app -- --template react-ts',
  yarn: 'yarn create vite@latest my-app -- --template react-ts',
  bun: 'bun create vite@latest my-app -- --template react-ts',
  deno: 'deno run -A npm:create-vite@latest my-app -- --template react-ts',
}
const addPluginCmds: Record<PM, string> = {
  npm: 'npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
  pnpm: 'pnpm add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
  yarn: 'yarn add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
  bun: 'bun add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
  deno: 'deno add -D npm:@mbsks/rspfx-plugin npm:@mbsks/rspfx-cli',
}
const installCmds: Record<PM, string> = {
  npm: 'npm install',
  pnpm: 'pnpm install',
  yarn: 'yarn',
  bun: 'bun install',
  deno: 'deno install',
}

const createCmd = computed(() => createViteCmds[pm.value] ?? createViteCmds.npm)
const addCmd = computed(() => addPluginCmds[pm.value] ?? addPluginCmds.npm)
const installCmd = computed(() => installCmds[pm.value] ?? installCmds.npm)

// copy for PM code blocks
const copiedCreate = ref(false)
const copiedAdd = ref(false)
const copiedInstall = ref(false)
let t1: ReturnType<typeof setTimeout> | null = null
let t2: ReturnType<typeof setTimeout> | null = null
let t3: ReturnType<typeof setTimeout> | null = null
async function copyCmd(text: string, which: 'create' | 'add' | 'install') {
  try {
    await copyToClipboard(text)
    if (which === 'create') { copiedCreate.value = true; if (t1) clearTimeout(t1); t1 = setTimeout(() => (copiedCreate.value = false), 1500) }
    if (which === 'add') { copiedAdd.value = true; if (t2) clearTimeout(t2); t2 = setTimeout(() => (copiedAdd.value = false), 1500) }
    if (which === 'install') { copiedInstall.value = true; if (t3) clearTimeout(t3); t3 = setTimeout(() => (copiedInstall.value = false), 1500) }
  } catch {}
}
onBeforeUnmount(() => { if (t1) clearTimeout(t1); if (t2) clearTimeout(t2); if (t3) clearTimeout(t3) })

// Start in seconds — tabs
type StartTab = 'new' | 'existing' | 'plugin'
const activeTab = ref<StartTab>('new')
function setTab(t: StartTab) { activeTab.value = t }

// Features
const features = [
  {
    title: 'Zero-config to start',
    details: 'No vite.config.ts required. RSPFx reads config/config.json and your manifests — add config only when you need control.',
    link: '/docs/getting-started',
    linkText: 'Quick start',
  },
  {
    title: 'One pipeline, three bundlers',
    details: 'Vite is default. Switch to Rsbuild or Rspack with a single plugin — rspfxVite or rspfxRsbuild, same manifests.',
    link: '/docs/frameworks',
    linkText: 'Frameworks',
  },
  {
    title: 'Any framework',
    details: 'React, Vue, Svelte, Solid, Preact — or bring your own preset. @mbsks/rspfx-core has zero dependencies.',
    link: '/docs/frameworks',
    linkText: 'Supported frameworks',
  },
  {
    title: 'Doctor & deploy built in',
    details: 'rspfx doctor validates Node, certs, ports and manifests. rspfx deploy publishes straight to the catalog.',
    link: '/docs/commands',
    linkText: 'Commands',
  },
]
</script>

<template>
  <div class="rspfx-home">
    <!-- ── Hero ── -->
    <section class="rspfx-hero">
      <div class="rspfx-hero-inner">
        <div class="rspfx-hero-content">
          <h1 class="rspfx-hero-name">RSPFx</h1>
          <p class="rspfx-hero-text">Ship SharePoint web parts without the legacy toolchain</p>
          <p class="rspfx-hero-tagline">SPFx development shouldn't be frustrating. RSPFx dev server runs in seconds with modern tooling (Vite, Rsbuild, Rspack) — not minutes waiting on Heft and webpack.</p>
          <div class="rspfx-hero-actions">
            <a class="rspfx-btn rspfx-btn-brand" href="/docs/getting-started">Get started</a>
            <button
              class="rspfx-hero-copy"
              :class="{ copied: promptCopied, failed: promptFailed }"
              type="button"
              aria-label="Copy prompt for AI agents"
              @click="copyPrompt"
            >
              <svg v-if="!promptCopied && !promptFailed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
              <svg v-else-if="promptCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
              {{ promptCopied ? 'COPIED!' : promptFailed ? 'FAILED' : 'COPY PROMPT' }}
            </button>
          </div>
        </div>
        <div class="rspfx-hero-image">
          <div class="rspfx-hero-image-bg" aria-hidden="true" />
          <img src="/hero.svg" alt="RSPFx — build SharePoint web parts with Vite" width="320" height="320" loading="eager" decoding="async" />
        </div>
      </div>
    </section>

    <!-- ── Features ── -->
    <section class="rspfx-section rspfx-features">
      <div class="rspfx-features-grid">
        <a v-for="(f, i) in features" :key="f.title" class="rspfx-feature" :href="f.link">
          <span class="rspfx-feature-num" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
          <h3 class="rspfx-feature-title">
            <!-- Tabler icons per card -->
            <span class="rspfx-feature-icon" aria-hidden="true">
              <!-- 0: rocket, 1: stack, 2: components, 3: stethoscope -->
              <svg v-if="i === 0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4.5 16.5c-1.5 1.26 -2 5 -2 5s3.74 -.5 5 -2c.71 -.84 .7 -2.13 -.09 -2.91a2.18 2.18 0 0 0 -2.91 -.09z"/><path d="M12 15l-3 -3a22 22 0 0 1 2 -3.95a5.5 5.5 0 0 1 4 -2.67a12 12 0 0 1 3.95 2l-3 3l-3 3z"/><path d="M14 14l-3 -3"/><path d="M14 14l-1.5 -1.5"/><path d="M8 8l1.5 1.5"/><path d="M21 21l-4.5 -4.5"/></svg>
              <svg v-else-if="i === 1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6l-8 4.5l8 4.5l8 -4.5z"/><path d="M8 11.919l-8 4.5l8 4.5l8 -4.5l-8 -4.5z" opacity="0.35"/><path d="M16 8.919l8 4.5l-8 4.5l-8 -4.5z" opacity="0.0"/></svg>
              <svg v-else-if="i === 2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 4h8a4 4 0 0 1 4 4a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4a4 4 0 0 1 4 -4z"/><path d="M12 12v6"/><path d="M9 15h6"/><path d="M6 4v-1a1 1 0 0 1 1 -1h1"/><path d="M18 8a3 3 0 0 1 3 3a3 3 0 0 1 -3 3h-1"/></svg>
            </span>
            {{ f.title }}
          </h3>
          <p class="rspfx-feature-details">{{ f.details }}</p>
          <span class="rspfx-feature-link">{{ f.linkText }}</span>
        </a>
      </div>
    </section>

    <!-- ── Proof bar ── -->
    <section class="rspfx-section rspfx-proof">
      <div class="rspfx-proof-inner">
        <span class="rspfx-proof-item"><strong>1.20 – 1.24</strong> SPFx targets</span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>0 deps</strong> core</span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>Vite · Rsbuild · Rspack</strong></span>
        <span class="rspfx-proof-sep" aria-hidden="true">·</span>
        <span class="rspfx-proof-item"><strong>1 line</strong> <code>spfxVersion</code> switch</span>
      </div>
    </section>

    <!-- ── Start in seconds ── -->
    <section class="rspfx-section rspfx-start">
      <h2 class="rspfx-section-title">Start in seconds</h2>

      <!-- PM switcher (global for this section) -->
      <div class="rspfx-pm" role="group" aria-label="Package manager">
        <div class="rspfx-pm-tabs" role="tablist" aria-label="Package manager">
          <button
            v-for="m in managers"
            :key="m.id"
            role="tab"
            :aria-selected="pm === m.id ? 'true' : 'false'"
            :tabindex="pm === m.id ? 0 : -1"
            class="rspfx-pm-tab"
            :class="{ 'is-active': pm === m.id }"
            @click="selectPM(m.id)"
          >
            <span class="rspfx-pm-tab-icon" :data-pm="m.id" aria-hidden="true">
              <svg v-if="m.id === 'npm'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#CB3837" d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/></svg>
              <svg v-else-if="m.id === 'pnpm'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#F69220" d="M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM2 2h3.5v3.5H2zm8.25 0h3.498v3.5H10.25zm8.25 0H22v3.5h-3.5zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zm2 2H22v3.5h-3.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z"/></svg>
              <svg v-else-if="m.id === 'yarn'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#2C8EBB" d="M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12 12-5.375 12-12S18.625 0 12 0zm.768 4.105c.183 0 .363.053.525.157.125.083.287.185.755 1.154.31-.088.468-.042.551-.019.204.056.366.19.463.375.477.917.542 2.553.334 3.605-.241 1.232-.755 2.029-1.131 2.576.324.329.778.899 1.117 1.825.278.774.31 1.478.273 2.015a5.51 5.51 0 0 0 .602-.329c.593-.366 1.487-.917 2.553-.931.714-.009 1.269.445 1.353 1.103a1.23 1.23 0 0 1-.945 1.362c-.649.158-.95.278-1.821.843-1.232.797-2.539 1.242-3.012 1.39a1.686 1.686 0 0 1-.704.343c-.737.181-3.266.315-3.466.315h-.046c-.783 0-1.214-.241-1.45-.491-.658.329-1.51.19-2.122-.134a1.078 1.078 0 0 1-.58-1.153 1.243 1.243 0 0 1-.153-.195c-.162-.25-.528-.936-.454-1.946.056-.723.556-1.367.88-1.71a5.522 5.522 0 0 1 .408-2.256c.306-.727.885-1.348 1.32-1.737-.32-.537-.644-1.367-.329-2.21.227-.602.412-.936.82-1.08h-.005c.199-.074.389-.153.486-.259a3.418 3.418 0 0 1 2.298-1.103c.037-.093.079-.185.125-.283.31-.658.639-1.029 1.024-1.168a.94.94 0 0 1 .328-.06zm.006.7c-.507.016-1.001 1.519-1.001 1.519s-1.27-.204-2.266.871c-.199.218-.468.334-.746.44-.079.028-.176.023-.417.672-.371.991.625 2.094.625 2.094s-1.186.839-1.626 1.881c-.486 1.144-.338 2.261-.338 2.261s-.843.732-.899 1.487c-.051.663.139 1.2.343 1.515.227.343.51.176.51.176s-.561.653-.037.931c.477.25 1.283.394 1.71-.037.31-.31.371-1.001.486-1.283.028-.065.12.111.209.199.097.093.264.195.264.195s-.755.324-.445 1.066c.102.246.468.403 1.066.398.222-.005 2.664-.139 3.313-.296.375-.088.505-.283.505-.283s1.566-.431 2.998-1.357c.917-.598 1.293-.76 2.034-.936.612-.148.57-1.098-.241-1.084-.839.009-1.575.44-2.196.825-1.163.718-1.742.672-1.742.672l-.018-.032c-.079-.13.371-1.293-.134-2.678-.547-1.515-1.413-1.881-1.344-1.997.297-.5 1.038-1.297 1.334-2.78.176-.899.13-2.377-.269-3.151-.074-.144-.732.241-.732.241s-.616-1.371-.788-1.483a.271.271 0 0 0-.157-.046z"/></svg>
              <svg v-else-if="m.id === 'bun'" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="#FBF0DF" stroke="#E3C9A6" stroke-width="0.4" d="M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="currentColor" d="M1.105 18.02A11.9 11.9 0 0 1 0 12.985q0-.698.078-1.376a12 12 0 0 1 .231-1.34A12 12 0 0 1 4.025 4.02a12 12 0 0 1 5.46-2.771 12 12 0 0 1 3.428-.23c1.452.112 2.825.477 4.077 1.05a12 12 0 0 1 2.78 1.774 12.02 12.02 0 0 1 4.053 7.078A12 12 0 0 1 24 12.985q0 .454-.036.914a12 12 0 0 1-.728 3.305 12 12 0 0 1-2.38 3.875c-1.33 1.357-3.02 1.962-4.43 1.936a4.4 4.4 0 0 1-2.724-1.024c-.99-.853-1.391-1.83-1.53-2.919a5 5 0 0 1 .128-1.518c.105-.38.37-1.116.76-1.437-.455-.197-1.04-.624-1.226-.829-.045-.05-.04-.13 0-.183a.155.155 0 0 1 .177-.053c.392.134.869.267 1.372.35.66.111 1.484.25 2.317.292 2.03.1 4.153-.813 4.812-2.627s.403-3.609-1.96-4.685-3.454-2.356-5.363-3.128c-1.247-.505-2.636-.205-4.06.582-3.838 2.121-7.277 8.822-5.69 15.032a.191.191 0 0 1-.315.19 12 12 0 0 1-1.25-1.634 12 12 0 0 1-.769-1.404M11.57 6.087c.649-.051 1.214.501 1.31 1.236.13.979-.228 1.99-1.41 2.013-1.01.02-1.315-.997-1.248-1.614.066-.616.574-1.575 1.35-1.635"/></svg>
            </span>
            <span class="rspfx-pm-tab-label">{{ m.label }}</span>
          </button>
        </div>
      </div>

      <!-- Start tabs -->
      <div class="rspfx-start-tabs" role="tablist" aria-label="Start options">
        <button role="tab" :aria-selected="String(activeTab === 'new')" class="rspfx-start-tab" :class="{ 'is-active': activeTab === 'new' }" @click="setTab('new')">new project — plugin</button>
        <button role="tab" :aria-selected="String(activeTab === 'existing')" class="rspfx-start-tab" :class="{ 'is-active': activeTab === 'existing' }" @click="setTab('existing')">existing project</button>
        <button role="tab" :aria-selected="String(activeTab === 'plugin')" class="rspfx-start-tab" :class="{ 'is-active': activeTab === 'plugin' }" @click="setTab('plugin')">plugin — Vite default</button>
      </div>

      <div class="rspfx-start-panel">
        <!-- New project -->
        <div v-if="activeTab === 'new'" class="rspfx-start-content">
          <div class="rspfx-code-block">
            <div class="rspfx-code-header">
              <span class="rspfx-code-lang">sh</span>
              <button class="rspfx-code-copy" :class="{ copied: copiedCreate }" aria-label="Copy" @click="copyCmd(createCmd, 'create')">
                <svg v-if="!copiedCreate" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
              </button>
            </div>
            <pre class="rspfx-code"><code>{{ createCmd }}</code></pre>
          </div>
          <div class="rspfx-code-block">
            <pre class="rspfx-code"><code>cd my-app</code></pre>
          </div>
          <div class="rspfx-code-block">
            <div class="rspfx-code-header">
              <span class="rspfx-code-lang">sh</span>
              <button class="rspfx-code-copy" :class="{ copied: copiedAdd }" aria-label="Copy" @click="copyCmd(addCmd, 'add')">
                <svg v-if="!copiedAdd" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
              </button>
            </div>
            <pre class="rspfx-code"><code>{{ addCmd }}</code></pre>
          </div>
          <div class="rspfx-code-block rspfx-code-block-muted">
            <pre class="rspfx-code"><code><span class="c"># add rspfxVite() to vite.config.ts + manifests, then</span>
rspfx dev          <span class="c"># http://localhost:4321 — no tenant needed</span>
rspfx package      <span class="c"># → sharepoint/solution/my-app.sppkg</span>
<span class="c"># any starter works: better-t-stack, TanStack Router, etc. — just add the plugin</span>
<span class="c"># shortcut: rspfx new my-app</span></code></pre>
          </div>
        </div>

        <!-- Existing project -->
        <div v-else-if="activeTab === 'existing'" class="rspfx-start-content">
          <div class="rspfx-code-block rspfx-code-block-muted">
            <pre class="rspfx-code"><code><span class="c"># in your existing Heft/gulp SPFx project</span>
rspfx migrate --dry-run   <span class="c"># preview</span>
rspfx migrate             <span class="c"># apply (backup → .rspfx/migrate-backup.json)</span></code></pre>
          </div>
          <div class="rspfx-code-block">
            <div class="rspfx-code-header">
              <span class="rspfx-code-lang">sh</span>
              <button class="rspfx-code-copy" :class="{ copied: copiedInstall }" aria-label="Copy" @click="copyCmd(installCmd, 'install')">
                <svg v-if="!copiedInstall" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
              </button>
            </div>
            <pre class="rspfx-code"><code>{{ installCmd }}</code></pre>
          </div>
          <div class="rspfx-code-block rspfx-code-block-muted">
            <pre class="rspfx-code"><code>rspfx dev                 <span class="c"># same manifests, no config required</span></code></pre>
          </div>
        </div>

        <!-- Plugin -->
        <div v-else class="rspfx-start-content">
          <div class="rspfx-code-block rspfx-code-block-code">
            <div class="rspfx-code-header">
              <span class="rspfx-code-lang">ts</span>
            </div>
            <pre class="rspfx-code"><code><span class="c">// vite.config.ts — add to any Vite starter (create-vite, better-t-stack, TanStack Router…)</span>
<span class="kw">import</span> { defineConfig } <span class="kw">from</span> <span class="str">'vite'</span>
<span class="kw">import</span> { rspfxVite } <span class="kw">from</span> <span class="str">'@mbsks/rspfx-plugin'</span>
<span class="kw">export default</span> defineConfig({ plugins: [rspfxVite({ name: <span class="str">'my-app'</span>, framework: <span class="str">'react'</span>, spfxVersion: <span class="str">'1.24'</span> })] })
<span class="c">// Rsbuild: rspfxRsbuild() in rsbuild.config.ts, Rspack: new RSpfxPlugin() in rspack.config.ts</span></code></pre>
          </div>
        </div>
      </div>

      <p class="rspfx-start-note">Switch SPFx versions with one line — <code>spfxVersion: '1.20'</code> → <code>'1.24'</code> — then update your package. See <a href="/docs/compatibility">Compatibility</a> and <a href="/docs/upgrading-spfx-version">Upgrading SPFx</a>.</p>
    </section>

    <!-- ── Compare table ── -->
    <section class="rspfx-section rspfx-compare">
      <h2 class="rspfx-section-title">How it compares</h2>
      <div class="rspfx-compare-table">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Official toolchain (Heft / gulp)</th>
              <th>RSPFx</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bundler</td>
              <td>webpack only</td>
              <td>Vite (default), Rsbuild, Rspack</td>
            </tr>
            <tr>
              <td>Frameworks</td>
              <td>React, vanilla</td>
              <td>React, Vue, Svelte, Solid, Preact + custom presets</td>
            </tr>
            <tr>
              <td>SPFx switch</td>
              <td>new project / pin updates</td>
              <td>one line <code>spfxVersion</code> + package manager update</td>
            </tr>
            <tr>
              <td>Dev server</td>
              <td><code>gulp serve</code> :4321</td>
              <td><code>rspfx dev</code> :4321 — tenant optional</td>
            </tr>
            <tr>
              <td>Package manager</td>
              <td>npm / yarn / pnpm</td>
              <td>npm · pnpm · yarn · bun · deno</td>
            </tr>
            <tr>
              <td>Config required</td>
              <td>rig + gulpfile required</td>
              <td>zero-config from <code>config/config.json</code> + manifests</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Tip ── -->
    <section class="rspfx-section rspfx-tip">
      <span class="rspfx-tip-kicker">Before first dev</span>
      <span>Run <code>rspfx doctor</code> — it checks Node version, cert trust, port conflicts and missing manifests in one pass.</span>
    </section>
  </div>
</template>

<style scoped>
/* ── Page container ── */
.rspfx-home {
  width: 100%;
  max-width: 1152px;
  margin: 0 auto;
  padding: 0 24px 48px;
  box-sizing: border-box;
}
@media (max-width: 640px) {
  .rspfx-home { padding-left: 16px; padding-right: 16px; }
}
.rspfx-section { margin-top: 40px; }
.rspfx-section-title {
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -0.025em;
  margin: 0 0 16px;
  color: var(--vp-c-text-1);
  line-height: 1.2;
}

/* ── Hero ── */
.rspfx-hero {
  position: relative;
  isolation: isolate;
  padding: 40px 0 12px;
  overflow: hidden;
}
.rspfx-hero::before {
  content: '';
  position: absolute;
  inset: -40px -24px 0 -24px;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(680px 420px at 12% 18%, hsl(var(--primary) / 0.12), transparent 60%),
    radial-gradient(560px 380px at 88% 12%, hsl(262 83% 58% / 0.10), transparent 62%),
    radial-gradient(520px 360px at 60% 92%, hsl(346 77% 60% / 0.06), transparent 65%);
}
.rspfx-hero::after {
  content: '';
  position: absolute;
  inset: 0 -24px 0 -24px;
  z-index: -1;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse 80% 62% at 50% 0%, #000 68%, transparent 108%);
  -webkit-mask-image: radial-gradient(ellipse 80% 62% at 50% 0%, #000 68%, transparent 108%);
  opacity: 0.9;
}
:global(.dark) .rspfx-hero::after {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  opacity: 1;
}
.rspfx-hero-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  max-width: 1152px;
  margin: 0 auto;
}
.rspfx-hero-content { flex: 1 1 0; min-width: 0; }
.rspfx-hero-name {
  margin: 0;
  font-size: 56px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 0.95;
  background: var(--vp-home-hero-name-background);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.rspfx-hero-text {
  margin: 12px 0 0;
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.025em;
  color: var(--vp-c-text-1);
  line-height: 1.15;
  max-width: 560px;
}
.rspfx-hero-tagline {
  margin: 14px 0 0;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.6;
  max-width: 580px;
  text-wrap: balance;
}
.rspfx-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  align-items: center;
}
.rspfx-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, background 0.18s ease;
  border: 1px solid transparent;
}
.rspfx-btn-brand {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 4px 12px hsl(var(--primary) / 0.28);
}
.rspfx-btn-brand:hover { transform: translateY(-1px); box-shadow: 0 4px 16px hsl(var(--primary) / 0.32); }
.rspfx-btn-alt {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
}
.rspfx-btn-alt:hover { background: var(--vp-c-default-soft); transform: translateY(-1px); }

.rspfx-hero-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  height: 40px;
  padding: 0 20px;
  border-radius: 9999px;
  border: 1.5px solid hsl(var(--primary));
  background: transparent;
  color: hsl(var(--primary));
  font-family: var(--vp-font-family-base);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.06em;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
  outline: none;
  user-select: none;
}
.rspfx-hero-copy:hover { background: hsl(var(--primary) / 0.08); transform: translateY(-1px); box-shadow: 0 4px 16px hsl(var(--primary) / 0.14); }
.rspfx-hero-copy:active { transform: translateY(0); }
.rspfx-hero-copy:focus-visible { box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--primary) / 0.40); }
.rspfx-hero-copy.copied { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-color: hsl(var(--primary)); }
.rspfx-hero-copy.failed { border-color: #ef4444; color: #ef4444; }
:global(.dark) .rspfx-hero-copy.failed { color: #f87171; border-color: #f87171; }
:global(.dark) .rspfx-hero-copy:hover { background: hsl(var(--primary) / 0.14); }
.rspfx-hero-copy.copied:hover { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.rspfx-hero-copy.failed:hover { background: transparent; }

.rspfx-hero-image {
  position: relative;
  flex: 0 0 320px;
  width: 320px;
  height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;
}
.rspfx-hero-image-bg {
  position: absolute;
  inset: 8%;
  border-radius: 32px;
  background-image: var(--vp-home-hero-image-background-image);
  filter: var(--vp-home-hero-image-filter);
  opacity: 0.9;
  z-index: -1;
}
.rspfx-hero-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 24px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: var(--rspfx-shadow-soft);
  background: var(--vp-c-bg);
}
:global(.dark) .rspfx-hero-image img { border-color: rgba(255,255,255,0.08); }

@media (max-width: 960px) {
  .rspfx-hero-inner { flex-direction: column; align-items: flex-start; }
  .rspfx-hero-image { flex: none; width: 280px; height: 280px; align-self: center; }
  .rspfx-hero-name { font-size: 48px; }
  .rspfx-hero-text { font-size: 30px; }
}
@media (max-width: 640px) {
  .rspfx-hero { padding-top: 24px; }
  .rspfx-hero-name { font-size: 40px; }
  .rspfx-hero-text { font-size: 26px; }
  .rspfx-hero-image { width: 240px; height: 240px; }
}

/* ── Features ── */
.rspfx-features-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 1024px) { .rspfx-features-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .rspfx-features-grid { grid-template-columns: 1fr; } }

.rspfx-feature {
  position: relative;
  display: block;
  padding: 18px 18px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-elv, var(--vp-c-bg-soft));
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  counter-increment: feat;
}
.rspfx-features { counter-reset: feat; }
.rspfx-feature::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent), transparent);
  opacity: 0;
  transition: opacity 0.2s ease;
}
.rspfx-feature:hover::before { opacity: 1; }
.rspfx-feature:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-divider));
  box-shadow: 0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  transform: translateY(-2px);
}
:global(.dark) .rspfx-feature:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.32), 0 1px 3px rgba(0,0,0,0.3); }
.rspfx-feature-num {
  position: absolute;
  top: 14px;
  right: 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
  opacity: 0.9;
}
.rspfx-feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--vp-c-brand-soft);
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
  color: var(--vp-c-brand-1);
  margin-right: 8px;
  vertical-align: middle;
  flex-shrink: 0;
}
.rspfx-feature-title {
  margin: 2px 0 0;
  font-size: 14.5px;
  font-weight: 680;
  letter-spacing: -0.02em;
  line-height: 1.35;
  color: var(--vp-c-text-1);
  display: flex;
  align-items: center;
  padding-right: 28px;
}
.rspfx-feature-details {
  margin: 8px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13.2px;
  line-height: 1.65;
}
.rspfx-feature-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.rspfx-feature-link::after { content: ' →'; font-weight: 400; opacity: 0.7; }

/* ── Proof ── */
.rspfx-proof { margin-top: 28px; }
.rspfx-proof-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px 14px;
  padding: 12px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 85%, transparent);
  font-size: 13px;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}
.rspfx-proof-item strong { color: var(--vp-c-text-1); font-weight: 700; letter-spacing: -0.015em; }
.rspfx-proof-item code { font-size: 12.5px; padding: 1px 5px; border-radius: 6px; background: var(--vp-c-default-soft); border: 1px solid var(--vp-c-divider); }
.rspfx-proof-sep { color: var(--vp-c-text-3); user-select: none; }
@media (max-width: 640px) {
  .rspfx-proof-inner { border-radius: 12px; justify-content: flex-start; }
}

/* ── Package manager tabs (reused) ── */
.rspfx-pm {
  margin: 12px 0 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  background: #0f0f0f;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
}
:global(.dark) .rspfx-pm { border-color: rgba(255,255,255,0.10); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.rspfx-pm-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 8px 8px 10px;
  background: #161616;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  overflow-x: auto;
  scrollbar-width: none;
}
.rspfx-pm-tabs::-webkit-scrollbar { display: none; }
.rspfx-pm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(255,255,255,0.62);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  outline: none;
}
.rspfx-pm-tab:hover { color: rgba(255,255,255,0.92); background: rgba(255,255,255,0.06); }
.rspfx-pm-tab.is-active { background: #2a2a2a; color: #fff; border-color: rgba(255,255,255,0.12); box-shadow: 0 1px 2px rgba(0,0,0,0.2) inset, 0 0 0 1px rgba(255,255,255,0.06); }
.rspfx-pm-tab:focus-visible { box-shadow: 0 0 0 2px rgba(255,255,255,0.16); border-color: rgba(255,255,255,0.22); }
.rspfx-pm-tab-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rspfx-pm-tab-label { letter-spacing: -0.01em; }

/* ── Start in seconds ── */
.rspfx-start-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px;
  border-radius: 9999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  margin-bottom: 16px;
}
.rspfx-start-tab {
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
}
.rspfx-start-tab:hover { color: var(--vp-c-text-1); background: var(--vp-c-default-soft); }
.rspfx-start-tab.is-active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
  box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 4px 12px hsl(var(--primary) / 0.18);
}
.rspfx-start-tab:focus-visible { box-shadow: 0 0 0 2px hsl(var(--primary) / 0.28); }

.rspfx-start-panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 16px;
}
.rspfx-start-content { display: flex; flex-direction: column; gap: 10px; }

.rspfx-code-block {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: #0f0f0f;
  overflow: hidden;
}
.rspfx-code-block-muted { background: #0f0f0f; }
.rspfx-code-block-muted .rspfx-code { color: #e6e6e6; }
.rspfx-code-block-code { background: #0f0f0f; }
.rspfx-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 6px 12px;
  background: #161616;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.rspfx-code-lang {
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.rspfx-code-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.72);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  outline: none;
}
.rspfx-code-copy:hover { background: rgba(255,255,255,0.10); color: #fff; border-color: rgba(255,255,255,0.16); }
.rspfx-code-copy.copied { color: #4ade80; border-color: rgba(74,222,128,0.30); background: rgba(74,222,128,0.12); }
.rspfx-code-copy.copied:hover { color: #4ade80; background: rgba(74,222,128,0.12); border-color: rgba(74,222,128,0.30); }
.rspfx-code {
  margin: 0;
  padding: 12px 16px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: anywhere;
  color: #e6e6e6;
}
.rspfx-code code { color: inherit; background: transparent; padding: 0; border: 0; font-size: inherit; }
.rspfx-code .c { color: #6a9955; }
.rspfx-code .kw { color: #569cd6; }
.rspfx-code .str { color: #ce9178; }

.rspfx-start-note {
  margin: 14px 0 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
.rspfx-start-note code {
  font-size: 12.5px;
  padding: 1px 5px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
  border: 1px solid var(--vp-c-divider);
}
.rspfx-start-note a { color: var(--vp-c-brand-1); text-decoration: none; font-weight: 600; }
.rspfx-start-note a:hover { text-decoration: underline; }

/* ── Compare ── */
.rspfx-compare { width: 100%; }
.rspfx-compare-table {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, var(--vp-c-text-2) 30%);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.rspfx-compare table {
  width: 100%;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 14px;
  line-height: 1.5;
  background: transparent;
  table-layout: fixed;
  margin: 0;
  border: 0;
}
.rspfx-compare th, .rspfx-compare td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 65%, var(--vp-c-text-2) 35%);
  border-right: 1px solid color-mix(in srgb, var(--vp-c-divider) 65%, var(--vp-c-text-2) 35%);
  vertical-align: middle;
}
.rspfx-compare th:last-child, .rspfx-compare td:last-child { border-right: none; }
.rspfx-compare th {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  border-bottom: 1px solid hsl(var(--primary) / 0.9);
  border-right-color: hsl(var(--primary-foreground) / 0.22);
}
.rspfx-compare th:first-child { border-top-left-radius: 12px; }
.rspfx-compare th:last-child { border-top-right-radius: 12px; }
.rspfx-compare tr:last-child td { border-bottom: none; }
.rspfx-compare td:first-child { font-weight: 600; color: var(--vp-c-text-1); white-space: nowrap; font-size: 13.5px; }
.rspfx-compare td { font-size: 13.5px; color: var(--vp-c-text-1); }
.rspfx-compare th:first-child, .rspfx-compare td:first-child { width: 20%; }
.rspfx-compare th:nth-child(2), .rspfx-compare td:nth-child(2) { width: 34%; }
.rspfx-compare th:nth-child(3), .rspfx-compare td:nth-child(3) { width: 46%; }
.rspfx-compare td code {
  font-size: 12.5px;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
  border: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}
@media (max-width: 768px) {
  .rspfx-compare table { min-width: 600px; table-layout: auto; font-size: 13.5px; }
  .rspfx-compare th, .rspfx-compare td { padding: 10px 12px; }
  .rspfx-compare th:first-child, .rspfx-compare td:first-child { width: auto; }
  .rspfx-compare th:nth-child(2), .rspfx-compare td:nth-child(2) { width: auto; }
  .rspfx-compare th:nth-child(3), .rspfx-compare td:nth-child(3) { width: auto; }
}
@media (max-width: 480px) {
  .rspfx-compare table { min-width: 560px; }
}

/* ── Tip ── */
.rspfx-tip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: baseline;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  font-size: 14px;
  line-height: 1.6;
}
.rspfx-tip-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  background: hsl(var(--primary) / 0.10);
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 14%, transparent);
  padding: 3px 7px;
  border-radius: 9999px;
  line-height: 1;
}
.rspfx-tip code { font-size: 13px; padding: 1px 5px; border-radius: 6px; background: var(--vp-c-default-soft); border: 1px solid var(--vp-c-divider); }
</style>
