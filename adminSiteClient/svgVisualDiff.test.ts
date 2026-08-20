import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    createVisualDiffChecker,
    LoadPixels,
    RasterizedSvg,
} from "./svgVisualDiff.js"

function pixels(width: number, height: number, fill = 0): RasterizedSvg {
    return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(fill),
    }
}

interface PendingLoad {
    url: string
    abandoned?: AbortSignal
    resolve: (svg: RasterizedSvg) => void
}

/** Lets a test decide when each SVG finishes rasterizing */
function deferredLoader(): { pending: PendingLoad[]; loadPixels: LoadPixels } {
    const pending: PendingLoad[] = []
    return {
        pending,
        loadPixels: (url, abandoned) =>
            new Promise<RasterizedSvg>((resolve) =>
                pending.push({ url, abandoned, resolve })
            ),
    }
}

/** Comparing waits for an idle moment before it walks the buffers */
async function runIdleWork(): Promise<void> {
    await vi.advanceTimersByTimeAsync(1)
}

describe("the visual diff checker", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("reports a pair whose pixels match as identical", async () => {
        const checker = createVisualDiffChecker(() =>
            Promise.resolve(pixels(2, 2, 7))
        )

        const result = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        await expect(result).resolves.toBe(true)
    })

    it("reports a pair whose pixels differ as different", async () => {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(pixels(2, 2, url.startsWith("before") ? 7 : 9))
        )

        const result = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        await expect(result).resolves.toBe(false)
    })

    it("reports a pair as different when the chart changed size", async () => {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(
                url.startsWith("before") ? pixels(2, 2) : pixels(4, 4)
            )
        )

        await expect(
            checker.compare("before.svg", "after.svg", "run-1")
        ).resolves.toBe(false)
    })

    it("reports a pair as different when an SVG cannot be rasterized", async () => {
        const checker = createVisualDiffChecker(() =>
            Promise.resolve(undefined)
        )

        await expect(
            checker.compare("before.svg", "after.svg", "run-1")
        ).resolves.toBe(false)
    })

    it("does not remember a pair it could not rasterize as changed", async () => {
        let attempts = 0
        // Fails once, the way a transient error would, then works
        const checker = createVisualDiffChecker(() =>
            Promise.resolve(attempts++ < 2 ? undefined : pixels(2, 2))
        )

        await expect(
            checker.compare("before.svg", "after.svg", "run-1")
        ).resolves.toBe(false)

        const retried = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        await expect(retried).resolves.toBe(true)
    })

    it("stops the work behind a pair it has given up on", async () => {
        const { pending, loadPixels } = deferredLoader()
        const checker = createVisualDiffChecker(loadPixels)

        const timedOut = checker.compare("before.svg", "after.svg", "run-1")
        expect(pending.map(({ abandoned }) => abandoned?.aborted)).toEqual([
            false,
            false,
        ])

        await vi.advanceTimersByTimeAsync(20_000)
        await expect(timedOut).resolves.toBe(false)
        expect(pending.map(({ abandoned }) => abandoned?.aborted)).toEqual([
            true,
            true,
        ])
    })

    it("reuses the answer for a pair it has already compared", async () => {
        let loads = 0
        const checker = createVisualDiffChecker(() => {
            loads++
            return Promise.resolve(pixels(2, 2))
        })

        const first = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        await expect(first).resolves.toBe(true)
        expect(loads).toBe(2)

        await expect(
            checker.compare("before.svg", "after.svg", "run-1")
        ).resolves.toBe(true)
        expect(loads).toBe(2)
    })

    it("recompares when a new run has rewritten the same filenames", async () => {
        let loads = 0
        const checker = createVisualDiffChecker(() => {
            loads++
            return Promise.resolve(pixels(2, 2))
        })

        void checker.compare("before.svg", "after.svg", "run-1")
        void checker.compare("before.svg", "after.svg", "run-2")
        await runIdleWork()

        expect(loads).toBe(4)
    })

    it("gives up on a pair that never comes back", async () => {
        const { loadPixels } = deferredLoader()
        const checker = createVisualDiffChecker(loadPixels)

        const timedOut = checker.compare("before.svg", "after.svg", "run-1")
        await vi.advanceTimersByTimeAsync(20_000)
        await expect(timedOut).resolves.toBe(false)
    })

    it("does not remember a pair that timed out as changed", async () => {
        const { pending, loadPixels } = deferredLoader()
        const checker = createVisualDiffChecker(loadPixels)

        const timedOut = checker.compare("before.svg", "after.svg", "run-1")
        await vi.advanceTimersByTimeAsync(20_000)
        await expect(timedOut).resolves.toBe(false)

        // Asked again it has to do the work, rather than repeat a non-answer
        pending.length = 0
        const retried = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        expect(pending).toHaveLength(2)
        pending.forEach(({ resolve }) => resolve(pixels(2, 2)))
        await runIdleWork()
        await expect(retried).resolves.toBe(true)
    })

    it("forgets the answers for runs nobody is looking at any more", async () => {
        let loads = 0
        const checker = createVisualDiffChecker(() => {
            loads++
            return Promise.resolve(pixels(2, 2))
        })

        const first = checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        await expect(first).resolves.toBe(true)
        expect(loads).toBe(2)

        // Four more runs push run-1 out of the cache, so it is checked again
        for (const run of ["run-2", "run-3", "run-4", "run-5"]) {
            void checker.compare("before.svg", "after.svg", run)
            await runIdleWork()
        }
        void checker.compare("before.svg", "after.svg", "run-1")
        await runIdleWork()
        expect(loads).toBe(12)
    })
})
