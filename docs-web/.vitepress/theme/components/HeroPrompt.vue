<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { copyToClipboard } from '../utils/copy.js'

// RSPFX agent prompt — mirrors README "Agent prompt" + toolchain contract
const RSPFX_PROMPT = `Use RSPFX from https://github.com/master8848/rspfx — docs at https://rspfx.mbsks.me — for this SPFx project. Read skills/rspfx/SKILL.md and docs/ in that repo (or https://rspfx.mbsks.me) for all toolchain details (Vite is default, Rsbuild/Rspack only if needed). Check ARCHITECTURE.md and packages/*/src if docs lag — code is truth. Do not use webpack/Heft/gulp.

Build with RSPFX's Vite-first pipeline: zero-config from config/config.json and *.manifest.json, single spfxVersion switch for SPFx 1.20–1.24, any framework via preset (React/Vue/Svelte/Solid/Preact/custom), CSS bundled into JS, dev server at localhost:4321, output to sharepoint/solution/*.sppkg, deploy with rspfx deploy. Keep manifests as contract and target the SharePoint runtime without changing the app model.`

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
  if (s !== 'idle') timer = setTimeout(() => { copied.value = false; failed.value = false }, 2000)
}

async function copy() {
  try {
    await copyToClipboard(RSPFX_PROMPT)
    setState('copied')
  } catch {
    setState('failed')
  }
}

// Inject button directly into .VPHero .actions so it sits inline with Get started / Why RSPFX
// Slot home-hero-actions-after renders AFTER .actions; DOM injection moves it inline for exact TanStack parity.
let injectedBtn: HTMLButtonElement | null = null

function syncInjectedBtn() {
  if (!injectedBtn) return
  injectedBtn.innerHTML = copied.value
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> COPIED!`
    : failed.value
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v6M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> FAILED`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg> COPY RSPFX PROMPT`
  injectedBtn.classList.toggle('copied', copied.value)
  injectedBtn.classList.toggle('failed', failed.value)
}

watch([copied, failed], syncInjectedBtn)

function injectIntoActions() {
  if (typeof document === 'undefined') return false
  const actions = document.querySelector('.VPHero .actions')
  const placeholder = document.querySelector('[data-rspfx-hero-prompt]')
  if (!actions || !placeholder) return false
  if (actions.querySelector('[data-rspfx-hero-prompt-injected]')) return true
  const btn = document.createElement('button')
  btn.setAttribute('data-rspfx-hero-prompt-injected', 'true')
  btn.className = 'rspfx-hero-copy'
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Copy RSPFX prompt for AI agents')
  injectedBtn = btn
  syncInjectedBtn()
  btn.addEventListener('click', async () => {
    try {
      await copyToClipboard(RSPFX_PROMPT)
      setState('copied')
    } catch { setState('failed') }
  })
  const actionWrap = document.createElement('div')
  actionWrap.className = 'action'
  actionWrap.appendChild(btn)
  actions.appendChild(actionWrap)
  const fallback = placeholder as HTMLElement
  if (fallback) fallback.style.display = 'none'
  return true
}

onMounted(() => {
  if (!isHome.value) return
  injectIntoActions()
  let tries = 0
  const t = setInterval(() => {
    tries++
    if (injectIntoActions() || tries > 20) clearInterval(t)
  }, 150)
})
</script>

<template>
  <div v-if="isHome" data-rspfx-hero-prompt class="rspfx-hero-prompt">
    <button
      class="rspfx-hero-copy rspfx-hero-copy--fallback"
      :class="{ copied, failed }"
      type="button"
      aria-label="Copy RSPFX prompt for AI agents"
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
      {{ copied ? 'COPIED!' : failed ? 'FAILED' : 'COPY RSPFX PROMPT' }}
    </button>
  </div>
</template>
