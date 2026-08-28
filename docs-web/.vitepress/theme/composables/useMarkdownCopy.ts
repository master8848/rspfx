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
      // Candidates now include /md alias (same-origin, token-efficient) — see markdownUrl.ts
      // No DOM→markdown conversion needed when /md/<path>.md is available.
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
      // locally via `config.mts#buildEnd` at both /markdown/ (legacy) and /md/ (new).
      // Keeping fetch local avoids CORS/rate-limit and works offline in preview.
      return null
    } catch {
      return null
    }
  }

  function ensureRawFooter(md: string): string {
    if (md.includes('Source:')) return md
    const fallbackOrigin = 'https://rspfx.mbsks.me'
    const sourceUrl =
      typeof window !== 'undefined' && window.location.href ? window.location.href : fallbackOrigin + route.path
    const mdUrl = fallbackOrigin + '/md' + route.path
    const base = fallbackOrigin + '/md/'
    const mdPath = '/md' + route.path
    // Prepend header at start (replaces footer) — consistent with humanizer
    const header = `Source: ${sourceUrl}\nMD: ${mdUrl}\nBase: ${base}\nTip: fetch markdown via Base + relative md path or absolute /md route (${mdPath})\n---\n\n`
    return header + md.trimStart()
  }

  async function copyMarkdown(): Promise<string> {
    let md = await fetchRawMarkdown()
    // DOM fallback is legacy; markdown route /md makes it unnecessary, kept for offline preview only.
    if (!md) md = domToMarkdownFromDocument(title.value)
    if (!md || !md.trim()) {
      const doc = typeof document !== 'undefined' ? document.querySelector('.vp-doc') : null
      md = doc ? (doc as HTMLElement).innerText : (typeof document !== 'undefined' ? document.body.innerText : '')
    }
    if (!md) md = ''
    // Always guarantee footer with Base/Source even for raw mode
    if (!md.includes('Source:')) md = ensureRawFooter(md)
    return md
  }

  async function getHumanizedMarkdown(): Promise<string> {
    let md = await fetchRawMarkdown()
    // DOM fallback is legacy; markdown route /md makes it unnecessary, kept for offline preview only.
    if (!md) md = domToMarkdownFromDocument(title.value)
    if (!md || !md.trim()) {
      const doc = typeof document !== 'undefined' ? document.querySelector('.vp-doc') : null
      md = doc ? (doc as HTMLElement).innerText : (typeof document !== 'undefined' ? document.body.innerText : '')
    }
    try {
      const fallbackOrigin = 'https://rspfx.mbsks.me'
      const baseUrl =
        typeof window !== 'undefined' && window.location.origin ? window.location.origin : fallbackOrigin
      const sourceUrl =
        typeof window !== 'undefined' && window.location.href ? window.location.href : fallbackOrigin + route.path
      return humanizeMarkdown(md, { baseUrl, sourceUrl })
    } catch {
      return md
    }
  }

  return { localMarkdownUrl, fetchRawMarkdown, copyMarkdown, getHumanizedMarkdown }
}
