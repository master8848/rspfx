<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useData } from 'vitepress'
import { getLocalMarkdownUrl } from '../utils/markdownUrl.js'
import { copyToClipboard } from '../utils/copy.js'
import { useCopyPreference } from '../composables/useCopyPreference.js'
import type { Pref } from '../composables/useCopyPreference.js'
import { useMarkdownCopy } from '../composables/useMarkdownCopy.js'
import { useAttachToTitle } from '../composables/useAttachToTitle.js'

const route = useRoute()
const { title, theme, frontmatter } = useData()

const shouldShow = computed(() => {
  // Frontmatter overrides theme: frontmatter.copyMarkdown ?? theme.copyMarkdown ?? true.
  // transformPageData sets frontmatter.copyMarkdown=false for /llm and /llms routes.
  const fmFlag = (frontmatter.value as Record<string, unknown>)?.copyMarkdown as boolean | undefined
  const themeFlag = (theme.value as Record<string, unknown>)?.copyMarkdown as boolean | undefined ?? true
  const flag = fmFlag ?? themeFlag
  if (flag === false) return false
  // Defensive path checks — keep even when frontmatter is set, for direct .html/.txt hits
  const p = route.path
  if (p === '/llms' || p === '/llm' || p === '/llms.html' || p === '/llm.html') return false
  if (p.includes('llms')) return false
  if (p === '/llm.txt' || p === '/llms.txt' || p.includes('llm.txt')) return false
  return true
})

const copied = ref(false)
const copying = ref(false)
const failed = ref(false)
const open = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

const { copyPreference, isHumanized, loadPref, savePref } = useCopyPreference()
const { localMarkdownUrl, copyMarkdown, getHumanizedMarkdown } = useMarkdownCopy(route, title)

const copyEl = ref<HTMLElement | null>(null)
useAttachToTitle(copyEl)

function setState(state: 'copied' | 'failed' | 'idle') {
  copied.value = state === 'copied'
  failed.value = state === 'failed'
  if (resetTimer) clearTimeout(resetTimer)
  if (state !== 'idle') {
    resetTimer = setTimeout(() => {
      copied.value = false
      failed.value = false
      copying.value = false
      resetTimer = null
    }, 2000)
  } else {
    resetTimer = null
  }
}

const mainAriaLabel = computed(() => {
  if (copied.value) return 'Copied!'
  if (failed.value) return 'Copy failed — try again'
  return isHumanized.value ? 'Copy page as humanized markdown' : 'Copy page as markdown'
})
const mainButtonTitle = computed(() => {
  if (copied.value) return 'Copied to clipboard'
  if (failed.value) return 'Copy failed'
  return isHumanized.value ? 'Copy' : 'Copy as Markdown'
})

function getPageUrl(): string {
  return typeof window !== 'undefined' ? window.location.href : localMarkdownUrl.value
}

const chatGptUrl = computed(() => {
  const url = getPageUrl()
  return `https://chatgpt.com/?hints=search&q=${encodeURIComponent(`Read ${url} so I can ask questions about it.`)}`
})
const claudeUrl = computed(() => `https://claude.ai/new?q=${encodeURIComponent(`Read ${getPageUrl()} so I can ask questions about it.`)}`)

function captureMarkdownCopied(format: Pref): void {
  if (!import.meta.env.VITE_POSTHOG_PROJECT_TOKEN || !import.meta.env.VITE_POSTHOG_HOST) return
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.capture('markdown_copied', { format })
  })
}

async function doCopy(getText: () => Promise<string>, format: Pref): Promise<void> {
  if (copying.value) return
  copying.value = true
  failed.value = false
  try {
    const text = await getText()
    await copyToClipboard(text)
    captureMarkdownCopied(format)
    setState('copied')
    open.value = false
  } catch {
    setState('failed')
  } finally {
    copying.value = false
  }
}

async function handleCopy() {
  const format: Pref = isHumanized.value ? 'humanized' : 'markdown'
  await doCopy(() => (format === 'humanized' ? getHumanizedMarkdown() : copyMarkdown()), format)
}

async function handleCopyWithPref(pref: Pref) {
  if (copying.value) return
  savePref(pref)
  await doCopy(() => (pref === 'humanized' ? getHumanizedMarkdown() : copyMarkdown()), pref)
}

function handleViewRaw() {
  if (typeof window === 'undefined') return
  // Open locally published markdown (buildEnd publishes .md alongside HTML)
  const local = getLocalMarkdownUrl(route.path)
  const url = local ? `${window.location.origin}${local}` : ''
  if (url) window.open(url, '_blank', 'noopener')
  open.value = false
}

function toggleOpen() { open.value = !open.value }
function closeMenu() { open.value = false }
function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!copyEl.value) return
  if (!copyEl.value.contains(target)) open.value = false
}
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') open.value = false }

onMounted(() => {
  loadPref()
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})
watch(() => route.path, () => { open.value = false })
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = null
})
</script>

<template>
  <div v-if="shouldShow" ref="copyEl" class="rspfx-copy-markdown">
    <div class="rspfx-copy-group" :class="{ open }">
      <button
        class="rspfx-copy-main"
        :class="{ copied, failed }"
        :disabled="copying"
        :aria-label="mainAriaLabel"
        :title="mainButtonTitle"
        @click="handleCopy"
      >
        <!-- Tabler: copy / check / alert-circle -->
        <svg v-if="!copied && !failed" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
        <svg v-else-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
      </button>
      <button
        class="rspfx-copy-trigger"
        :aria-expanded="open ? 'true' : 'false'"
        aria-haspopup="menu"
        aria-label="More copy options"
        @click.stop="toggleOpen"
      >
        <!-- Tabler: chevron-down -->
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M6 9l6 6l6 -6" /></svg>
      </button>
    </div>

    <Transition name="rspfx-copy-menu">
      <div v-if="open" class="rspfx-copy-menu" role="menu" @click.stop>
        <button class="rspfx-copy-menu-item" :class="{ 'is-active': isHumanized }" role="menuitem" @click="handleCopyWithPref('humanized')">
          <!-- Tabler: copy -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
          <span>Copy</span>
          <svg v-if="isHumanized" class="rspfx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
        </button>
        <button class="rspfx-copy-menu-item" :class="{ 'is-active': !isHumanized }" role="menuitem" @click="handleCopyWithPref('markdown')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
          <span>Copy as Markdown</span>
          <svg v-if="!isHumanized" class="rspfx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l5 5l10 -10" /></svg>
        </button>
        <button class="rspfx-copy-menu-item" role="menuitem" @click="handleViewRaw">
          <!-- Tabler: file -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 2h-6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-8z" /><path d="M14 2v6h6" /><path d="M10 13l2 2l4 -4" /></svg>
          <span>View as Markdown</span>
          <!-- Tabler: external-link -->
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
        </button>
        <div class="rspfx-copy-menu-sep" />
        <a class="rspfx-copy-menu-item" role="menuitem" :href="chatGptUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu">
          <!-- Tabler: message-circle / sparkles -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" /><path d="M9 8l-1 4l4 -1l1 4l4 -1" /></svg>
          <span>Open in ChatGPT</span>
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
        </a>
        <a class="rspfx-copy-menu-item" role="menuitem" :href="claudeUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu">
          <!-- Tabler: star -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
          <span>Open in Claude</span>
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
        </a>
      </div>
    </Transition>
  </div>
</template>
