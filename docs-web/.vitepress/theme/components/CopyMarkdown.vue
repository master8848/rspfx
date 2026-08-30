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
      </button>
      <button
        class="rspfx-copy-trigger"
        :aria-expanded="open ? 'true' : 'false'"
        aria-haspopup="menu"
        aria-label="More copy options"
        @click.stop="toggleOpen"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <Transition name="rspfx-copy-menu">
      <div v-if="open" class="rspfx-copy-menu" role="menu" @click.stop>
        <button class="rspfx-copy-menu-item" :class="{ 'is-active': isHumanized }" role="menuitem" @click="handleCopyWithPref('humanized')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.6" />
            <path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <span>Copy</span>
          <svg v-if="isHumanized" class="rspfx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="rspfx-copy-menu-item" :class="{ 'is-active': !isHumanized }" role="menuitem" @click="handleCopyWithPref('markdown')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.6" />
            <path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <span>Copy as Markdown</span>
          <svg v-if="!isHumanized" class="rspfx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="rspfx-copy-menu-item" role="menuitem" @click="handleViewRaw">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            <path d="M14 2v6h6M10 13H8M16 17H8M13 13h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <span>View as Markdown</span>
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5h6v6M5 13v6h6M13 5l8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <div class="rspfx-copy-menu-sep" />
        <a class="rspfx-copy-menu-item" role="menuitem" :href="chatGptUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 5.3 18.4L12 22l-5.3-1.6A10 10 0 0 0 12 2z" stroke="currentColor" stroke-width="1.6"/>
            <path d="M8.5 9.5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zM13.5 14.5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zM8.5 14.5c0 1.1.9 2 2 2s2-.9 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>Open in ChatGPT</span>
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5h6v6M5 13v6h6M13 5l8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
        <a class="rspfx-copy-menu-item" role="menuitem" :href="claudeUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.9 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
          <span>Open in Claude</span>
          <svg class="rspfx-external" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5h6v6M5 13v6h6M13 5l8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </div>
    </Transition>
  </div>
</template>
