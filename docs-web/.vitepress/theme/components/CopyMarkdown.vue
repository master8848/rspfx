<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useData } from 'vitepress'

const route = useRoute()
const { frontmatter, title } = useData()

const copied = ref(false)
const copying = ref(false)
const failed = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

const isVisible = computed(() => {
  // hide on home page (index.md has layout: home)
  if ((frontmatter.value as Record<string, unknown>).layout === 'home') return false
  // only show on /docs/* pages; hide on index "/"
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
        // inline code — avoid double wrapping if already has backticks
        out += text.includes('`') ? '`` ' + text + ' ``' : '`' + text + '`'
      } else if (tag === 'strong' || tag === 'b') {
        out += '**' + inner + '**'
      } else if (tag === 'em' || tag === 'i') {
        out += '*' + inner + '*'
      } else if (tag === 'a') {
        const href = (elem as HTMLAnchorElement).href || elem.getAttribute('href') || ''
        // keep relative links as is; absolute already fine
        const displayHref = href ? (elem.getAttribute('href') ?? href) : ''
        // skip header-anchor links (#)
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

  // Prefer page title as h1 if present
  const pageTitle = (title.value || '').trim()
  // We'll let the DOM headings drive the markdown; avoid duplicating if h1 already in doc
  const hasH1 = !!doc.querySelector('h1')

  // If no h1 in doc but we have a title, prepend it (common for VitePress title fallback)
  // VitePress renders h1 from markdown # heading, so usually hasH1 is true; skip if true
  if (!hasH1 && pageTitle) {
    lines.push(`# ${pageTitle}`, '')
  }

  // Instead of tree walker, iterate over direct structure preserving order via query
  // We'll collect block elements in document order
  const blocks = doc.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote, table, hr, div[class*="language-"]'
  )

  // Deduplicate: div.language-* contains pre; prefer the wrapper and skip inner pre separately
  const seenPres = new Set<Element>()

  for (const el of Array.from(blocks)) {
    const tag = el.tagName.toLowerCase()

    // Skip elements hidden inside other blocks we already handled
    // e.g. pre inside div.language-* — handle only the wrapper
    if (tag === 'pre' && el.parentElement?.className.includes('language-')) {
      if (seenPres.has(el.parentElement)) continue
    }

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
      // skip empty or button-like paragraphs injected by component itself
      if (el.closest('.rspfx-copy-markdown')) continue
      const md = inlineToMarkdown(el).trim()
      if (md) lines.push(md, '')
    } else if (tag === 'ul') {
      // only top-level lists (skip nested we handle via li recursion)
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
      // code block: extract language and code text
      const isWrapper = el.className.includes('language-')
      const preEl = isWrapper ? el.querySelector('pre') ?? el : el
      if (isWrapper) seenPres.add(el)
      const codeEl = preEl.querySelector('code') ?? preEl
      let code = (codeEl as HTMLElement).innerText ?? codeEl.textContent ?? ''
      // Remove trailing newline added by VitePress copy button etc.
      code = code.replace(/\n+$/, '')
      if (!code.trim()) continue
      // Detect language from class: language-ts, language-js, etc.
      let lang = ''
      const cls = isWrapper ? el.className : preEl.className
      const m = cls.match(/language-([a-z0-9_-]+)/i)
      if (m) lang = m[1]
      lines.push(`\`\`\`${lang}`, code, '```', '')
    } else if (tag === 'div' && el.className.includes('language-')) {
      // already handled above
    }
  }

  // Trim trailing empty lines
  while (lines.length && lines[lines.length - 1] === '') lines.pop()

  // Append source link footer for attribution
  const url = typeof window !== 'undefined' ? window.location.href : ''
  if (url) {
    lines.push('', `---`, `Source: ${url}`)
  }

  return lines.join('\n')
}

async function fetchRawMarkdown(): Promise<string | null> {
  try {
    // route.path is like /docs/getting-started or /docs/plan-0.1.0/01-phase-0-baseline
    // raw file is at https://raw.githubusercontent.com/master8848/rspfx/main/docs/<relative>.md
    // Strip leading /docs/ and trailing .html
    let rel = route.path.replace(/^\/docs\//, '').replace(/\.html$/, '').replace(/\/$/, '')
    if (!rel) return null
    // VitePress cleanUrls: /docs/foo -> docs/foo.md ; keep subpaths
    // Handle docs subfolder like plan-0.1.0
    const candidates = [
      `https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}.md`,
      `https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}/index.md`,
    ]
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
  // fallback
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
    // Try GitHub raw first (best fidelity), fallback to DOM-derived markdown
    let md = await fetchRawMarkdown()
    if (!md) md = domToMarkdown()
    if (!md || !md.trim()) {
      // last resort: plain innerText
      const doc = document.querySelector('.vp-doc')
      md = doc ? (doc as HTMLElement).innerText : document.body.innerText
    }
    await copyToClipboard(md)
    setState('copied')
  } catch {
    setState('failed')
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <div v-if="isVisible" class="rspfx-copy-markdown">
    <button
      class="rspfx-copy-markdown-btn"
      :class="{ copied, failed }"
      :disabled="copying"
      :aria-label="copied ? 'Copied' : failed ? 'Copy failed, click to retry' : 'Copy page as markdown'"
      :title="copied ? 'Copied!' : 'Copy as markdown'"
      @click="handleCopy"
    >
      <!-- clipboard icon -->
      <svg v-if="!copied && !failed" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.7" />
        <path d="M5 15V9a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <!-- check icon -->
      <svg v-else-if="copied" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <!-- alert icon for failed -->
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.7" />
        <path d="M12 8v6M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span class="rspfx-copy-markdown-label">{{ copied ? 'Copied!' : failed ? 'Failed — retry' : copying ? 'Copying…' : 'Copy as markdown' }}</span>
    </button>
  </div>
</template>
