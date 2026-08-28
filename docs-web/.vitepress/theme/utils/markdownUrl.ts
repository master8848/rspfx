/**
 * Pure helpers for markdown URLs — no Vue, no `document`/`window` unless passed as `origin`.
 * Keep import style with `.js` extension for consumers (VitePress convention).
 */

export function getRel(routePath: string): string {
  let rel = routePath.replace(/^\/docs\//, '').replace(/\.html$/, '').replace(/\/$/, '')
  if (!rel) return ''
  return rel
}

export function getLocalMarkdownUrl(routePath: string): string {
  let path = routePath.replace(/\.html$/, '')
  if (path.endsWith('/')) path = path.slice(0, -1)
  if (!path) return ''
  return `${path}.md`
}

/**
 * Best Practice: raw markdown is published at `/md/<path>.md` on the same origin
 * (see `config.mts#buildEnd` which copies every public `.md` to `dist/md/<rel>`).
 * This is token-efficient — no DOM→markdown conversion — and mirrors
 * `/docs/building-packages` → `/md/docs/building-packages.md`.
 */
export function getMdUrl(routePath: string): string {
  const local = getLocalMarkdownUrl(routePath)
  if (!local) return ''
  return `/md${local}`
}

/** GitHub raw URL — kept for reference / fallback comment, not used for fetch by default. */
export function getMarkdownUrl(routePath: string): string {
  const rel = getRel(routePath)
  if (!rel) return ''
  return `https://raw.githubusercontent.com/master8848/rspfx/main/docs/${rel}.md`
}

/**
 * Candidates to try when fetching published markdown.
 * Since `config.mts#buildEnd` now publishes every public `.md` alongside HTML
 * (under `/markdown/` legacy alias and `/md/` same-origin alias), local fetch
 * is sufficient. GitHub raw is not tried by default to avoid CORS/rate-limit;
 * keep it documented here if a secondary fallback is ever desired.
 *
 * Best Practice: markdown at `/md/<path>.md` on same origin — e.g.
 * `/docs/building-packages` → `/md/docs/building-packages.md`.  Candidates
 * include both `/md/` (new, token-efficient) and `/markdown/` (legacy)
 * alongside direct `.md` and `/index.md` variants. No DOM→markdown
 * conversion needed.
 */
export function getMarkdownCandidates(
  routePathOrRel: string,
  origin?: string,
  localPath?: string,
): string[] {
  // Supports both signatures:
  // - getMarkdownCandidates(routePath, origin)
  // - getMarkdownCandidates(rel, origin, localPath) — spec variant
  const local = localPath ?? getLocalMarkdownUrl(routePathOrRel)
  // If caller passed a docs `rel` (e.g. "why-rspfx") and localPath is that rel's .md,
  // getLocalMarkdownUrl would have mis-handled it; trust explicit localPath in that case.
  // Fallback: if localPath was given and routePathOrRel doesn't start with '/', use it directly.
  const effectiveLocal = local || (localPath ?? '')
  if (!effectiveLocal) return []
  const idxVariant = effectiveLocal.replace(/\.md$/, '/index.md')
  const mdAlias = `/md${effectiveLocal}`
  const mdAliasIdx = `/md${idxVariant}`
  const markdownAlias = `/markdown${effectiveLocal}`
  const markdownAliasIdx = `/markdown${idxVariant}`
  const resolvedOrigin =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  const candidates: string[] = []
  if (resolvedOrigin) {
    candidates.push(`${resolvedOrigin}${effectiveLocal}`)
    candidates.push(`${resolvedOrigin}${idxVariant}`)
    candidates.push(`${resolvedOrigin}${mdAlias}`)
    candidates.push(`${resolvedOrigin}${mdAliasIdx}`)
    candidates.push(`${resolvedOrigin}${markdownAlias}`)
    candidates.push(`${resolvedOrigin}${markdownAliasIdx}`)
  } else {
    candidates.push(effectiveLocal, idxVariant, mdAlias, mdAliasIdx, markdownAlias, markdownAliasIdx)
  }
  return candidates
}
