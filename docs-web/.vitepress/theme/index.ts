import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import AccentSwitcher from './components/AccentSwitcher.vue'
import CopyMarkdown from './components/CopyMarkdown.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(AccentSwitcher),
      'doc-before': () => h(CopyMarkdown),
    })
  },
} satisfies Theme
