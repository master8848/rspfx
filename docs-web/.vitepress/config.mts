import { defineConfig } from 'vitepress'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import { detectPM } from './theme/utils/pmTransform.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsWebRoot = resolve(__dirname, '..')

// Shared sidebar — used for /docs/, /llm and /llms. Keep single source to avoid drift.
const docsSidebar = [
  {
    text: 'Getting Started',
    collapsed: false,
    items: [
      { text: 'Why RSPFx', link: '/docs/why-rspfx' },
      { text: 'Getting Started', link: '/docs/getting-started' },
      { text: 'Demos', link: '/docs/demos' },
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
      { text: 'React 19', link: '/docs/react-19' },
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
      { text: 'Security', link: '/docs/security' },
      { text: 'Internal API', link: '/docs/internal-api' },
      { text: 'Compatibility', link: '/docs/compatibility' },
      { text: 'Performance', link: '/docs/performance' },
      { text: 'Roadmap', link: '/docs/roadmap' },
      { text: 'Why Not Migrate', link: '/docs/why-not-to-migrate' },
      { text: 'Roadblocks', link: '/docs/roadblocks' },
    ],
  },
] as const

export default defineConfig({
  title: 'RSPFx',
  titleTemplate: ':title — RSPFx',
  description: 'SPFx-compatible build toolchain. Replaces Heft + webpack + gulp. Vite default, Rsbuild & Rspack ready — same manifests, same .sppkg.',
  lang: 'en-US',
  cleanUrls: true,
  ignoreDeadLinks: true,
  appearance: true,
  srcDir: '.',
  outDir: './.vitepress/dist',
  // Publish raw markdown alongside HTML so LLMs / curl can fetch e.g. /docs/why-rspfx.md,
  // /markdown/docs/*.md (legacy alias) and /md/docs/*.md (token-efficient same-origin alias).
  // Runs at build end after VitePress emits HTML.
  buildEnd: async (siteConfig) => {
    const srcDir = siteConfig.srcDir
    const outDir = siteConfig.outDir
    const mdFiles: string[] = []

    const skipDirs = new Set(['node_modules', 'public', '.git'])

    function walk(dir: string) {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.')) continue
        if (skipDirs.has(ent.name)) continue
        const full = join(dir, ent.name)
        let stat: fs.Stats
        try {
          stat = fs.statSync(full)
        } catch {
          continue
        }
        if (stat.isDirectory()) {
          walk(full)
        } else if (stat.isFile() && ent.name.endsWith('.md')) {
          mdFiles.push(full)
        }
      }
    }

    walk(srcDir)

    let count = 0
    for (const src of mdFiles) {
      const rel = relative(srcDir, src)
      // Disabled pages (llm.md / llms.md / any llm* prefix) must NOT be published
      // as raw markdown — mirrors transformPageData disabling copyMarkdown.
      if (rel === 'llm.md' || rel === 'llms.md' || rel.startsWith('llm')) continue
      // Primary: same path as route + .md  (e.g. docs/why-rspfx.md -> dist/docs/why-rspfx.md)
      // Alias:   /markdown/<rel>            (e.g. docs/why-rspfx.md -> dist/markdown/docs/why-rspfx.md)
      // New:    /md/<rel>                  (e.g. docs/why-rspfx.md -> dist/md/docs/why-rspfx.md)
      //         Same-origin, token-efficient: /docs/building-packages -> /md/docs/building-packages.md
      //         Canonical is with .md extension; candidates fallback handles /index.md variants.
      const dests = [join(outDir, rel), join(outDir, 'markdown', rel), join(outDir, 'md', rel)]
      for (const dest of dests) {
        fs.mkdirSync(dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
      }
      count++
    }
    // Production fallback for extensionless /md/* (e.g. /md/docs/getting-started -> /md/docs/getting-started.md)
    // Dev middleware handles this via candidates; static hosting needs rewrites + headers.
    // Generate _redirects (Cloudflare Pages/Workers) and _headers so VitePress 404.html never intercepts /md/*.
    try {
      const redirectLines: string[] = []
      const seenNoExt = new Set<string>()
      for (const src of mdFiles) {
        const rel = relative(srcDir, src)
        if (rel === 'llm.md' || rel === 'llms.md' || rel.startsWith('llm')) continue
        const noExt = rel.replace(/\.md$/, '')
        const from = `/md/${noExt}`
        const to = `/md/${rel}`
        if (seenNoExt.has(from)) continue
        seenNoExt.add(from)
        redirectLines.push(`${from} ${to} 200`)
        // Also handle trailing-slash variant for index-like files (e.g. /md/docs/ -> /md/docs/index.md handled via explicit file, but add alias for safety)
        if (noExt.endsWith('/index')) {
          const dir = noExt.slice(0, -'/index'.length)
          const fromDir = dir ? `/md/${dir}` : '/md'
          const dirKey = `${fromDir}/`
          if (!seenNoExt.has(dirKey)) {
            seenNoExt.add(dirKey)
            redirectLines.push(`${fromDir} ${to} 200`)
            redirectLines.push(`${fromDir}/ ${to} 200`)
          }
        }
      }
      // Ensure /md -> /md/index.md
      if (!seenNoExt.has('/md')) {
        redirectLines.unshift('/md /md/index.md 200')
      }
      if (redirectLines.length) {
        const redirectsPath = join(outDir, '_redirects')
        fs.writeFileSync(redirectsPath, redirectLines.join('\n') + '\n', 'utf8')
        console.log(`[markdown-publish] Wrote ${redirectLines.length} redirect(s) to ${redirectsPath}`)
      }
      const headersPath = join(outDir, '_headers')
      // Minimal: /*.md covers all raw markdown (dist/*.md, dist/md/*.md, dist/markdown/*.md).
      // Extensionless /md/* served via _redirects rewrite or Worker already sets header, so avoid duplicate.
      const headersContent = `/*.md\n  Content-Type: text/markdown; charset=utf-8\n  X-Content-Type-Options: nosniff\n`
      fs.writeFileSync(headersPath, headersContent, 'utf8')
      console.log(`[markdown-publish] Wrote headers to ${headersPath}`)
    } catch (e) {
      console.warn('[markdown-publish] Failed to write _redirects/_headers', e)
    }
    console.log(`[markdown-publish] Published ${count} markdown file(s) to ${outDir} (+ markdown/ and md/ aliases)`)
  },
  // Disable copy-markdown button on llm routes (llm.md / llms.md) via frontmatter.
  // Per-page override: frontmatter `copyMarkdown: false` hides the button.
  // Global override: `themeConfig.copyMarkdown = false` hides it everywhere (default true).
  transformPageData(pageData) {
    // pageData.relativePath is e.g. 'llms.md', 'llm.md', 'docs/xxx.md'
    if (pageData.relativePath === 'llms.md' || pageData.relativePath === 'llm.md' || pageData.relativePath.startsWith('llm')) {
      pageData.frontmatter.copyMarkdown = false
    }
  },
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
    ['script', {}, `(function(){try{var k='rspfx-pm',v=localStorage.getItem(k);if(v&&['npm','pnpm','yarn','bun','deno'].includes(v)){document.documentElement.setAttribute('data-pm',v);window.__RSPFX_PM=v;}}catch(e){}} )()`],
    ['script', {}, `(function(){function p(){try{var y=new Date().getFullYear();var el=document.querySelector('.VPFooter .copyright');if(!el)return false;if(el.dataset.patched==='1'&&el.querySelector('a[href*="master8848"]'))return true;el.innerHTML='Copyright \\u00A9 '+y+' <a href="https://github.com/master8848" target="_blank" rel="noopener noreferrer">master8848</a>';el.dataset.patched='1';return true}catch(e){return false}}p();document.addEventListener('DOMContentLoaded',p);var t=setInterval(function(){if(p())clearInterval(t)},250);setTimeout(function(){clearInterval(t)},8000);try{new MutationObserver(p).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}window.addEventListener('popstate',p);window.addEventListener('hashchange',p);document.addEventListener('visibilitychange',p);})()`],

    ['meta', { name: 'author', content: 'RSPFx contributors' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'RSPFx' }],
    ['meta', { property: 'og:title', content: 'RSPFx — SPFx-compatible build toolchain' }],
    ['meta', { property: 'og:description', content: 'No Heft, no webpack, no gulp. Vite default — Rsbuild & Rspack ready. Same manifests, same .sppkg.' }],
    ['meta', { property: 'og:image', content: '/hero.svg' }],
    ['meta', { property: 'og:image:alt', content: 'RSPFx' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'RSPFx — SPFx-compatible build toolchain' }],
    ['meta', { name: 'twitter:description', content: 'Build SharePoint web parts without the old toolchain. Vite by default — Rsbuild & Rspack ready.' }],
    ['meta', { name: 'twitter:image', content: '/hero.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'RSPFx',
    // Copy-markdown button: theme-level flag, defaults to true when omitted.
    // Set `copyMarkdown: false` here to hide globally. Per-page `frontmatter.copyMarkdown`
    // (auto-set for /llm and /llms via transformPageData) overrides this.
    // Component checks: frontmatter.copyMarkdown ?? theme.copyMarkdown ?? true
    copyMarkdown: true as unknown as boolean,
    nav: [
      { text: 'Docs', link: '/docs/getting-started' },
      { text: 'Guide', link: '/docs/commands' },
      { text: 'Why RSPFx', link: '/docs/why-rspfx' },
    ],
    sidebar: {
      '/llms': docsSidebar as any,
      '/llm': docsSidebar as any,
      '/docs/': docsSidebar as any,
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
    config(md) {
      const origFence = md.renderer.rules.fence?.bind(md.renderer.rules) ?? ((tokens: any, idx: number, opts: any, env: any, slf: any) => slf.renderToken(tokens, idx, opts))
      md.renderer.rules.fence = (tokens: any, idx: number, options: any, env: any, slf: any) => {
        const token = tokens[idx] as any
        const info = (token.info || '').trim()
        const content: string = token.content || ''
        // only transform sh/shell/bash blocks that contain pm patterns, not ts/js/json etc.
        const lang = info.split(/\s+/)[0]?.toLowerCase() ?? ''
        const isShell = !lang || ['sh', 'shell', 'bash', 'zsh', 'yaml', 'yml'].includes(lang)
        // also handle yaml CI blocks that contain pm install
        if (isShell || lang === 'yaml' || lang === 'yml') {
          const repl = detectPM(content)
          if (repl) return repl
        }
        // fallback to original
        return (origFence as any)(tokens, idx, options, env, slf)
      }
    },
  },
  vite: {
    // Dev: pure markdown dump for /md/* — no HTML / docs UI, universal fallback so 404 is never thrown for valid markdown.
    // Production: buildEnd publishes to dist/md/*.md and dist/<rel>.md as static files; hosts must serve /md/* as static
    // and must NOT rewrite /md/* to 404.html / index.html SPA fallback. Dev middleware below mirrors that behavior.
    plugins: [
      {
        name: 'rspfx-md-pure',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            try {
              if (!req.url || !req.method) return (next as any)()
              if (req.method !== 'GET' && req.method !== 'HEAD') return (next as any)()
              let url = req.url.split('?')[0] ?? ''
              url = url.split('#')[0] ?? url
              try {
                url = decodeURIComponent(url)
              } catch {
                // keep raw url if decode fails
              }
              if (url !== '/md' && !url.startsWith('/md/')) return (next as any)()
              // Strip leading /md
              let rel = url.slice(3)
              if (rel.startsWith('/')) rel = rel.slice(1)
              if (!rel) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                res.end('Not found')
                return
              }
              const isDisabled = (r: string) => r === 'llm.md' || r === 'llms.md' || r.startsWith('llm')
              if (isDisabled(rel) || isDisabled(rel + '.md')) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                res.end('Not found')
                return
              }
              const srcDirAbs = docsWebRoot
              const candidates: string[] = []
              if (rel.endsWith('.md')) {
                candidates.push(join(srcDirAbs, rel))
              } else {
                candidates.push(join(srcDirAbs, `${rel}.md`))
                candidates.push(join(srcDirAbs, join(rel, 'index.md')))
                candidates.push(join(srcDirAbs, rel))
              }
              let found: string | null = null
              let content: string | null = null
              for (const cand of candidates) {
                const resolved = resolve(cand)
                if (!resolved.startsWith(srcDirAbs)) continue
                const candRel = relative(srcDirAbs, resolved)
                if (isDisabled(candRel)) {
                  res.statusCode = 404
                  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                  res.end('Not found')
                  return
                }
                try {
                  const stat = fs.statSync(resolved)
                  if (!stat.isFile()) continue
                  // Pure markdown — no VitePress transform, no HTML wrapper
                  content = fs.readFileSync(resolved, 'utf8')
                  found = resolved
                  break
                } catch {
                  continue
                }
              }
              if (found && content !== null) {
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
                if (req.method === 'HEAD') {
                  res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'))
                  res.end()
                } else {
                  res.end(content)
                }
                return
              }
              // Not found — plain text 404, never docs UI
              res.statusCode = 404
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Not found')
              return
            } catch {
              return (next as any)()
            }
          })
        },
      },
    ],
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
