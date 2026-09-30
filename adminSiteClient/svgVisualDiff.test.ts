import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    createVisualDiffChecker,
    decodeComparisons,
    encodeComparisons,
    groupByVisualStatus,
    LoadPixels,
    RasterizedSvg,
    type VisualComparison,
} from "./svgVisualDiff.js"

function pixels(width: number, height: number, fill = 0): RasterizedSvg {
    return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4).fill(fill),
    }
}

/** An opaque canvas of one grey, which is the shape a chart's pixels come in */
function solid(width: number, height: number, grey: number): RasterizedSvg {
    const svg = pixels(width, height, grey)
    for (let i = 3; i < svg.data.length; i += 4) svg.data[i] = 255
    return svg
}

/** A canvas painting nothing, whatever colours its buffer happens to hold */
function transparent(
    width: number,
    height: number,
    grey: number
): RasterizedSvg {
    const svg = solid(width, height, grey)
    for (let i = 3; i < svg.data.length; i += 4) svg.data[i] = 0
    return svg
}

/** Paints one pixel of an opaque canvas black */
function blacken(svg: RasterizedSvg, index: number): void {
    svg.data.fill(0, index * 4, index * 4 + 3)
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

    /** What a pair of renderings comes to, once the idle work has run */
    async function compare(
        before: RasterizedSvg,
        after: RasterizedSvg
    ): Promise<VisualComparison> {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(url.startsWith("before") ? before : after)
        )
        const comparison = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        return comparison
    }

    it("reports a pair whose pixels match as identical", async () => {
        await expect(compare(solid(2, 2, 7), solid(2, 2, 7))).resolves.toEqual({
            verdict: "identical",
            magnitude: 0,
            changedPixelShare: 0,
        })
    })

    it("reports a pair whose pixels differ as changed", async () => {
        const comparison = await compare(solid(2, 2, 7), solid(2, 2, 9))

        expect(comparison.verdict).toBe("changed")
        expect(comparison.magnitude).toBeGreaterThan(0)
    })

    it("measures a chart that turned over completely as the whole of it", async () => {
        await expect(
            compare(solid(2, 2, 255), solid(2, 2, 0))
        ).resolves.toEqual({
            verdict: "changed",
            magnitude: 1,
            changedPixelShare: 1,
        })
    })

    it("measures a change that covers half the chart as half of it", async () => {
        const after = solid(2, 2, 255)
        blacken(after, 0)
        blacken(after, 1)

        await expect(compare(solid(2, 2, 255), after)).resolves.toEqual({
            verdict: "changed",
            magnitude: 0.5,
            changedPixelShare: 0.5,
        })
    })

    it("separates how much of a chart changed from how hard", async () => {
        // Every pixel differs, but only by a shade: the same magnitude as a
        // single pixel of four turning from white to black
        const faint = await compare(solid(2, 2, 255), solid(2, 2, 191))

        expect(faint.changedPixelShare).toBe(1)
        expect(faint.magnitude).toBeCloseTo(0.25, 2)
    })

    it("counts a change nothing paints as no change at all", async () => {
        // Both paint nothing, so the colours in their buffers never show
        await expect(
            compare(transparent(2, 2, 0), transparent(2, 2, 9))
        ).resolves.toEqual({
            verdict: "changed",
            magnitude: 0,
            changedPixelShare: 0,
        })
    })

    it("reports a pair as changed when the chart changed size", async () => {
        const checker = createVisualDiffChecker((url) =>
            Promise.resolve(
                url.startsWith("before") ? pixels(2, 2) : pixels(4, 4)
            )
        )

        // No common grid to measure on, so it sorts as the largest change there is
        await expect(
            checker.compare("before.svg", "after.svg")
        ).resolves.toEqual({
            verdict: "changed",
            magnitude: 1,
            changedPixelShare: 1,
        })
    })

    it("says nothing about a pair it cannot rasterize", async () => {
        const checker = createVisualDiffChecker(() =>
            Promise.resolve(undefined)
        )

        // Not "changed": a chart nothing is known about is not one that changed
        await expect(
            checker.compare("before.svg", "after.svg")
        ).resolves.toMatchObject({ verdict: "unknown" })
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
        await expect(timedOut).resolves.toMatchObject({ verdict: "unknown" })
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
        await expect(timedOut).resolves.toMatchObject({ verdict: "unknown" })
    })

    it("does the work again every time it is asked", async () => {
        let loads = 0
        const checker = createVisualDiffChecker(() => {
            loads++
            return Promise.resolve(pixels(2, 2))
        })

        const first = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(first).resolves.toMatchObject({ verdict: "identical" })
        expect(loads).toBe(2)

        // Nothing is remembered here, which is what lets the caller ask again
        // about a pair that couldn't be checked
        const second = checker.compare("before.svg", "after.svg")
        await runIdleWork()
        await expect(second).resolves.toMatchObject({ verdict: "identical" })
        expect(loads).toBe(4)
    })
})

describe("splitting differences by status", () => {
    const entry = (svgFilename: string) => ({ svgFilename })

    const changed = (magnitude: number): VisualComparison => ({
        verdict: "changed",
        magnitude,
        changedPixelShare: magnitude,
    })
    const identical: VisualComparison = {
        verdict: "identical",
        magnitude: 0,
        changedPixelShare: 0,
    }
    const unknown: VisualComparison = {
        verdict: "unknown",
        magnitude: 0,
        changedPixelShare: 0,
    }

    it("puts each difference in the bucket its verdict names", () => {
        const grouped = groupByVisualStatus(
            [entry("a.svg"), entry("b.svg"), entry("c.svg")],
            { "a.svg": identical, "b.svg": changed(0.1), "c.svg": unknown }
        )

        expect(grouped.changed).toEqual([entry("b.svg")])
        expect(grouped.unknown).toEqual([entry("c.svg")])
        expect(grouped.identical).toEqual([entry("a.svg")])
        expect(grouped.pending).toEqual([])
    })

    it("lists the biggest change first", () => {
        const grouped = groupByVisualStatus(
            [entry("a.svg"), entry("b.svg"), entry("c.svg")],
            {
                "a.svg": changed(0.01),
                "b.svg": changed(0.5),
                "c.svg": changed(0.2),
            }
        )

        expect(grouped.changed).toEqual([
            entry("b.svg"),
            entry("c.svg"),
            entry("a.svg"),
        ])
    })

    it("keeps the order the differences came in", () => {
        const grouped = groupByVisualStatus(
            [entry("a.svg"), entry("b.svg"), entry("c.svg")],
            {
                "a.svg": changed(0.3),
                "b.svg": identical,
                "c.svg": changed(0.3),
            }
        )

        // Both changed as much as each other, so neither overtakes the other
        expect(grouped.changed).toEqual([entry("a.svg"), entry("c.svg")])
    })

    it("leaves a difference nothing is known about yet out of the changed bucket", () => {
        const grouped = groupByVisualStatus([entry("a.svg")], {})

        expect(grouped.pending).toEqual([entry("a.svg")])
        expect(grouped.changed).toEqual([])
    })

    it("keeps an unfinished check out of the changed bucket entirely", () => {
        const grouped = groupByVisualStatus([entry("a.svg"), entry("b.svg")], {
            "a.svg": identical,
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

    const changed = (magnitude: number): VisualComparison => ({
        verdict: "changed",
        magnitude,
        changedPixelShare: magnitude * 2,
    })
    const identical: VisualComparison = {
        verdict: "identical",
        magnitude: 0,
        changedPixelShare: 0,
    }
    const unknown: VisualComparison = {
        verdict: "unknown",
        magnitude: 0,
        changedPixelShare: 0,
    }

    const store = (comparisons: Record<string, VisualComparison>) =>
        encodeComparisons({
            runKey: "run-1",
            svgFilenames: NAMES,
            comparisons,
            grapherCommit: "abc",
            svgsCommit: "def",
        })

    it("brings back every verdict of a finished check", () => {
        const comparisons: Record<string, VisualComparison> = {
            "a.svg": identical,
            "b.svg": changed(0.25),
            "c.svg": unknown,
            "d.svg": identical,
        }
        const stored = store(comparisons)

        expect(stored.checkedPrefix).toBe(stored.total)
        // Only the exceptions are written down; the rest are identical by
        // omission, which is what keeps a whole suite down to a few hundred bytes
        expect(stored.changed).toEqual(["b.svg"])
        expect(stored.unknown).toEqual(["c.svg"])
        expect(decodeComparisons(stored, "run-1", NAMES)).toEqual(comparisons)
    })

    it("brings back how much each chart changed", () => {
        const stored = store({
            "a.svg": changed(0.5),
            "b.svg": changed(0.125),
            "c.svg": identical,
            "d.svg": identical,
        })

        expect(stored.scores).toEqual([
            [0.5, 1],
            [0.125, 0.25],
        ])
        expect(decodeComparisons(stored, "run-1", NAMES)).toMatchObject({
            "a.svg": { magnitude: 0.5 },
            "b.svg": { magnitude: 0.125 },
        })
    })

    it("keeps a change too small to see apart from no change at all", () => {
        const stored = store({ "a.svg": changed(0.000_001_234_5) })

        // Rounded to three significant figures, not to a readable number of
        // decimals: a single changed pixel scores a few millionths
        expect(stored.scores).toEqual([[0.000_001_23, 0.000_002_47]])
    })

    it("remembers how far a half-finished check got", () => {
        const stored = store({ "a.svg": identical, "b.svg": changed(0.4) })

        expect(stored.checkedPrefix).toBe(2)
        expect(decodeComparisons(stored, "run-1", NAMES)).toEqual({
            "a.svg": identical,
            "b.svg": changed(0.4),
        })
    })

    it("claims nothing for charts past the point it got to", () => {
        // "d.svg" was answered ahead of "c.svg" — dropped rather than tracked
        // one by one, so the caller simply checks it again
        const stored = store({ "a.svg": identical, "d.svg": changed(0.4) })

        expect(stored.checkedPrefix).toBe(1)
        expect(stored.changed).toEqual([])
        expect(decodeComparisons(stored, "run-1", NAMES)).toEqual({
            "a.svg": identical,
        })
    })

    it("says nothing about answers that belong to another run", () => {
        const stored = store({ "a.svg": changed(0.4) })

        expect(decodeComparisons(stored, "run-2", NAMES)).toBeUndefined()
    })

    it("says nothing when the run reported a different set of charts", () => {
        const stored = store({ "a.svg": changed(0.4) })

        expect(
            decodeComparisons(stored, "run-1", ["a.svg", "b.svg"])
        ).toBeUndefined()
    })

    it("says nothing when the scores don't line up with the charts", () => {
        const stored = store({ "a.svg": changed(0.4) })

        expect(
            decodeComparisons({ ...stored, scores: [] }, "run-1", NAMES)
        ).toBeUndefined()
    })

    it("says nothing when there is nothing stored", () => {
        expect(decodeComparisons(undefined, "run-1", NAMES)).toBeUndefined()
    })
})
