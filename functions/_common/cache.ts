import type { Cache, CacheStorage, Request, Response } from "@cloudflare/workers-types"

// Helper to access Cloudflare Workers-specific cache API
// In Cloudflare Workers, `caches` has a `default` property which isn't in the standard CacheStorage type
export const getCache = (): Cache => (caches as unknown as CacheStorage).default

export const putInCache = (request: any, response: any) => {
    return getCache().put(request as Request, response as Response)
}

export const matchCache = (request: any) => {
    return getCache().match(request as Request)
}
