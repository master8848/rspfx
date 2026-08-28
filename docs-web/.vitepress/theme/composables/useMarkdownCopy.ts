import { computed } from 'vue'
import type { Ref } from 'vue'
import { getLocalMarkdownUrl, getMarkdownCandidates } from '../utils/markdownUrl.js'
import { domToMarkdownFromDocument } from '../utils/domToMarkdown.js'
import { humanizeMarkdown } from '../utils/humanizeMarkdown.js'

export function useMarkdownCopy(
  route: { path: string },
  title: Ref<string>,
) {
  const localMarkdownUrl = computed(() => getLocalMarkdownUrl(route.path))

  async function fetchRawMarkdown(): Promise<string | null> {
    try {
      if (!localMarkdownUrl.value) return null
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined
      const candidates = getMarkdownCandidates(route.path, origin)
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
      // GitHub raw fallback intentionally not attempted — markdown is now published
      // locally via `config.mts#buildEnd` (see `markdownUrl.getMarkdownUrl` for reference).
      // Keeping fetch local avoids CORS/rate-limit and works offline in preview.
      return null
    } catch {
      return null
    }
  }

  async function copyMarkdown(): Promise<string> {
    let md = await fetchRawMarkdown()
    if (!md) md = domToMarkdownFromDocument(title.value)
    if (!md || !md.trim()) {
      const doc = typeof document !== 'undefined' ? document.querySelector('.vp-doc') : null
      md = doc ? (doc as HTMLElement).innerText : (typeof document !== 'undefined' ? document.body.innerText : '')
    }
    return md
  }

  async function getHumanizedMarkdown(): Promise<string> {
    let md = await fetchRawMarkdown()
    if (!md) md = domToMarkdownFromDocument(title.value)
    if (!md || !md.trim()) {
      const doc = typeof document !== 'undefined' ? document.querySelector('.vp-doc') : null
      md = doc ? (doc as HTMLElement).innerText : (typeof document !== 'undefined' ? document.body.innerText : '')
    }
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : undefined
      const sourceUrl = typeof window !== 'undefined' ? window.location.href : undefined
      return humanizeMarkdown(md, { baseUrl, sourceUrl })
    } catch {
      return md
    }
  }

  return { localMarkdownUrl, fetchRawMarkdown, copyMarkdown, getHumanizedMarkdown }
}
