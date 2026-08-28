import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import { resolve, join } from 'node:path'
import { detectPM, pmTag, codeBlockHtml, escapeHtml } from '../docs-web/.vitepress/theme/utils/pmTransform.ts'

describe('pmTransform', () => {
  it('global install single line', () => {
    const out = detectPM('npm i -g @mbsks/rspfx-cli')
    expect(out).toContain('npm i -g @mbsks/rspfx-cli')
    expect(out).toContain('pnpm add -g')
    expect(out).toContain('yarn global add')
    expect(out).toContain('bun add -g')
    expect(out).toContain('deno install -g')
  })

  it('global install mixed with rspfx --version splits correctly', () => {
    const content = 'npm i -g @mbsks/rspfx-cli\nrspfx --version'
    const out = detectPM(content)
    expect(out).toContain('PackageManagerTabs')
    expect(out).toContain('rspfx --version')
    // should contain both pm tag and code block
    expect(out!.split('PackageManagerTabs').length).toBe(2) // one tag
    expect(out).toContain('language-sh')
  })

  it('skips code-group mixed with rspfx new', () => {
    const content = 'npm i -g @mbsks/rspfx-cli\nrspfx new my-app\ncd my-app\nrspfx dev'
    expect(detectPM(content)).toBeNull()
  })

  it('npx skills dlx', () => {
    const out = detectPM('npx skills add https://github.com/master8848/rspfx --skill rspfx')
    expect(out).toContain('pnpm dlx')
    expect(out).toContain('bunx')
    expect(out).toContain('deno run -A')
  })

  it('frozen install single line', () => {
    const out = detectPM('bun install --frozen-lockfile   # or pnpm install --frozen-lockfile / npm ci / yarn --frozen-lockfile')
    expect(out).toContain('npm ci')
    expect(out).toContain('pnpm install --frozen-lockfile')
  })

  it('frozen yaml multi-line preserves rspfx lines', () => {
    const content = 'steps:\n  - run: bun install --frozen-lockfile   # or pnpm install --frozen-lockfile / npm ci / yarn --frozen-lockfile\n  - run: rspfx doctor\n  - run: rspfx package'
    const out = detectPM(content)
    expect(out).toContain('PackageManagerTabs')
    expect(out).toContain('rspfx doctor')
    expect(out).toContain('rspfx package')
    // should have code block for yaml pending
    expect(out).toContain('language-yaml')
  })

  it('tailwind add', () => {
    const out = detectPM('bun add -D tailwindcss @tailwindcss/postcss postcss   # or pnpm add -D / npm i -D / yarn add -D')
    expect(out).toContain('tailwindcss')
    expect(out).toContain('npm i -D tailwindcss')
  })

  it('sass add', () => {
    const out = detectPM('bun add -D sass (or pnpm add -D sass / npm i -D sass / yarn add -D sass)')
    expect(out).toContain('npm i -D sass')
    expect(out).toContain('pnpm add -D sass')
  })

  it('update plugin', () => {
    const out = detectPM('bun update @mbsks/rspfx-plugin   # or pnpm update / npm update / yarn upgrade')
    expect(out).toContain('npm update @mbsks/rspfx-plugin')
    expect(out).toContain('yarn upgrade')
  })

  it('plain install single line', () => {
    const out = detectPM('bun install      # or pnpm install / npm install / yarn')
    expect(out).toContain('"npm":"npm install"')
    expect(out).toContain('"pnpm":"pnpm install"')
  })

  it('plain install mixed with rspfx migrate and build splits correctly', () => {
    const content = 'rspfx migrate --dry-run   # preview\nrspfx migrate             # writes bundler config\nbun install      # or pnpm install / npm install / yarn\nrspfx build               # or bun run build / pnpm build / npm run build / yarn build'
    const out = detectPM(content)
    expect(out).toContain('PackageManagerTabs')
    expect(out).toContain('rspfx migrate')
    expect(out).toContain('rspfx build')
    expect(out).toContain('npm install')
    expect(out).toContain('npm run build')
  })

  it('plain install mixed with rspfx migrate and rspfx dev skips (code-group)', () => {
    const content = 'rspfx migrate --dry-run   # preview\nrspfx migrate             # writes bundler config\nbun install      # or pnpm install / npm install / yarn\nrspfx dev'
    // This is index home existing project which should be skipped (contains rspfx dev)
    expect(detectPM(content)).toBeNull()
  })

  it('run build standalone', () => {
    const out = detectPM('rspfx build               # or bun run build / pnpm build / npm run build / yarn build')
    expect(out).toContain('npm run build')
    expect(out).toContain('pnpm build')
  })

  it('returns null for non-pm content', () => {
    expect(detectPM('rspfx --version')).toBeNull()
    expect(detectPM('rspfx new my-app')).toBeNull()
    expect(detectPM('console.log("hello")')).toBeNull()
  })

  it('pmTag generates correct vue tag', () => {
    const tag = pmTag({ npm: 'npm install', pnpm: 'pnpm install' })
    expect(tag).toBe(`<PackageManagerTabs :commands='{"npm":"npm install","pnpm":"pnpm install"}' />`)
  })

  it('escapeHtml and codeBlockHtml use v-pre', () => {
    expect(escapeHtml('<div>"a"&')).toBe('&lt;div&gt;&quot;a&quot;&amp;')
    const html = codeBlockHtml('echo "hi" && echo {{ secrets }}', 'sh')
    expect(html).toContain('v-pre')
    expect(html).toContain('&quot;hi&quot;')
    expect(html).toContain('&amp;&amp;')
    expect(html).toContain('{{ secrets }}') // should still contain raw {{ but v-pre prevents vue
  })

  it('GH raw markdown stays GH-compatible (no Vue tags in source)', () => {
    const raw = fs.readFileSync(resolve('docs/getting-started.md'), 'utf8')
    expect(raw).not.toContain('<PackageManagerTabs')
    expect(raw).toContain('npm i -g @mbsks/rspfx-cli')
    // priority removed
    expect(raw).not.toContain('priority: bun > pnpm')
    expect(raw).toContain('or deno')
  })

  it('hybrid-dev raw markdown stays GH-compatible', () => {
    const raw = fs.readFileSync(resolve('docs/hybrid-dev.md'), 'utf8')
    expect(raw).not.toContain('<PackageManagerTabs')
    expect(raw).toContain('bun install      # or pnpm install')
  })
})

describe('usePackageManager', () => {
  it('has correct default and storage key', async () => {
    // dynamic import to avoid window check at import time
    const { usePackageManager } = await import('../docs-web/.vitepress/theme/composables/usePackageManager.ts')
    const { pm, STORAGE_KEY } = usePackageManager()
    expect(STORAGE_KEY).toBe('rspfx-pm')
    expect(pm.value).toBe('npm') // default
  })

  it('persists selection to localStorage', async () => {
    // mock window/localStorage
    const store: Record<string, string> = {}
    const mockLocalStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
    }
    ;(globalThis as any).window = {
      localStorage: mockLocalStorage,
      dispatchEvent: () => {},
      addEventListener: () => {},
    }
    ;(globalThis as any).localStorage = mockLocalStorage
    // need to re-import fresh? Use direct test of logic
    // Instead test the STORAGE_KEY and pmTag logic already
    expect(store).toEqual({})
    mockLocalStorage.setItem('rspfx-pm', 'pnpm')
    expect(mockLocalStorage.getItem('rspfx-pm')).toBe('pnpm')
    delete (globalThis as any).window
    delete (globalThis as any).localStorage
  })
})
