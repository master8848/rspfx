/**
 * DOM → Markdown helpers. Pure except for optional `window.location.href` for Source footer.
 * `domToMarkdown` takes a container element so it is testable without querying `document`.
 */

function getTextContent(el: Element): string {
  const he = el as HTMLElement
  // innerText is layout-dependent and unavailable in some environments (e.g. JSDOM SSR)
  if (typeof he.innerText === 'string') return he.innerText
  return he.textContent ?? ''
}

export function inlineToMarkdown(el: Element): string {
  let out = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      out += (node.textContent ?? '')
    } else if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase()
      const elem = node as HTMLElement
      const inner = inlineToMarkdown(elem)
      const text = getTextContent(elem) || inner
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

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

function getHeadingMarkdown(el: Element, level: number): string | null {
  const t = getTextContent(el).replace(/\s*#\s*$/, '').trim()
  if (!t) return null
  return `${'#'.repeat(level)} ${t}`
}

export function domToMarkdown(docElement: Element | null | undefined, pageTitle: string): string {
  const doc = docElement
  if (!doc) return ''

  const lines: string[] = []
  const title = (pageTitle || '').trim()
  const hasH1 = !!doc.querySelector('h1')
  if (!hasH1 && title) {
    lines.push(`# ${title}`, '')
  }

  const selector = 'h1, h2, h3, h4, h5, h6, p, ul, ol, pre, blockquote, table, hr, div[class*="language-"]'
  const blocks = doc.querySelectorAll(selector)
  const seenPres = new Set<Element>()

  for (const el of Array.from(blocks)) {
    // Skip elements inside copy-markdown islands or doc header chrome
    if (el.closest('.rspfx-copy-markdown')) continue
    const headerAncestor = el.closest('.rspfx-doc-header')
    if (headerAncestor) {
      if (el.classList.contains('rspfx-doc-header')) continue
      // For descendants of header, skip — header content is chrome, not doc body
      if (headerAncestor !== el) continue
    }

    const tag = el.tagName.toLowerCase()
    if (tag === 'pre' && el.parentElement?.className.includes('language-')) {
      if (el.parentElement && seenPres.has(el.parentElement)) continue
    }

    if (tag.startsWith('h') && tag.length === 2) {
      const level = Number(tag[1])
      if (HEADING_LEVELS.includes(level as (typeof HEADING_LEVELS)[number])) {
        const md = getHeadingMarkdown(el, level)
        if (md) lines.push(md, '')
        continue
      }
    }
    if (tag === 'p') {
      // Already filtered by .rspfx-copy-markdown above; re-check for nested <p> inside island
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
      const text = getTextContent(el).trim()
      if (text) {
        const quoted = text.split('\n').map(l => `> ${l}`).join('\n')
        lines.push(quoted, '')
      }
    } else if (tag === 'hr') {
      lines.push('---', '')
    } else if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'))
      if (rows.length === 0) continue
      const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c =>
        inlineToMarkdown(c).trim().replace(/\|/g, '\\|')
      )
      if (headerCells.length) {
        lines.push(`| ${headerCells.join(' | ')} |`)
        lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`)
      }
      for (let i = 1; i < rows.length; i++) {
        const rowEl = rows[i]
        if (!rowEl) continue
        const cells = Array.from(rowEl.querySelectorAll('td, th')).map(c =>
          inlineToMarkdown(c).trim().replace(/\|/g, '\\|')
        )
        if (cells.length) lines.push(`| ${cells.join(' | ')} |`)
      }
      lines.push('')
    } else if (tag === 'pre' || el.className.includes('language-')) {
      const isWrapper = el.className.includes('language-')
      const preEl = isWrapper ? (el.querySelector('pre') ?? el) : el
      if (isWrapper) seenPres.add(el)
      const codeEl = preEl.querySelector('code') ?? preEl
      let code = getTextContent(codeEl) || codeEl.textContent || ''
      code = code.replace(/\n+$/, '')
      if (!code.trim()) continue
      let lang = ''
      const cls = isWrapper ? el.className : preEl.className
      const m = cls.match(/language-([a-z0-9_-]+)/i)
      if (m?.[1]) lang = m[1].toLowerCase()
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

/** Backward-compat wrapper that queries `.vp-doc` internally. */
export function domToMarkdownFromDocument(pageTitle?: string): string {
  if (typeof document === 'undefined') return ''
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''
  return domToMarkdown(doc, pageTitle ?? '')
}
