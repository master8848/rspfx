export interface HumanizeOptions {
  baseUrl?: string
  sourceUrl?: string
  /**
   * Fence style for code blocks.
   * - 'single' (default): use single backtick + lang (e.g. `yaml ... `) — saves ~2 tokens per fence vs ``` in many LLM tokenizers
   * - 'triple': keep original ``` / ~~~ fences
   */
  fence?: 'single' | 'triple'
}

type LinkRef = { text: string; href: string }

function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function relativize(href: string, base: string | undefined): string {
  if (!href || href.startsWith('#')) return href
  if (/^[a-zA-Z]+:/.test(href) && !href.startsWith('/')) {
    // absolute URL with scheme — try to relativize if same origin as base
    if (!base) return href
    try {
      const b = new URL(base)
      const u = new URL(href)
      if (u.origin === b.origin) return u.pathname + u.search + u.hash
      return href
    } catch {
      return href
    }
  }
  // already relative or root-relative — keep as is
  // but if base is absolute and href is absolute path, keep path
  if (base && href.startsWith('/') ) {
    try {
      const b = new URL(base)
      const u = new URL(href, b.origin)
      if (u.origin === b.origin) return u.pathname + u.search + u.hash
    } catch {}
  }
  return href
}

function isTableSeparator(line: string): boolean {
  const t = line.trim()
  // | --- | --- |  or  --- | ---   or  :-- | --: etc
  if (!t.includes('-')) return false
  if (!t.includes('|') && !t.includes('-')) return false
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(t)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  // naive split on | not handling \| or code — good enough for docs tables
  return s.split('|').map(c => c.trim())
}

function protectCodeSpans(text: string): { text: string; slots: string[] } {
  const slots: string[] = []
  const protectedText = text.replace(/``[^`]*``|`[^`]*`/g, m => {
    const i = slots.length
    slots.push(m)
    return `__CODE_${i}__`
  })
  return { text: protectedText, slots }
}

function restoreCodeSpans(text: string, slots: string[]): string {
  return text.replace(/__CODE_(\d+)__/g, (_, i) => slots[Number(i)] ?? '')
}

function stripLinks(
  text: string,
  refs: LinkRef[],
  seen: Set<string>,
  opts: HumanizeOptions,
): string {
  const { text: prot, slots } = protectCodeSpans(text)
  let out = prot
  // ![alt](url) and [text](url)
  out = out.replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (match, p1: string, p2: string) => {
    const isImage = match.startsWith('!')
    const label = (p1 ?? '').trim()
    let raw = (p2 ?? '').trim()
    // strip title after url: url may be `url "title"` — take first token, strip < >
    raw = raw.replace(/^</, '').replace(/>$/, '')
    const href = raw.split(/\s+/)[0]?.replace(/^<|>$/g, '') ?? ''
    if (!href || href.startsWith('#')) return label
    // skip empty label for images? keep alt
    const display = relativize(href, opts.baseUrl ?? opts.sourceUrl)
    const key = `${label}→${display}`
    if (label && display && !seen.has(key)) {
      seen.add(key)
      refs.push({ text: label || display, href: display })
    }
    // for images keep alt text only
    return label || (isImage ? '' : display)
  })
  // bare autolinks <https://...>  -> extract?
  out = out.replace(/<(https?:\/\/[^>]+)>/g, (_m, url: string) => {
    const href = url.trim()
    const display = relativize(href, opts.baseUrl ?? opts.sourceUrl)
    const key = `${href}→${display}`
    if (!seen.has(key)) {
      seen.add(key)
      refs.push({ text: href, href: display })
    }
    return href
  })
  return restoreCodeSpans(out, slots)
}

/**
 * Small, zero-dep markdown humanizer.
 * - Headings: h1-h3 → `#`, h4-h6 → `##` (2 levels only)
 * - Tables → bullets (`- h1: v1 · h2: v2`)
 * - Links → reference list with Base + relative hrefs (token-saving)
 * - Code fences → single-backtick + lang (e.g. `yaml ... `) instead of ``` (saves ~2 tokens per fence in many LLM tokenizers)
 * Input is a markdown string; output is also markdown but compact for humans/agents.
 */
export function humanizeMarkdown(markdown: string, opts: HumanizeOptions = {}): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  const refs: LinkRef[] = []
  const seen = new Set<string>()
  let inFence = false
  let fenceMarker = ''

  const useSingleFence = opts.fence !== 'triple'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // fence detection — convert ``` / ~~~ to single-backtick fences for token saving
    // ``` is ~3 tokens in many LLM tokenizers, ` is 1
    const fenceMatch = trimmed.match(/^(```|~~~)(.*)$/)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      const info = (fenceMatch[2] ?? '').trim()
      if (!inFence) {
        inFence = true
        fenceMarker = marker
        if (useSingleFence) {
          const lang = info.split(/\s+/)[0] ?? ''
          out.push('`' + lang)
        } else {
          out.push(line)
        }
        continue
      } else if (trimmed.startsWith(fenceMarker)) {
        inFence = false
        fenceMarker = ''
        out.push(useSingleFence ? '`' : line)
        continue
      }
    }
    if (inFence) {
      out.push(line)
      continue
    }

    // heading: collapse to 2 levels
    const hm = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (hm) {
      const level = hm[1]!.length
      let content = (hm[2] ?? '').trim()
      if (!content) continue
      content = stripLinks(content, refs, seen, opts)
      const prefix = level <= 3 ? '# ' : '## '
      out.push(prefix + content)
      out.push('')
      continue
    }

    // table: header + separator + rows
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? '')) {
      const headerCells = splitRow(line).map(c => stripLinks(c.trim(), refs, seen, opts).trim())
      // skip separator
      i += 1
      const dataRows: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nxt = lines[j] ?? ''
        if (!nxt.trim()) break
        if (!nxt.includes('|')) break
        if (isTableSeparator(nxt)) break
        // stop if next line looks like fence or heading — but fence already handled
        dataRows.push(nxt)
        j++
      }
      if (dataRows.length === 0) {
        for (const h of headerCells) if (h) out.push(`- ${h}`)
        if (headerCells.length) out.push('')
      } else {
        for (const row of dataRows) {
          const cells = splitRow(row).map(c => stripLinks(c.trim(), refs, seen, opts).trim().replace(/\s+/g, ' '))
          if (!cells.length || cells.every(c => !c)) continue
          if (headerCells.length === cells.length && headerCells.length > 0) {
            const parts = headerCells.map((h, idx) => (h ? `${h}: ${cells[idx]}` : cells[idx] ?? ''))
            out.push(`- ${parts.join(' · ')}`)
          } else {
            const joined = cells.filter(Boolean).join(' · ')
            if (joined) out.push(`- ${joined}`)
          }
        }
        out.push('')
      }
      i = j - 1
      continue
    }

    // normal line — strip links but keep other markup
    if (trimmed === '') {
      // collapse multiple blanks later; keep one
      if (out.length && out[out.length - 1] === '') continue
      out.push('')
      continue
    }

    // for any other line, just strip links inline
    const processed = stripLinks(line, refs, seen, opts)
    out.push(processed)
  }

  // trim trailing blanks
  while (out.length && out[out.length - 1] === '') out.pop()

  const sourceUrl = opts.sourceUrl ?? ''
  const baseUrl = opts.baseUrl
  const baseOrigin = (baseUrl ? getOrigin(baseUrl) : null) ?? (sourceUrl ? getOrigin(sourceUrl) : null)

  // Derive markdown route for /md alias: /docs/foo.html or /docs/foo/ → /md/docs/foo
  // Keep dot-md variant as fallback hint (origin+pathname+'.md') but primary is token-efficient /md path.
  let mdUrl: string | null = null
  let mdPath: string | null = null
  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl)
      let pathname = u.pathname
      if (pathname.endsWith('.html')) pathname = pathname.slice(0, -5)
      if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
      mdPath = `/md${pathname}`
      mdUrl = u.origin + mdPath
    } catch {
      // sourceUrl not absolute — no MD derivation
    }
  }

  // Always emit Base (origin) and current location so relative links like `../` or next-page can be resolved.
  // Previously this only emitted Base when refs existed and sourceUrl present — losing location when 0 refs.
  if (sourceUrl || baseOrigin || refs.length > 0) {
    out.push('', '---')
    if (sourceUrl) out.push(`Source: ${sourceUrl}`)
    if (mdUrl) out.push(`MD: ${mdUrl}`)
    if (baseOrigin) out.push(`Base: ${baseOrigin}`)
    if (mdPath) out.push(`Tip: fetch markdown via ${mdPath} or append .md to any path`)
    if (refs.length > 0) {
      out.push('', 'References:')
      for (const r of refs) {
        const t = r.text.replace(/\s+/g, ' ').trim()
        const h = r.href.trim()
        out.push(`- ${t} → ${h}`)
      }
    }
  }

  // collapse excessive blank lines to max 1
  const collapsed: string[] = []
  let blank = 0
  for (const l of out) {
    if (l === '') {
      blank++
      if (blank <= 1) collapsed.push(l)
    } else {
      blank = 0
      collapsed.push(l)
    }
  }
  return collapsed.join('\n')
}
