import { computed } from 'vue'
import type { Ref } from 'vue'
import { getLocalMarkdownUrl, getMarkdownCandidates } from '../utils/markdownUrl.js'
import { domToMarkdownFromDocument } from '../utils/domToMarkdown.js'
import { humanizeMarkdown } from '../utils/humanizeMarkdown.js'

const FALLBACK_ORIGIN = 'https://rspfx.mbsks.me'

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
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        try {
          timeoutId = setTimeout(() => controller.abort(), 3500)
          const res = await fetch(url, { signal: controller.signal })
          if (res.ok) {
            const text = await res.text()
            if (text && text.trim().length > 0) return text
          }
        } catch {
          // fetch aborted or network failure — try next candidate
        } finally {
          if (timeoutId !== undefined) clearTimeout(timeoutId)
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
    const sourceUrl =
      typeof window !== 'undefined' && window.location.href ? window.location.href : FALLBACK_ORIGIN + route.path
    const mdUrl = FALLBACK_ORIGIN + '/md' + route.path
    const base = FALLBACK_ORIGIN + '/md/'
    const mdPath = '/md' + route.path
    // Prepend header at start (replaces footer) — consistent with humanizer
    const header = `Source: ${sourceUrl}\nMD: ${mdUrl}\nBase: ${base}\nTip: fetch markdown via Base + relative md path or absolute /md route (${mdPath})\n---\n\n`
    return header + md.trimStart()
  }

  async function resolveBaseMarkdown(): Promise<string> {
    let md = await fetchRawMarkdown()
    // DOM fallback is legacy; markdown route /md makes it unnecessary, kept for offline preview only.
    if (!md) md = domToMarkdownFromDocument(title.value)
    if (!md || !md.trim()) {
      const doc = typeof document !== 'undefined' ? document.querySelector('.vp-doc') : null
      md = doc ? (doc as HTMLElement).innerText : (typeof document !== 'undefined' ? document.body.innerText : '')
    }
    if (!md) md = ''
    return md
  }

  async function copyMarkdown(): Promise<string> {
    let md = await resolveBaseMarkdown()
    // Always guarantee footer with Base/Source even for raw mode
    if (!md.includes('Source:')) md = ensureRawFooter(md)
    return md
  }

  async function getHumanizedMarkdown(): Promise<string> {
    const md = await resolveBaseMarkdown()
    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location.origin ? window.location.origin : FALLBACK_ORIGIN
      const sourceUrl =
        typeof window !== 'undefined' && window.location.href ? window.location.href : FALLBACK_ORIGIN + route.path
      return humanizeMarkdown(md, { baseUrl, sourceUrl })
    } catch {
      return md
    }
  }

  return { localMarkdownUrl, fetchRawMarkdown, copyMarkdown, getHumanizedMarkdown }
}
