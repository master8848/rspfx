<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useData, useRoute } from 'vitepress'
import { copyToClipboard } from '../utils/copy.js'

const RSPFX_PROMPT = `Use RSPFx from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read skills/rspfx/SKILL.md and docs/ in that repo (or https://rspfx.mbsks.me) for all toolchain details (Vite is default, Rsbuild/Rspack only if needed). Check ARCHITECTURE.md and packages/*/src if docs lag — code is truth. Do not use webpack/Heft/gulp.
Scaffold the app with vite or rsbuild and follow docs on github to add the plugin.
Build with RSPFx's Vite-first pipeline: zero-config from config/config.json and *.manifest.json, single spfxVersion switch (full 1.20–1.24, dev-only 1.11–1.19), any framework via preset (React/Vue/Svelte/Solid/Preact/custom), CSS bundled into JS, dev server at localhost:4321, output to sharepoint/solution/*.sppkg, deploy with rspfx deploy. Keep manifests as contract and target the SharePoint runtime without changing the app model.
For existing Heft/gulp projects: try without migrating — run rspfx dev:vite (auto-scaffolds vite.config.ts with lean @mbsks/rspfx-plugin-dev / rspfxViteDev; manual alternative devTryMode:true + tryComponents), then npm run dev:vite / vite --port 4321 (rspfx dev also works). http://localhost:4321 is local preview, https + workbench debugManifestsFile with --tenant. Keep gulp/heft for production. See docs/guide/try-mode.md.`

const copied = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const { frontmatter } = useData()
const route = useRoute()
const isHome = computed(() => {
  const fm: any = frontmatter.value
  return fm?.layout === 'home' || route.path === '/' || route.path === '/index.html'
})

function setState(s: 'copied' | 'failed' | 'idle') {
  copied.value = s === 'copied'
  failed.value = s === 'failed'
  if (timer) clearTimeout(timer)
  timer = s !== 'idle' ? setTimeout(() => { copied.value = false; failed.value = false }, 2000) : null
}

async function copy() {
  try {
    await copyToClipboard(RSPFX_PROMPT)
    setState('copied')
  } catch {
    setState('failed')
  }
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div v-if="isHome" data-rspfx-hero-prompt class="rspfx-hero-prompt">
    <button
      class="rspfx-hero-copy"
      :class="{ copied, failed }"
      type="button"
      aria-label="Copy prompt for AI agents"
      @click="copy"
    >
      <!-- Tabler: copy / check / alert-circle -->
      <svg v-if="!copied && !failed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
      <svg v-else-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
      {{ copied ? 'COPIED!' : failed ? 'FAILED' : 'COPY PROMPT' }}
    </button>
  </div>
</template>
