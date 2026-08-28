/**
 * Pure helpers for markdown URLs — no Vue, no `document`/`window` unless passed as `origin`.
 * Keep import style with `.js` extension for consumers (VitePress convention).
 */

function normalizeRoutePath(input: string): string {
  return (input ?? '').trim()
}

export function getRel(routePath: string): string {
  const normalized = normalizeRoutePath(routePath)
  if (!normalized) return ''
  let rel = normalized.replace(/^\/docs\//, '').replace(/\.html$/, '').replace(/\/$/, '')
  if (!rel) return ''
  return rel
}

export function getLocalMarkdownUrl(routePath: string): string {
  const normalized = normalizeRoutePath(routePath)
  if (!normalized) return ''
  let path = normalized.replace(/\.html$/, '')
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

function normalizeOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined
  const trimmed = origin.trim().replace(/\/$/, '')
  if (!trimmed) return undefined
  try {
    return new URL(trimmed).origin
  } catch {
    // Allow origin like "https://example.com" without path; fallback to trimmed
    return trimmed
  }
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)]
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
  const normalizedInput = normalizeRoutePath(routePathOrRel)
  const normalizedLocalPath = localPath != null ? normalizeRoutePath(localPath) : undefined
  const derivedLocal = normalizedLocalPath ?? (normalizedInput ? getLocalMarkdownUrl(normalizedInput) : '')
  const effectiveLocal = derivedLocal || normalizedLocalPath || ''
  if (!effectiveLocal) return []
  const idxVariant = effectiveLocal.replace(/\.md$/, '/index.md')
  const mdAlias = `/md${effectiveLocal}`
  const mdAliasIdx = `/md${idxVariant}`
  const markdownAlias = `/markdown${effectiveLocal}`
  const markdownAliasIdx = `/markdown${idxVariant}`
  const rawOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : undefined)
  const resolvedOrigin = normalizeOrigin(rawOrigin)
  const relCandidates = [effectiveLocal, idxVariant, mdAlias, mdAliasIdx, markdownAlias, markdownAliasIdx]
  const candidates: string[] = []
  if (resolvedOrigin) {
    for (const rel of relCandidates) candidates.push(`${resolvedOrigin}${rel}`)
  } else {
    candidates.push(...relCandidates)
  }
  return dedupe(candidates)
}
