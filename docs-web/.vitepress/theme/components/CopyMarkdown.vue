<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useData } from 'vitepress'

const route = useRoute()
const { frontmatter, title } = useData()

const copied = ref(false)
const copying = ref(false)
const failed = ref(false)
const open = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const isVisible = computed(() => {
  if ((frontmatter.value as Record<string, unknown>).layout === 'home') return false
  if (route.path === '/' || route.path === '/index.html') return false
  return route.path.startsWith('/docs/')
})

function setState(state: 'copied' | 'failed' | 'idle') {
  copied.value = state === 'copied'
  failed.value = state === 'failed'
  if (resetTimer) clearTimeout(resetTimer)
  if (state !== 'idle') {
    resetTimer = setTimeout(() => {
      copied.value = false
      failed.value = false
      copying.value = false
    }, 2000)
  }
}

// — markdown url helpers —
function getRel(): string {
  let rel = route.path.replace(/^\/docs\//, '').replace(/\.html$/, '').replace(/\/$/, '')
  // cleanUrls: /docs/foo -> docs/foo.md
  // also handle /docs/ -> empty
  if (!rel) return ''
  return rel
}

function getMarkdownUrl(): string {
  const rel = getRel()
  if (!rel) return ''
  return `https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}.md`
}

function getLocalMarkdownUrl(): string {
  // Try same-origin .md (if we ever expose raw md via vite transform)
  // /docs/getting-started -> /docs/getting-started.md
  let path = route.path.replace(/\.html$/, '')
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path) return ''
  return `${path}.md`
}

const markdownUrl = computed(() => getMarkdownUrl())
const localMarkdownUrl = computed(() => getLocalMarkdownUrl())

const chatGptUrl = computed(() => {
  const url = typeof window !== 'undefined' ? window.location.href : markdownUrl.value
  const prompt = `Read ${url} so I can ask questions about it.`
  return `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`
})

const claudeUrl = computed(() => {
  const url = typeof window !== 'undefined' ? window.location.href : markdownUrl.value
  const prompt = `Read ${url} so I can ask questions about it.`
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
})

function inlineToMarkdown(el: Element): string {
  let out = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      out += (node.textContent ?? '')
    } else if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase()
      const elem = node as HTMLElement
      const inner = inlineToMarkdown(elem)
      const text = elem.innerText ?? inner
      if (tag === 'code') {
        out += text.includes('`') ? '`` ' + text + ' ``' : '`' + text + '`'
      } else if (tag === 'strong' || tag === 'b') {
        out += '**' + inner + '**'
      } else if (tag === 'em' || tag === 'i') {
        out += '*' + inner + '*'
      } else if (tag === 'a') {
        const href = (elem as HTMLAnchorElement).href || elem.getAttribute('href') || ''
        const displayHref = elem.getAttribute('href') ?? href
        if (displayHref.startsWith('#')) out += inner
        else if (displayHref) out += `[${inner}](${displayHref})`
        else out += inner
      } else if (tag === 'br') {
        out += '\n'
      } else {
        out += inner
      }
    }
  }
  return out
}

function domToMarkdown(): string {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''

  const lines: string[] = []
  const pageTitle = (title.value || '').trim()
  const hasH1 = !!doc.querySelector('h1')
  if (!hasH1 && pageTitle) {
    lines.push(`# ${pageTitle}`, '')
  }

  const blocks = doc.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote, table, hr, div[class*="language-"]'
  )
  const seenPres = new Set<Element>()

  for (const el of Array.from(blocks)) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'pre' && el.parentElement?.className.includes('language-')) {
      if (seenPres.has(el.parentElement)) continue
    }
    if (el.closest('.rspfx-copy-markdown')) continue

    if (tag === 'h1') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`# ${t}`, '')
    } else if (tag === 'h2') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`## ${t}`, '')
    } else if (tag === 'h3') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`### ${t}`, '')
    } else if (tag === 'h4') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`#### ${t}`, '')
    } else if (tag === 'h5') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`##### ${t}`, '')
    } else if (tag === 'h6') {
      const t = (el as HTMLElement).innerText.replace(/\s*#\s*$/, '').trim()
      if (t) lines.push(`###### ${t}`, '')
    } else if (tag === 'p') {
      if (el.closest('.rspfx-copy-markdown')) continue
      const md = inlineToMarkdown(el).trim()
      if (md) lines.push(md, '')
    } else if (tag === 'ul') {
      if (el.parentElement?.closest('li')) continue
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        const md = inlineToMarkdown(li).trim().replace(/\n/g, ' ')
        if (md) lines.push(`- ${md}`)
      }
      lines.push('')
    } else if (tag === 'ol') {
      if (el.parentElement?.closest('li')) continue
      let idx = 1
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        const md = inlineToMarkdown(li).trim().replace(/\n/g, ' ')
        if (md) lines.push(`${idx}. ${md}`)
        idx++
      }
      lines.push('')
    } else if (tag === 'blockquote') {
      const text = (el as HTMLElement).innerText.trim()
      if (text) {
        const quoted = text.split('\n').map(l => `> ${l}`).join('\n')
        lines.push(quoted, '')
      }
    } else if (tag === 'hr') {
      lines.push('---', '')
    } else if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'))
      if (rows.length === 0) continue
      const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c => inlineToMarkdown(c).trim().replace(/\|/g, '\\|'))
      if (headerCells.length) {
        lines.push(`| ${headerCells.join(' | ')} |`)
        lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`)
      }
      for (let i = 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c => inlineToMarkdown(c).trim().replace(/\|/g, '\\|'))
        if (cells.length) lines.push(`| ${cells.join(' | ')} |`)
      }
      lines.push('')
    } else if (tag === 'pre' || el.className.includes('language-')) {
      const isWrapper = el.className.includes('language-')
      const preEl = isWrapper ? el.querySelector('pre') ?? el : el
      if (isWrapper) seenPres.add(el)
      const codeEl = preEl.querySelector('code') ?? preEl
      let code = (codeEl as HTMLElement).innerText ?? codeEl.textContent ?? ''
      code = code.replace(/\n+$/, '')
      if (!code.trim()) continue
      let lang = ''
      const cls = isWrapper ? el.className : preEl.className
      const m = cls.match(/language-([a-z0-9_-]+)/i)
      if (m) lang = m[1]
      lines.push(`\`\`\`${lang}`, code, '```', '')
    }
  }

  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  const url = typeof window !== 'undefined' ? window.location.href : ''
  if (url) {
    lines.push('', `---`, `Source: ${url}`)
  }
  return lines.join('\n')
}

async function fetchRawMarkdown(): Promise<string | null> {
  try {
    const rel = getRel()
    if (!rel) return null
    const candidates: string[] = []
    // 1) same-origin .md (if vite exposes it)
    if (typeof window !== 'undefined') {
      candidates.push(`${window.location.origin}${localMarkdownUrl.value}`)
      candidates.push(`${window.location.origin}${localMarkdownUrl.value.replace(/\.md$/, '/index.md')}`)
    }
    // 2) GitHub raw (primary fidelity)
    candidates.push(`https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}.md`)
    candidates.push(`https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}/index.md`)

    for (const url of candidates) {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 3500)
      try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(t)
        if (res.ok) {
          const text = await res.text()
          if (text && text.trim().length > 0) return text
        }
      } catch {
        clearTimeout(t)
      }
    }
    return null
  } catch {
    return null
  }
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

async function handleCopy() {
  if (copying.value) return
  copying.value = true
  failed.value = false
  try {
    let md = await fetchRawMarkdown()
    if (!md) md = domToMarkdown()
    if (!md || !md.trim()) {
      const doc = document.querySelector('.vp-doc')
      md = doc ? (doc as HTMLElement).innerText : document.body.innerText
    }
    await copyToClipboard(md)
    setState('copied')
    open.value = false
  } catch {
    setState('failed')
  } finally {
    copying.value = false
  }
}

function handleViewRaw() {
  const url = markdownUrl.value
  if (url) window.open(url, '_blank', 'noopener')
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
}

function closeMenu() {
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  const root = document.querySelectorAll('.rspfx-copy-markdown')
  let inside = false
  root.forEach(r => { if (r.contains(target)) inside = true })
  if (!inside) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
  if (resetTimer) clearTimeout(resetTimer)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <div v-if="isVisible" class="rspfx-copy-markdown">
    <div class="rspfx-copy-group" :class="{ open }">
      <button
        class="rspfx-copy-main"
        :class="{ copied, failed }"
        :disabled="copying"
        :aria-label="copied ? 'Copied' : failed ? 'Copy failed' : 'Copy page'"
        :title="copied ? 'Copied!' : 'Copy page as markdown'"
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
        <span class="rspfx-copy-label">{{ copied ? 'Copied!' : failed ? 'Failed — retry' : copying ? 'Copying…' : 'Copy page' }}</span>
      </button>
      <button
        class="rspfx-copy-trigger"
        :aria-expanded="open ? 'true' : 'false'"
        aria-haspopup="menu"
        aria-label="More copy options"
        @click.stop="toggleOpen"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <Transition name="rspfx-copy-menu">
      <div v-if="open" class="rspfx-copy-menu" role="menu" @click.stop>
        <button class="rspfx-copy-menu-item" role="menuitem" @click="handleCopy">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.6" />
            <path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <span>Copy as Markdown</span>
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
