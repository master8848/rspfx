import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import AccentSwitcher from './components/AccentSwitcher.vue'
import CopyMarkdown from './components/CopyMarkdown.vue'
import './style.css'

// auto-load extra shadcn themes — drop a `.css` file into `themes/` (see themes/README.md)
// `_`-prefixed files are ignored (e.g. _example.css)
import.meta.glob('./themes/[^_]*.css', { eager: true })

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(AccentSwitcher),
      // desktop: in right aside above "On this page" (VitePress slot `aside-outline-before`)
      // mobile: fallback in doc top (aside is hidden < 960px) — CSS toggles visibility
      'doc-before': () => h(CopyMarkdown),
      'aside-outline-before': () => h(CopyMarkdown),
    })
  },
} satisfies Theme
