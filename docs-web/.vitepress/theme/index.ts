import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import AccentSwitcher from './components/AccentSwitcher.vue'
import CopyMarkdown from './components/CopyMarkdown.vue'
import HeroPrompt from './components/HeroPrompt.vue'
import PackageManagerTabs from './components/PackageManagerTabs.vue'
import HomeLanding from './components/HomeLanding.vue'
import HomePage from './components/HomePage.vue'
import './style.css'

const posthogReady = !import.meta.env.SSR
  ? (() => {
      const posthogProjectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
      const posthogHost = import.meta.env.VITE_POSTHOG_HOST

      if (posthogProjectToken && posthogHost) {
        return import('posthog-js').then(({ default: posthog }) => {
          posthog.init(posthogProjectToken, {
            api_host: posthogHost,
            defaults: '2026-01-30',
            capture_exceptions: {
              capture_unhandled_errors: true,
              capture_unhandled_rejections: true,
              capture_console_errors: false,
            },
          })
          return posthog
        })
      }

      if (import.meta.env.DEV) {
        const missingVariable = posthogProjectToken
          ? 'VITE_POSTHOG_HOST'
          : 'VITE_POSTHOG_PROJECT_TOKEN'
        throw new Error(
          `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
        )
      }

      return undefined
    })()
  : undefined

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
      'home-hero-actions-after': () => h(HeroPrompt),
    })
  },
  enhanceApp({ app }) {
    app.config.errorHandler = (error) => {
      void posthogReady?.then((posthog) => {
        posthog?.captureException(error)
      })
    }

    app.component('PackageManagerTabs', PackageManagerTabs)
    app.component('HomeLanding', HomeLanding)
    app.component('HomePage', HomePage)
  },
} satisfies Theme
