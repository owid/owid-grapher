import { describe, expect, it, vi } from "vitest"
import { createCachedList } from "./cachedList.js"

describe(createCachedList, () => {
    it("fetches once within the max age and dedupes concurrent calls", async () => {
        let now = 0
        const cache = createCachedList<number>({
            maxAgeMs: 100,
            now: () => now,
        })
        const fetch = vi.fn(async () => [1, 2, 3])

        const [a, b] = await Promise.all([cache.get(fetch), cache.get(fetch)])
        expect(a).toEqual([1, 2, 3])
        expect(b).toBe(a)
        expect(fetch).toHaveBeenCalledOnce()

        now = 50
        await cache.get(fetch)
        expect(fetch).toHaveBeenCalledOnce()

        now = 150
        await cache.get(fetch)
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it("serves primed items and refetches after invalidation", async () => {
        const cache = createCachedList<string>({ maxAgeMs: 1000 })
        const fetch = vi.fn(async () => ["fetched"])

        cache.prime(["primed"])
        expect(await cache.get(fetch)).toEqual(["primed"])
        expect(fetch).not.toHaveBeenCalled()

        cache.invalidate()
        expect(await cache.get(fetch)).toEqual(["fetched"])
    })

    it("does not cache a failed fetch", async () => {
        const cache = createCachedList<string>({ maxAgeMs: 1000 })
        const fetch = vi
            .fn<() => Promise<string[]>>()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(["ok"])

        await expect(cache.get(fetch)).rejects.toThrow("boom")
        expect(await cache.get(fetch)).toEqual(["ok"])
    })
})
