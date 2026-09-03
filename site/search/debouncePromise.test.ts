import { afterEach, describe, expect, it, vi } from "vitest"
import { createDebouncedPromise } from "./debouncePromise.js"

describe(createDebouncedPromise, () => {
    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it("settles superseded promises with the canceled value", async () => {
        vi.useFakeTimers()
        const debounced = createDebouncedPromise<string[]>(200, [])

        const first = debounced.schedule(["first"])
        const second = debounced.schedule(["second"])

        await expect(first).resolves.toEqual([])
        await vi.advanceTimersByTimeAsync(200)
        await expect(second).resolves.toEqual(["second"])
        expect(vi.getTimerCount()).toBe(0)
    })

    it("settles pending promises when canceled", async () => {
        vi.useFakeTimers()
        const debounced = createDebouncedPromise<string[]>(200, [])

        const pending = debounced.schedule(["value"])
        debounced.cancel()

        await expect(pending).resolves.toEqual([])
        expect(vi.getTimerCount()).toBe(0)
    })
})
