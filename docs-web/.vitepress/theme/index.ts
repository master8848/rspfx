import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import AccentSwitcher from './components/AccentSwitcher.vue'
import CopyMarkdown from './components/CopyMarkdown.vue'
import PackageManagerTabs from './components/PackageManagerTabs.vue'
import './style.css'

// auto-load extra shadcn themes — drop a `.css` file into `themes/` (see themes/README.md)
// `_`-prefixed files are ignored (e.g. _example.css)
import.meta.glob('./themes/[^_]*.css', { eager: true })

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(AccentSwitcher),
      // Center: above doc content (Bun-style split button, always visible on docs pages)
      'doc-before': () => h(CopyMarkdown),
    })
  },
  enhanceApp({ app }) {
    app.component('PackageManagerTabs', PackageManagerTabs)
  },
} satisfies Theme
