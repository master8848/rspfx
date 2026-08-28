/**
 * Cloudflare Worker for rspfx docs — ensures /md/* serves pure markdown
 * and never falls back to VitePress 404.html (which would block raw md).
 *
 * Mirrors docs-web/.vitepress/config.mts dev middleware `rspfx-md-pure`:
 * - GET/HEAD /md/<rel> -> candidates: <rel>.md, <rel>/index.md, <rel> (if already .md)
 * - disabled pages (llm.md, llms.md, llm*) -> 404 text/plain
 * - found -> 200 text/markdown
 * - not found -> 404 text/plain (never 404.html)
 * - all other paths -> pass to assets (VitePress SPA)
 */

export interface Env {
  ASSETS: Fetcher
}

const isDisabled = (r: string) => r === 'llm.md' || r === 'llms.md' || r.startsWith('llm')

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method
    const assetsFetch = env?.ASSETS?.fetch?.bind(env.ASSETS) ?? ((req: Request) => fetch(req))
    if (method !== 'GET' && method !== 'HEAD') {
      return assetsFetch(request)
    }

    let pathname = url.pathname
    // Normalise decode once (mirrors dev)
    try {
      pathname = decodeURIComponent(pathname)
    } catch {}

    const isMdRoute = pathname === '/md' || pathname.startsWith('/md/')
    if (!isMdRoute) {
      return assetsFetch(request)
    }

    let rel = pathname.slice(3)
    if (rel.startsWith('/')) rel = rel.slice(1)
    if (!rel) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    if (isDisabled(rel) || isDisabled(rel + '.md')) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // Candidates in same order as dev middleware
    const candidates: string[] = []
    if (rel.endsWith('.md')) {
      candidates.push(`/md/${rel}`)
    } else {
      candidates.push(`/md/${rel}.md`)
      candidates.push(`/md/${rel}/index.md`)
      candidates.push(`/md/${rel}`)
    }

    for (const cand of candidates) {
      const candRel = cand.slice(4) // strip /md/
      if (candRel && isDisabled(candRel)) {
        return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
      // Fetch from assets binding with rewritten URL
      const assetUrl = new URL(cand + url.search, url.origin)
      const assetReq = new Request(assetUrl.toString(), { method: 'GET', headers: request.headers })
      const res = await assetsFetch(assetReq)
      // ASSETS returns 200 if file exists, otherwise 404-page (HTML) — we detect by status
      // Check if asset exists by seeing if response is not 404. For markdown assets, content-type will be text/markdown.
      if (res.status === 200) {
        // Clone and ensure correct headers for extensionless rewrites
        const headers = new Headers(res.headers)
        headers.set('Content-Type', 'text/markdown; charset=utf-8')
        headers.set('X-Content-Type-Options', 'nosniff')
        // Preserve cache headers but ensure not html fallback
        if (method === 'HEAD') {
          return new Response(null, { status: 200, headers })
        }
        return new Response(res.body, { status: 200, headers })
      }
    }

    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  },
}
