<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useData, useRoute } from 'vitepress'
import { copyToClipboard } from '../utils/copy.js'

const RSPFX_PROMPT = `Use RSPFx from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read skills/rspfx/SKILL.md and docs/ in that repo (or https://rspfx.mbsks.me) for all toolchain details (Vite is default, Rsbuild/Rspack only if needed). Check ARCHITECTURE.md and packages/*/src if docs lag — code is truth. Do not use webpack/Heft/gulp.
You can use vite or rsbuild to scafold the app and follow docs on github to add plugin
Build with RSPFx's Vite-first pipeline: zero-config from config/config.json and *.manifest.json, single spfxVersion switch for SPFx 1.20–1.24, any framework via preset (React/Vue/Svelte/Solid/Preact/custom), CSS bundled into JS, dev server at localhost:4321, output to sharepoint/solution/*.sppkg, deploy with rspfx deploy. Keep manifests as contract and target the SharePoint runtime without changing the app model.`

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
      <svg v-if="!copied && !failed" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7" />
        <path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7" />
        <path d="M12 8v6M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      {{ copied ? 'COPIED!' : failed ? 'FAILED' : 'COPY PROMPT' }}
    </button>
  </div>
</template>
