/**
 * A module-level cache for the admin's big list endpoints (`/api/charts.json`
 * is every chart, `/api/gdocs` every document), so that tools calling them
 * repeatedly in one session don't refetch a multi-megabyte payload each time.
 *
 * Pages that already load the same list prime the cache (`ChartIndexPage`),
 * and mutating tools invalidate it (`save_chart`).
 */

export interface CachedList<T> {
    get: (fetch: () => Promise<T[]>) => Promise<T[]>
    prime: (items: T[]) => void
    invalidate: () => void
}

export function createCachedList<T>({
    maxAgeMs,
    now = Date.now,
}: {
    maxAgeMs: number
    now?: () => number
}): CachedList<T> {
    let cache: { fetchedAt: number; items: T[] } | undefined
    let inflight: Promise<T[]> | undefined

    return {
        async get(fetch: () => Promise<T[]>): Promise<T[]> {
            if (cache && now() - cache.fetchedAt < maxAgeMs) return cache.items
            if (inflight) return inflight
            inflight = fetch()
                .then((items) => {
                    cache = { fetchedAt: now(), items }
                    return items
                })
                .finally(() => {
                    inflight = undefined
                })
            return inflight
        },
        prime(items: T[]): void {
            cache = { fetchedAt: now(), items }
        },
        invalidate(): void {
            cache = undefined
        },
    }
}
