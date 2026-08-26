import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    createVisualDiffChecker,
    decodeVerdicts,
    encodeVerdicts,
    groupByVisualStatus,
    LoadPixels,
    RasterizedSvg,
    type VisualVerdict,
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

        const result = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(result).resolves.toBe("identical")
    })

    it("reports a pair whose pixels differ as changed", async () => {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(pixels(2, 2, url.startsWith("before") ? 7 : 9))
        )

        const result = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(result).resolves.toBe("changed")
    })

    it("reports a pair as changed when the chart changed size", async () => {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(
                url.startsWith("before") ? pixels(2, 2) : pixels(4, 4)
            )
        )

        await expect(checker.compare("before.svg", "after.svg")).resolves.toBe(
            "changed"
        )
    })

    it("says nothing about a pair it cannot rasterize", async () => {
        const checker = createVisualDiffChecker(() =>
            Promise.resolve(undefined)
        )

        // Not "changed": a chart nothing is known about is not one that changed
        await expect(checker.compare("before.svg", "after.svg")).resolves.toBe(
            "unknown"
        )
    })

    it("stops the work behind a pair it has given up on", async () => {
        const { pending, loadPixels } = deferredLoader()
        const checker = createVisualDiffChecker(loadPixels)

        const timedOut = checker.compare("before.svg", "after.svg")
        expect(pending.map(({ abandoned }) => abandoned?.aborted)).toEqual([
            false,
            false,
        ])

        await vi.advanceTimersByTimeAsync(20_000)
        await expect(timedOut).resolves.toBe("unknown")
        expect(pending.map(({ abandoned }) => abandoned?.aborted)).toEqual([
            true,
            true,
        ])
    })

    it("gives up on a pair that never comes back", async () => {
        const { loadPixels } = deferredLoader()
        const checker = createVisualDiffChecker(loadPixels)

        const timedOut = checker.compare("before.svg", "after.svg")
        await vi.advanceTimersByTimeAsync(20_000)
        await expect(timedOut).resolves.toBe("unknown")
    })

    it("does the work again every time it is asked", async () => {
        let loads = 0
        const checker = createVisualDiffChecker(() => {
            loads++
            return Promise.resolve(pixels(2, 2))
        })

        const first = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(first).resolves.toBe("identical")
        expect(loads).toBe(2)

        // Nothing is remembered here, which is what lets the caller ask again
        // about a pair that couldn't be checked
        const second = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(second).resolves.toBe("identical")
        expect(loads).toBe(4)
    })
})

describe("splitting differences by status", () => {
    const entry = (svgFilename: string) => ({ svgFilename })

    it("puts each difference in the bucket its verdict names", () => {
        const grouped = groupByVisualStatus(
            [entry("a.svg"), entry("b.svg"), entry("c.svg")],
            { "a.svg": "identical", "b.svg": "changed", "c.svg": "unknown" }
        )

        expect(grouped.changed).toEqual([entry("b.svg")])
        expect(grouped.unknown).toEqual([entry("c.svg")])
        expect(grouped.identical).toEqual([entry("a.svg")])
        expect(grouped.pending).toEqual([])
    })

    it("keeps the order the differences came in", () => {
        const grouped = groupByVisualStatus(
            [entry("a.svg"), entry("b.svg"), entry("c.svg")],
            { "a.svg": "changed", "b.svg": "identical", "c.svg": "changed" }
        )

        expect(grouped.changed).toEqual([entry("a.svg"), entry("c.svg")])
    })

    it("leaves a difference nothing is known about yet out of the changed bucket", () => {
        const grouped = groupByVisualStatus([entry("a.svg")], {})

        expect(grouped.pending).toEqual([entry("a.svg")])
        expect(grouped.changed).toEqual([])
    })

    it("keeps an unfinished check out of the changed bucket entirely", () => {
        const grouped = groupByVisualStatus([entry("a.svg"), entry("b.svg")], {
            "a.svg": "identical",
        })

        expect(grouped.changed).toEqual([])
        expect(grouped.pending).toEqual([entry("b.svg")])
    })

    it("names every bucket even when nothing landed in it", () => {
        const grouped = groupByVisualStatus([], {})

        expect(grouped).toEqual({
            changed: [],
            unknown: [],
            pending: [],
            identical: [],
        })
    })
})

describe("remembering what a run came to", () => {
    const NAMES = ["a.svg", "b.svg", "c.svg", "d.svg"]

    const store = (verdicts: Record<string, VisualVerdict>) =>
        encodeVerdicts({
            runKey: "run-1",
            svgFilenames: NAMES,
            verdicts,
            grapherCommit: "abc",
            svgsCommit: "def",
        })

    it("brings back every verdict of a finished check", () => {
        const verdicts: Record<string, VisualVerdict> = {
            "a.svg": "identical",
            "b.svg": "changed",
            "c.svg": "unknown",
            "d.svg": "identical",
        }
        const stored = store(verdicts)

        expect(stored.checkedPrefix).toBe(stored.total)
        // Only the exceptions are written down; the rest are identical by
        // omission, which is what keeps a whole suite down to a few hundred bytes
        expect(stored.changed).toEqual(["b.svg"])
        expect(stored.unknown).toEqual(["c.svg"])
        expect(decodeVerdicts(stored, "run-1", NAMES)).toEqual(verdicts)
    })

    it("remembers how far a half-finished check got", () => {
        const stored = store({ "a.svg": "identical", "b.svg": "changed" })

        expect(stored.checkedPrefix).toBe(2)
        expect(decodeVerdicts(stored, "run-1", NAMES)).toEqual({
            "a.svg": "identical",
            "b.svg": "changed",
        })
    })

    it("claims nothing for charts past the point it got to", () => {
        // "d.svg" was answered ahead of "c.svg" — dropped rather than tracked
        // one by one, so the caller simply checks it again
        const stored = store({ "a.svg": "identical", "d.svg": "changed" })

        expect(stored.checkedPrefix).toBe(1)
        expect(stored.changed).toEqual([])
        expect(decodeVerdicts(stored, "run-1", NAMES)).toEqual({
            "a.svg": "identical",
        })
    })

    it("says nothing about answers that belong to another run", () => {
        const stored = store({ "a.svg": "changed" })

        expect(decodeVerdicts(stored, "run-2", NAMES)).toBeUndefined()
    })

    it("says nothing when the run reported a different set of charts", () => {
        const stored = store({ "a.svg": "changed" })

        expect(
            decodeVerdicts(stored, "run-1", ["a.svg", "b.svg"])
        ).toBeUndefined()
    })

    it("says nothing when there is nothing stored", () => {
        expect(decodeVerdicts(undefined, "run-1", NAMES)).toBeUndefined()
    })
})
