import { onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute, onContentUpdated } from 'vitepress'

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let t: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...(args as any)), wait)
  }) as T
}

export function useAttachToTitle(copyElRef: Ref<HTMLElement | null>) {
  const route = useRoute()
  let mo: MutationObserver | null = null
  let timers: ReturnType<typeof setTimeout>[] = []

  function attachToTitle() {
    const copyEl = copyElRef.value ?? (document.querySelector('.rspfx-copy-markdown') as HTMLElement | null)
    const doc = document.querySelector('.vp-doc')
    if (!doc || !copyEl) return
    const style = window.getComputedStyle(copyEl)
    if (style.display === 'none') return
    const h1 = doc.querySelector('h1') as HTMLElement | null
    if (!h1) {
      if (copyEl.parentElement?.classList.contains('rspfx-doc-header')) {
        const header = copyEl.parentElement as HTMLElement
        const parent = header.parentNode as HTMLElement | null
        if (parent) {
          const headerH1 = header.querySelector('h1')
          if (headerH1) parent.insertBefore(headerH1, header)
          parent.insertBefore(copyEl, header)
          if (!header.querySelector('h1')) header.remove()
        }
      }
      return
    }
    const currentHeader = h1.parentElement
    if (currentHeader?.classList.contains('rspfx-doc-header') && currentHeader.contains(copyEl) && doc.contains(currentHeader)) return
    const oldHeader = copyEl.parentElement?.classList.contains('rspfx-doc-header') ? (copyEl.parentElement as HTMLElement) : null
    if (oldHeader && !doc.contains(oldHeader)) {
      document.body.appendChild(copyEl)
    } else if (oldHeader && oldHeader !== currentHeader) {
      const oldH1 = oldHeader.querySelector('h1')
      if (oldH1 && oldHeader.parentNode) oldHeader.parentNode.insertBefore(oldH1, oldHeader)
    }
    let header = doc.querySelector('.rspfx-doc-header') as HTMLElement | null
    if (header && !header.contains(h1)) {
      const parent = header.parentNode as HTMLElement | null
      const headerH1 = header.querySelector('h1')
      if (headerH1 && parent) parent.insertBefore(headerH1, header)
      if (!header.contains(copyEl) && parent) {
        header.remove()
        header = null
      } else if (header.contains(copyEl)) {
        header = null
      }
    }
    if (!header) {
      header = document.createElement('div')
      header.className = 'rspfx-doc-header'
      h1.parentNode?.insertBefore(header, h1)
      header.appendChild(h1)
    }
    if (!header.contains(copyEl)) header.appendChild(copyEl)
  }

  const debouncedAttach = debounce(() => attachToTitle(), 30)

  function scheduleAttach(delays: number[] = [50, 250, 600]) {
    for (const d of delays) {
      const t = setTimeout(attachToTitle, d)
      timers.push(t)
    }
  }

  onMounted(() => {
    nextTick(() => {
      attachToTitle()
      // Prefer VitePress content hook; keep MutationObserver as debounced fallback
      // for edge cases where onContentUpdated doesn't cover nested mutations.
      const doc = document.querySelector('.vp-doc')
      if (doc) {
        mo = new MutationObserver(() => debouncedAttach())
        mo.observe(doc, { childList: true, subtree: true })
      }
    })
    scheduleAttach([80, 300, 800])
  })

  // VitePress fires after each markdown content swap — more reliable than polling
  onContentUpdated(() => {
    nextTick(() => attachToTitle())
  })

  watch(
    () => route.path,
    () => {
      nextTick(() => scheduleAttach([50, 250, 600]))
    }
  )

  onBeforeUnmount(() => {
    if (mo) mo.disconnect()
    for (const t of timers) clearTimeout(t)
    timers = []
  })

  return { attachToTitle }
}
