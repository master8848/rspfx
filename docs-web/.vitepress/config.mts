import { defineConfig } from 'vitepress'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsWebRoot = resolve(__dirname, '..')

export default defineConfig({
  title: 'RSPFX',
  titleTemplate: ':title — RSPFX',
  description: 'SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Vite default, Rsbuild & Rspack ready — same manifests, same .sppkg.',
  lang: 'en-US',
  cleanUrls: true,
  ignoreDeadLinks: true,
  appearance: true,
  srcDir: '.',
  outDir: './.vitepress/dist',
  sitemap: {
    hostname: 'https://rspfx.mbsks.me',
    transformItems: (items) =>
      items.filter((i) => !i.url.includes('real-tenant-validation') && !i.url.includes('supporting-a-new-spfx-version')),
  },
  head: [
    ['link', { rel: 'alternate', type: 'text/plain', href: '/llm.txt', title: 'LLM index (plain text)' }],
    ['link', { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'LLM index (detailed)' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#059669' }],
    ['script', {}, `(function(){try{var k='rspfx-theme',lk='rspfx-accent',v=localStorage.getItem(k)||localStorage.getItem(lk);if(!v){document.documentElement.setAttribute('data-accent','emerald');return;}if(v==='slate')v='slate-accent';var shadcnMap={'zinc':'zinc','slate':'slate','stone':'stone','gray':'gray','neutral':'neutral','red':'red','rose':'rose','orange':'orange','green':'green','blue-shadcn':'blue','yellow':'yellow','violet-shadcn':'violet'};var accentMap={'blue':null,'violet':'violet','emerald':'emerald','coral':'coral','slate-accent':'slate'};if(shadcnMap[v]){document.documentElement.setAttribute('data-theme',shadcnMap[v]);}else if(v in accentMap){var av=accentMap[v];if(av)document.documentElement.setAttribute('data-accent',av);}else if(v){document.documentElement.setAttribute('data-theme',v);} }catch(e){}} )()`],
    ['script', {}, `(function(){function p(){try{var y=new Date().getFullYear();var el=document.querySelector('.VPFooter .copyright');if(!el)return false;if(el.dataset.patched==='1'&&el.querySelector('a[href*="master8848"]'))return true;el.innerHTML='Copyright \\u00A9 '+y+' <a href="https://github.com/master8848" target="_blank" rel="noopener noreferrer">master8848</a>';el.dataset.patched='1';return true}catch(e){return false}}p();document.addEventListener('DOMContentLoaded',p);var t=setInterval(function(){if(p())clearInterval(t)},250);setTimeout(function(){clearInterval(t)},8000);try{new MutationObserver(p).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}window.addEventListener('popstate',p);window.addEventListener('hashchange',p);document.addEventListener('visibilitychange',p);})()`],

    ['meta', { name: 'author', content: 'RSPFX contributors' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'RSPFX' }],
    ['meta', { property: 'og:title', content: 'RSPFX — SPFx-compatible build toolchain' }],
    ['meta', { property: 'og:description', content: 'No Heft, no webpack, no gulp. Vite default — Rsbuild & Rspack ready. Same manifests, same .sppkg.' }],
    ['meta', { property: 'og:image', content: '/hero.svg' }],
    ['meta', { property: 'og:image:alt', content: 'RSPFX' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'RSPFX — SPFx-compatible build toolchain' }],
    ['meta', { name: 'twitter:description', content: 'Build SharePoint web parts without the old toolchain. Vite by default — Rsbuild & Rspack ready.' }],
    ['meta', { name: 'twitter:image', content: '/hero.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'RSPFX',
    // Minimal nav: sidebar holds all docs navigation; socialLinks + footer already expose GitHub/npm/Changelog.
    // Keeping top bar clean (logo left, search middle, appearance+accent+social right) avoids clutter and prevents outline overlap.
    nav: [],
    sidebar: {
      '/llms': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Why RSPFX', link: '/docs/why-rspfx' },
            { text: 'Getting Started', link: '/docs/getting-started' },
            { text: 'llms.txt', link: '/llms' },

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
          collapsed: true,
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
            { text: 'Performance', link: '/docs/performance' },
            { text: 'Roadmap', link: '/docs/roadmap' },
            { text: 'Why Not Migrate', link: '/docs/why-not-to-migrate' },
            { text: 'Roadblocks', link: '/docs/roadblocks' },
          ],
        },
      ],
      '/llm': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Why RSPFX', link: '/docs/why-rspfx' },
            { text: 'Getting Started', link: '/docs/getting-started' },
            { text: 'llms.txt', link: '/llms' },

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
          collapsed: true,
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
            { text: 'Performance', link: '/docs/performance' },
            { text: 'Roadmap', link: '/docs/roadmap' },
            { text: 'Why Not Migrate', link: '/docs/why-not-to-migrate' },
            { text: 'Roadblocks', link: '/docs/roadblocks' },
          ],
        },
      ],
      '/docs/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Why RSPFX', link: '/docs/why-rspfx' },
            { text: 'Getting Started', link: '/docs/getting-started' },
            { text: 'llms.txt', link: '/llms' },

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
          collapsed: true,
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
            { text: 'Performance', link: '/docs/performance' },
            { text: 'Roadmap', link: '/docs/roadmap' },
            { text: 'Why Not Migrate', link: '/docs/why-not-to-migrate' },
            { text: 'Roadblocks', link: '/docs/roadblocks' },
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
      options: { detailedView: true },
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    editLink: {
      pattern: 'https://github.com/master8848/rspfx/edit/main/docs-web/:path',
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
      copyright: `Copyright © ${new Date().getFullYear()} master8848`,
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
