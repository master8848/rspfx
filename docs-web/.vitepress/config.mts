import { defineConfig } from 'vitepress'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsWebRoot = resolve(__dirname, '..')

export default defineConfig({
  title: 'RSPFX',
  description: 'SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Works with Vite, Rsbuild, and Rspack.',
  lang: 'en-US',
  cleanUrls: true,
  ignoreDeadLinks: true,
  srcDir: '.',
  outDir: './.vitepress/dist',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0078d4' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'RSPFX — SPFx-compatible build toolchain' }],
    ['meta', { property: 'og:description', content: 'Replaces Heft + webpack + gulp. Vite default, Rsbuild & Rspack supported.' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'RSPFX',
    nav: [
      { text: 'Guide', link: '/docs/getting-started' },
      { text: 'Commands', link: '/docs/commands' },
      { text: 'Architecture', link: '/docs/architecture' },
      { text: 'Migration', link: '/docs/migrating-from-gulp-heft' },
      {
        text: 'Resources',
        items: [
          { text: 'GitHub', link: 'https://github.com/master8848/rspfx' },
          { text: 'Changelog', link: 'https://github.com/master8848/rspfx/blob/main/CHANGELOG.md' },
          { text: 'npm — rspfx-cli', link: 'https://www.npmjs.com/package/@mbsks/rspfx-cli' },
        ],
      },
    ],
    sidebar: {
      '/docs/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Introduction — Why RSPFX', link: '/docs/why-rspfx' },
            { text: 'Getting Started', link: '/docs/getting-started' },
            { text: 'Why Not Migrate (Yet)', link: '/docs/why-not-to-migrate' },
          ],
        },
        {
          text: 'Guide',
          collapsed: false,
          items: [
            { text: 'Command Reference', link: '/docs/commands' },
            { text: 'Project Structure', link: '/docs/project-structure' },
            { text: 'Building & Packaging', link: '/docs/building-packages' },
            { text: 'Deployment', link: '/docs/deployment' },
            { text: 'Teams & Outlook Install', link: '/docs/teams-outlook-install' },
            { text: 'Multi-webpart', link: '/docs/multi-webpart' },
            { text: 'Frameworks', link: '/docs/frameworks' },
            { text: 'Custom Framework', link: '/docs/custom-framework' },
            { text: 'Styling', link: '/docs/styling' },
            { text: 'Favicon & Assets', link: '/docs/favicon-and-assets' },
            { text: 'Fast Refresh', link: '/docs/fast-refresh' },
          ],
        },
        {
          text: 'Migration',
          collapsed: false,
          items: [
            { text: 'Migrating from SPFx', link: '/docs/migration-from-spfx' },
            { text: 'Migrating off gulp + Heft', link: '/docs/migrating-from-gulp-heft' },
            { text: 'Case Study — PnP Modern Search', link: '/docs/migration-case-study' },
            { text: 'Hybrid Dev Mode', link: '/docs/hybrid-dev' },
            { text: 'Upgrading SPFx Version', link: '/docs/upgrading-spfx-version' },
          ],
        },
        {
          text: 'Reference',
          collapsed: false,
          items: [
            { text: 'Architecture', link: '/docs/architecture' },
            { text: 'Internal API', link: '/docs/internal-api' },
            { text: 'Compatibility', link: '/docs/compatibility' },
            { text: 'Supporting a New SPFx Version', link: '/docs/supporting-a-new-spfx-version' },
            { text: 'Performance', link: '/docs/performance' },
            { text: 'Real-tenant Validation', link: '/docs/real-tenant-validation' },
            { text: 'Roadmap', link: '/docs/roadmap' },
            { text: 'Roadblocks', link: '/docs/roadblocks' },
            { text: 'Documentation Standards', link: '/docs/AGENTS' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/master8848/rspfx' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@mbsks/rspfx-cli' },
    ],
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    editLink: {
      pattern: 'https://github.com/master8848/rspfx/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    lastUpdated: {
      text: 'Last updated',
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present master8848 & RSPFX contributors',
    },
    returnToTopLabel: 'Return to top',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Appearance',
    lightModeSwitchTitle: 'Switch to light theme',
    darkModeSwitchTitle: 'Switch to dark theme',
  },
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },
  vite: {
    resolve: {
      preserveSymlinks: true,
      alias: [
        { find: /^vue\/server-renderer$/, replacement: resolve(docsWebRoot, 'node_modules/vue/server-renderer/index.mjs') },
        { find: /^vue$/, replacement: resolve(docsWebRoot, 'node_modules/vue/dist/vue.runtime.esm-bundler.js') },
        { find: /^@vue\/runtime-core$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js') },
        { find: /^@vue\/runtime-dom$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/runtime-dom/dist/runtime-dom.esm-bundler.js') },
        { find: /^@vue\/reactivity$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js') },
        { find: /^@vue\/shared$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/shared/dist/shared.esm-bundler.js') },
        { find: /^@vue\/server-renderer$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/server-renderer/dist/server-renderer.esm-bundler.js') },
        { find: /^@vue\/compiler-core$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/compiler-core/dist/compiler-core.esm-bundler.js') },
        { find: /^@vue\/compiler-dom$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/compiler-dom/dist/compiler-dom.esm-bundler.js') },
        { find: /^@vue\/compiler-sfc$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js') },
        { find: /^@vue\/compiler-ssr$/, replacement: resolve(docsWebRoot, 'node_modules/@vue/compiler-ssr/dist/compiler-ssr.cjs.js') },
      ],
    },
    server: {
      fs: {
        allow: [resolve(docsWebRoot, '..')],
      },
    },
  },
})
