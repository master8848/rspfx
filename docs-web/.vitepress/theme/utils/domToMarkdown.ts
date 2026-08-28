/**
 * DOM → Markdown helpers. Pure except for optional `window.location.href` for Source footer.
 * `domToMarkdown` takes a container element so it is testable without querying `document`.
 */

export function inlineToMarkdown(el: Element): string {
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

export function domToMarkdown(docElement: Element, pageTitle: string): string {
  const doc = docElement
  if (!doc) return ''

  const lines: string[] = []
  const title = (pageTitle || '').trim()
  const hasH1 = !!doc.querySelector('h1')
  if (!hasH1 && title) {
    lines.push(`# ${title}`, '')
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
    if (el.closest('.rspfx-doc-header')) {
      if (el.classList.contains('rspfx-doc-header')) continue
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
      const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(c =>
        inlineToMarkdown(c).trim().replace(/\|/g, '\\|')
      )
      if (headerCells.length) {
        lines.push(`| ${headerCells.join(' | ')} |`)
        lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`)
      }
      for (let i = 1; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll('td, th')).map(c =>
          inlineToMarkdown(c).trim().replace(/\|/g, '\\|')
        )
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

/** Backward-compat wrapper that queries `.vp-doc` internally. */
export function domToMarkdownFromDocument(pageTitle?: string): string {
  if (typeof document === 'undefined') return ''
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''
  return domToMarkdown(doc, pageTitle ?? '')
}
