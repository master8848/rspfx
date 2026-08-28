export interface HumanizeOptions {
  baseUrl?: string
  sourceUrl?: string
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

function toMdHref(href: string, sourceUrl: string | undefined, baseOrigin: string | null): string {
  if (!href || href.startsWith('#')) return href
  if (/^[a-zA-Z]+:/.test(href)) {
    try {
      const u = new URL(href)
      if (baseOrigin && u.origin === baseOrigin) return `/md${u.pathname}${u.search}${u.hash}`
      return href
    } catch {
      return href
    }
  }
  const base = sourceUrl || (baseOrigin ?? undefined)
  if (!base) {
    if (href.startsWith('/')) return `/md${href}`
    return href
  }
  try {
    const resolved = new URL(href, base)
    if (baseOrigin && resolved.origin !== baseOrigin) return href
    return `/md${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return href
  }
}

function isTableSeparator(line: string): boolean {
  const t = line.trim()
  if (!t.includes('-')) return false
  if (!t.includes('|') && !t.includes('-')) return false
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(t)
}

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
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
  const baseOrigin = (opts.baseUrl ? getOrigin(opts.baseUrl) : null) ?? (opts.sourceUrl ? getOrigin(opts.sourceUrl) : null)
  const { text: prot, slots } = protectCodeSpans(text)
  let out = prot
  out = out.replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (match, p1: string, p2: string) => {
    const isImage = match.startsWith('!')
    const label = (p1 ?? '').trim()
    let raw = (p2 ?? '').trim()
    raw = raw.replace(/^</, '').replace(/>$/, '')
    const href = raw.split(/\s+/)[0]?.replace(/^<|>$/g, '') ?? ''
    if (!href || href.startsWith('#')) return label
    const display = toMdHref(href, opts.sourceUrl, baseOrigin)
    const key = `${label}→${display}`
    if (label && display && !seen.has(key)) {
      seen.add(key)
      refs.push({ text: label || display, href: display })
    }
    return label || (isImage ? '' : display)
  })
  out = out.replace(/<(https?:\/\/[^>]+)>/g, (_m, url: string) => {
    const href = url.trim()
    const display = toMdHref(href, opts.sourceUrl, baseOrigin)
    const key = `${href}→${display}`
    if (!seen.has(key)) {
      seen.add(key)
      refs.push({ text: href, href: display })
    }
    return href
  })
  return restoreCodeSpans(out, slots)
}

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

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] ?? '')) {
      const headerCells = splitRow(line).map(c => stripLinks(c.trim(), refs, seen, opts).trim())
      i += 1
      const dataRows: string[] = []
      let j = i + 1
      while (j < lines.length) {
        const nxt = lines[j] ?? ''
        if (!nxt.trim()) break
        if (!nxt.includes('|')) break
        if (isTableSeparator(nxt)) break
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

    if (trimmed === '') {
      if (out.length && out[out.length - 1] === '') continue
      out.push('')
      continue
    }

    const processed = stripLinks(line, refs, seen, opts)
    out.push(processed)
  }

  while (out.length && out[out.length - 1] === '') out.pop()

  const sourceUrl = opts.sourceUrl ?? ''
  const baseUrl = opts.baseUrl
  const baseOrigin = (baseUrl ? getOrigin(baseUrl) : null) ?? (sourceUrl ? getOrigin(sourceUrl) : null)
  const baseMd = baseOrigin ? baseOrigin + '/md/' : null

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
    } catch {}
  }

  if (sourceUrl || baseOrigin || refs.length > 0) {
    out.push('', '---')
    if (sourceUrl) out.push(`Source: ${sourceUrl}`)
    if (mdUrl) out.push(`MD: ${mdUrl}`)
    if (baseMd) out.push(`Base: ${baseMd}`)
    else if (baseOrigin) out.push(`Base: ${baseOrigin}`)
    if (mdPath) out.push(`Tip: fetch markdown via Base + relative md path or absolute /md route (${mdPath})`)
    if (refs.length > 0) {
      out.push('', 'References:')
      for (const r of refs) {
        const t = r.text.replace(/\s+/g, ' ').trim()
        const h = r.href.trim()
        out.push(`- ${t} → ${h}`)
      }
    }
  }

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
