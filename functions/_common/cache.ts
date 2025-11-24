// Helper to access Cloudflare Workers-specific cache API
// In Cloudflare Workers, `caches` has a `default` property which isn't in the standard CacheStorage type
export const getCache = (): Cache => (caches as any).default
