export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function codeBlockHtml(code: string, lang = 'sh'): string {
  const esc = escapeHtml(code)
  // v-pre prevents Vue from interpreting {{ }} inside code (e.g. ${{ secrets.SPFX_TOKEN }})
  return `<div class="language-${lang} vp-adaptive-theme" v-pre><button title="Copy Code" class="copy"></button><span class="lang">${lang}</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code v-pre>${esc}</code></pre></div>`
}

export function pmTag(cmds: Record<string, string>): string {
  const json = JSON.stringify(cmds).replace(/'/g, '&#39;')
  return `<PackageManagerTabs :commands='${json}' />`
}

export function detectPM(content: string): string | null {
  const c = content.trim()
  const lines = c.split('\n')
  const hasGlobal = c.includes('npm i -g @mbsks/rspfx-cli') || c.includes('npm i -g @mbsks/rspfx')
  const isCodeGroupMixed = c.includes('rspfx new') && c.includes('npm i -g')
  if (isCodeGroupMixed) return null

  if (hasGlobal && lines.length > 1) {
    const pmLines: string[] = []
    const otherLines: string[] = []
    for (const line of lines) {
      if (line.includes('npm i -g @mbsks/rspfx-cli') || line.includes('npm i -g @mbsks/rspfx')) pmLines.push(line)
      else otherLines.push(line)
    }
    if (pmLines.length) {
      const pmHtml = pmTag({
        npm: 'npm i -g @mbsks/rspfx-cli',
        pnpm: 'pnpm add -g @mbsks/rspfx-cli',
        yarn: 'yarn global add @mbsks/rspfx-cli',
        bun: 'bun add -g @mbsks/rspfx-cli',
        deno: 'deno install -g npm:@mbsks/rspfx-cli',
      })
      const otherHtml = otherLines.length ? codeBlockHtml(otherLines.join('\n')) : ''
      return otherHtml ? `${pmHtml}\n${otherHtml}` : pmHtml
    }
  } else if (hasGlobal) {
    return pmTag({
      npm: 'npm i -g @mbsks/rspfx-cli',
      pnpm: 'pnpm add -g @mbsks/rspfx-cli',
      yarn: 'yarn global add @mbsks/rspfx-cli',
      bun: 'bun add -g @mbsks/rspfx-cli',
      deno: 'deno install -g npm:@mbsks/rspfx-cli',
    })
  }

  if (c.includes('npx skills add') || c.includes('skills add https://github.com/master8848/rspfx')) {
    return pmTag({
      npm: 'npx skills add https://github.com/master8848/rspfx --skill rspfx',
      pnpm: 'pnpm dlx skills add https://github.com/master8848/rspfx --skill rspfx',
      yarn: 'yarn dlx skills add https://github.com/master8848/rspfx --skill rspfx',
      bun: 'bunx skills add https://github.com/master8848/rspfx --skill rspfx',
      deno: 'deno run -A npm:skills add https://github.com/master8848/rspfx --skill rspfx',
    })
  }

  if (c.includes('--frozen-lockfile') || c.includes('npm ci')) {
    // handle multi-line yaml with rspfx doctor etc.
    if (lines.length > 1) {
      const out: string[] = []
      let pending: string[] = []
      const flushPending = () => {
        if (pending.length) { out.push(codeBlockHtml(pending.join('\n'), 'yaml')); pending = [] }
      }
      const pmHtml = pmTag({
        npm: 'npm ci',
        pnpm: 'pnpm install --frozen-lockfile',
        yarn: 'yarn --frozen-lockfile',
        bun: 'bun install --frozen-lockfile',
        deno: 'deno install --frozen',
      })
      for (const line of lines) {
        if (line.includes('--frozen-lockfile') || line.includes('npm ci')) {
          flushPending()
          out.push(pmHtml)
        } else if (line.trim()) {
          pending.push(line)
        }
      }
      flushPending()
      if (out.length) return out.join('\n')
    }
    return pmTag({
      npm: 'npm ci',
      pnpm: 'pnpm install --frozen-lockfile',
      yarn: 'yarn --frozen-lockfile',
      bun: 'bun install --frozen-lockfile',
      deno: 'deno install --frozen',
    })
  }

  if ((c.includes('create vite') || c.includes('create rsbuild')) && c.includes('@mbsks/rspfx-plugin')) {
    const isRsbuild = c.includes('create rsbuild')
    const createTag = isRsbuild
      ? pmTag({
          npm: 'npm create rsbuild@latest',
          pnpm: 'pnpm create rsbuild@latest',
          yarn: 'yarn create rsbuild@latest',
          bun: 'bun create rsbuild@latest',
          deno: 'deno run -A npm:create-rsbuild@latest',
        })
      : pmTag({
          npm: 'npm create vite@latest my-app -- --template react-ts',
          pnpm: 'pnpm create vite@latest my-app -- --template react-ts',
          yarn: 'yarn create vite@latest my-app -- --template react-ts',
          bun: 'bun create vite@latest my-app -- --template react-ts',
          deno: 'deno run -A npm:create-vite@latest my-app -- --template react-ts',
        })
    const addTag = pmTag({
      npm: 'npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      pnpm: 'pnpm add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      yarn: 'yarn add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      bun: 'bun add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      deno: 'deno add -D npm:@mbsks/rspfx-plugin npm:@mbsks/rspfx-cli',
    })
    const cdLine = lines.find((l) => l.trim().startsWith('cd '))
    if (cdLine) {
      return `${createTag}\n${codeBlockHtml(cdLine.trim())}\n${addTag}`
    }
    return `${createTag}\n${addTag}`
  }

  if (c.includes('create vite')) {
    // npm create vite@latest my-app -- --template react-ts (+ GH comment with alternatives)
    // Keep template and project name fixed to common example; tabs show PM-specific create commands
    return pmTag({
      npm: 'npm create vite@latest my-app -- --template react-ts',
      pnpm: 'pnpm create vite@latest my-app -- --template react-ts',
      yarn: 'yarn create vite@latest my-app -- --template react-ts',
      bun: 'bun create vite@latest my-app -- --template react-ts',
      deno: 'deno run -A npm:create-vite@latest my-app -- --template react-ts',
    })
  }

  if (c.includes('create rsbuild')) {
    return pmTag({
      npm: 'npm create rsbuild@latest',
      pnpm: 'pnpm create rsbuild@latest',
      yarn: 'yarn create rsbuild@latest',
      bun: 'bun create rsbuild@latest',
      deno: 'deno run -A npm:create-rsbuild@latest',
    })
  }

  if (c.includes('@mbsks/rspfx-plugin') && (c.includes('i -D @mbsks') || c.includes('add -D @mbsks'))) {
    return pmTag({
      npm: 'npm i -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      pnpm: 'pnpm add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      yarn: 'yarn add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      bun: 'bun add -D @mbsks/rspfx-plugin @mbsks/rspfx-cli',
      deno: 'deno add -D npm:@mbsks/rspfx-plugin npm:@mbsks/rspfx-cli',
    })
  }

  if (c.includes('tailwindcss @tailwindcss/postcss postcss')) {
    return pmTag({
      npm: 'npm i -D tailwindcss @tailwindcss/postcss postcss',
      pnpm: 'pnpm add -D tailwindcss @tailwindcss/postcss postcss',
      yarn: 'yarn add -D tailwindcss @tailwindcss/postcss postcss',
      bun: 'bun add -D tailwindcss @tailwindcss/postcss postcss',
      deno: 'deno add -D npm:tailwindcss npm:@tailwindcss/postcss npm:postcss',
    })
  }

  if (c.includes('add -D sass') || (c.includes('sass') && c.includes('or pnpm add -D'))) {
    return pmTag({
      npm: 'npm i -D sass',
      pnpm: 'pnpm add -D sass',
      yarn: 'yarn add -D sass',
      bun: 'bun add -D sass',
      deno: 'deno add -D npm:sass',
    })
  }

  if (c.includes('update @mbsks/rspfx-plugin') || (c.includes('pnpm update') && c.includes('yarn upgrade'))) {
    if (c.includes('@mbsks/rspfx-plugin') || c.includes('rspfx-plugin')) {
      return pmTag({
        npm: 'npm update @mbsks/rspfx-plugin',
        pnpm: 'pnpm update @mbsks/rspfx-plugin',
        yarn: 'yarn upgrade @mbsks/rspfx-plugin',
        bun: 'bun update @mbsks/rspfx-plugin',
        deno: 'deno update @mbsks/rspfx-plugin',
      })
    }
  }

  if (c.includes('or pnpm install') || (c.includes('bun install') && c.includes('or pnpm')) || c === 'bun install' || c === 'pnpm install' || c === 'npm install') {
    if (!c.includes('--frozen')) {
      if (c.includes('rspfx migrate') && c.includes('rspfx dev') && c.includes('bun install')) return null
      if (c.includes('rspfx migrate') && c.includes('bun install')) {
        const out: string[] = []
        let pending: string[] = []
        const flushPending = () => {
          if (pending.length) { out.push(codeBlockHtml(pending.join('\n'))); pending = [] }
        }
        const pmInstallTag = pmTag({ npm: 'npm install', pnpm: 'pnpm install', yarn: 'yarn', bun: 'bun install', deno: 'deno install' })
        const pmBuildTag = pmTag({ npm: 'npm run build', pnpm: 'pnpm build', yarn: 'yarn build', bun: 'bun run build', deno: 'deno task build' })
        for (const line of lines) {
          if (line.includes('bun install') && line.includes('or pnpm')) {
            flushPending()
            out.push(pmInstallTag)
          } else if (line.includes('or bun run build') || (line.includes('pnpm build') && line.includes('npm run build'))) {
            flushPending()
            if (line.trim().startsWith('rspfx build')) {
              out.push(codeBlockHtml('rspfx build'))
              out.push(pmBuildTag)
            } else {
              out.push(pmBuildTag)
            }
          } else if (line.trim()) {
            pending.push(line)
          }
        }
        flushPending()
        if (out.length) return out.join('\n')
        return pmInstallTag
      }
      if (lines.length === 1) {
        return pmTag({ npm: 'npm install', pnpm: 'pnpm install', yarn: 'yarn', bun: 'bun install', deno: 'deno install' })
      }
      return pmTag({ npm: 'npm install', pnpm: 'pnpm install', yarn: 'yarn', bun: 'bun install', deno: 'deno install' })
    }
  }

  if (c.includes('or bun run build') || (c.includes('pnpm build') && c.includes('npm run build'))) {
    return pmTag({ npm: 'npm run build', pnpm: 'pnpm build', yarn: 'yarn build', bun: 'bun run build', deno: 'deno task build' })
  }

  return null
}
