#!/usr/bin/env node
// Convert raw shadcn-compatible css files (`:root` / `.dark`) to RSPFX drop-in themes
// Usage: node scripts/convert-shadcn-theme.mjs ./raw/*.css --out docs-web/.vitepress/theme/themes/
//        node scripts/convert-shadcn-theme.mjs --help
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { basename, resolve, join } from 'node:path'

function help() {
  console.log(`Usage: convert-shadcn-theme.mjs <input.css...> [--out <dir>] [--force]

Converts :root {--primary:...} / .dark {--primary:...} files to:

  /* theme-meta: label="Foo" color="#rrggbb" */
  html[data-theme="foo"] { ... }
  html[data-theme="foo"].dark { ... }

- File name becomes theme id (my-theme.css -> data-theme="my-theme")
- If header already contains html[data-theme], file is copied as-is (with theme-meta injected if missing)
- Color is derived from --primary (HSL triple -> hex) if not provided
`)
}

function hslTripleToHex(triple) {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/)
  if (!m) return null
  const h = Number(m[1]) / 360, s = Number(m[2]) / 100, l = Number(m[3]) / 100
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let r,g,b
  if (s === 0) r=g=b=l
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p,q,h+1/3); g = hue2rgb(p,q,h); b = hue2rgb(p,q,h-1/3)
  }
  const toHex = x => Math.round(x*255).toString(16).padStart(2,'0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
function titleCase(id){ return id.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h') || args.length===0) { help(); process.exit(args.length===0?1:0) }

let outDir = 'docs-web/.vitepress/theme/themes'
let force = false
const inputs = []
for (let i=0;i<args.length;i++){
  if (args[i]==='--out') outDir = args[++i]
  else if (args[i]==='--force') force = true
  else if (!args[i].startsWith('-')) inputs.push(args[i])
  else { console.error(`unknown flag ${args[i]}`); process.exit(1) }
}
mkdirSync(outDir, { recursive: true })

for (const inp of inputs) {
  const raw = readFileSync(inp, 'utf8')
  const base = basename(inp).replace(/\.css$/i,'')
  const id = base.replace(/[^a-z0-9-_]/gi,'-').toLowerCase() || 'theme'
  const outPath = join(outDir, `${id}.css`)
  if (existsSync(outPath) && !force) {
    console.warn(`skip ${outPath} exists (use --force)`)
    continue
  }
  // already wrapped? copy with meta injection if missing
  if (raw.includes(`html[data-theme="${id}"]`) || raw.includes('html[data-theme=')) {
    let out = raw
    if (!out.includes('theme-meta:')) {
      const pm = out.match(/--primary\s*:\s*([^;]+);/)
      const hex = pm ? hslTripleToHex(pm[1].trim()) : null
      const color = hex ?? '#71717a'
      const label = titleCase(id)
      out = `/* theme-meta: label="${label}" color="${color}" */\n` + out
    }
    writeFileSync(outPath, out)
    console.log(`copied ${inp} -> ${outPath} (already wrapped)`)
    continue
  }

  // extract :root and .dark blocks (also supports :root, .dark with commas)
  const rootMatch = raw.match(/:root\s*\{([\s\S]*?)\}/)
  const darkMatch = raw.match(/\.dark\s*\{([\s\S]*?)\}/)
  const lightBody = rootMatch ? rootMatch[1].trim() : ''
  const darkBody = darkMatch ? darkMatch[1].trim() : ''

  // fallback: if no :root, treat whole file as light body (strip comments)
  const fallbackBody = !rootMatch && !darkMatch ? raw.replace(/\/\*[\s\S]*?\*\//g,'').trim() : ''

  const light = lightBody || fallbackBody
  const dark = darkBody || ''

  if (!light && !dark) {
    console.warn(`skip ${inp}: no :root/.dark found`)
    continue
  }

  // derive color/label
  const pm = (light || dark).match(/--primary\s*:\s*([^;]+);/)
  const hex = pm ? hslTripleToHex(pm[1].trim()) : null
  const color = hex ?? '#71717a'
  const label = titleCase(id)

  // build wrapped file — include hero vars if not present
  const hasHeroBg = light.includes('--vp-home-hero-name-background')
  const heroLight = hasHeroBg ? '' : `  --vp-home-hero-name-background: linear-gradient(120deg, hsl(var(--primary)) 22%, hsl(262 83% 68%) 48%, hsl(346 77% 60%) 82%);\n  --vp-home-hero-image-background-image: linear-gradient(135deg, hsl(var(--primary) / 0.14), hsl(262 83% 58% / 0.14), hsl(346 77% 50% / 0.12));`
  const hasHeroDark = dark.includes('--vp-home-hero-name-background')
  const heroDark = hasHeroDark || !dark ? '' : `  --vp-home-hero-name-background: linear-gradient(120deg, hsl(var(--primary)) 18%, hsl(263 70% 70%) 52%, hsl(346 77% 65%) 85%);`

  let out = `/* theme-meta: label="${label}" color="${color}" */\n`
  out += `/* auto-converted from ${basename(inp)} — edit label/color above if needed */\n`
  if (light) {
    out += `html[data-theme="${id}"] {\n${light.includes('--') ? '  ' + light.replace(/\n/g,'\n  ').trim() : '  ' + light}\n`
    if (heroLight) out += `${heroLight}\n`
    out += `}\n`
  }
  if (dark) {
    out += `html[data-theme="${id}"].dark {\n  ${dark.replace(/\n/g,'\n  ').trim()}\n`
    if (heroDark) out += `${heroDark}\n`
    out += `}\n`
  } else if (light) {
    // if no dark, duplicate light for dark with same vars (so theme works in dark mode)
    out += `html[data-theme="${id}"].dark {\n  ${light.replace(/\n/g,'\n  ').trim()}\n}\n`
  }

  writeFileSync(outPath, out)
  console.log(`wrote ${outPath} (label="${label}" color="${color}")`)
}
