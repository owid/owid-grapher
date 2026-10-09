/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useVisibleChartHits } from "./useVisibleChartHits.js"

// A topic's chart list as the block holds it: the whole result set for the
// current query, in the block's default order.
const hits = (count: number): { slug: string }[] =>
    Array.from({ length: count }, (_, index) => ({ slug: `chart-${index}` }))

// The CO2 topic's real sizes: 196 charts on the bare topic, 165 of them with
// data for China.
const CO2_HITS = hits(196)
const CHINA_HITS = hits(165)

describe(useVisibleChartHits, () => {
    it("renders the first 15 rows of a long list, and offers 15 more", () => {
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(15)
    })

    it("adds 15 rows per click, in order", () => {
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 30))
        expect(result.current.nextBatchSize).toBe(15)

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 45))
    })

    it("offers only what is left on the last batch, then nothing", () => {
        // 22 rows: a first batch of 15, then a last batch of 7 — labelled 7,
        // since that is what the click adds.
        const { result } = renderHook(() => useVisibleChartHits(hits(22), ""))

        expect(result.current.nextBatchSize).toBe(7)

        act(() => result.current.showMore())

        expect(result.current.visibleHits).toHaveLength(22)
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("reaches the end of the CO2 list on a batch of one", () => {
        // 196 = 13 × 15 + 1.
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        for (let click = 0; click < 12; click++)
            act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(195)
        expect(result.current.nextBatchSize).toBe(1)

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(196)
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("goes back to the first 15 on a new query", () => {
        // The reason this rule exists: without it, searching after having
        // revealed most of the list hands back a list just as long as the one
        // the slice is there to avoid.
        const { result, rerender } = renderHook(
            ({ hits, query }: { hits: { slug: string }[]; query: string }) =>
                useVisibleChartHits(hits, query),
            { initialProps: { hits: CO2_HITS, query: "" } }
        )

        act(() => result.current.showMore())
        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(45)

        rerender({ hits: CHINA_HITS, query: "china" })

        expect(result.current.visibleHits).toEqual(CHINA_HITS.slice(0, 15))
        // ...and the control is back, offering the narrowed set's next batch.
        expect(result.current.nextBatchSize).toBe(15)
    })

    it("goes back on a half-typed query too, not only on a recognised one", () => {
        const { result, rerender } = renderHook(
            ({ query }: { query: string }) =>
                useVisibleChartHits(CO2_HITS, query),
            { initialProps: { query: "" } }
        )

        act(() => result.current.showMore())
        rerender({ query: "chi" })

        expect(result.current.visibleHits).toHaveLength(15)
    })

    it("goes back when the search is cleared after revealing more", () => {
        // Clearing the box is a new query like any other: batches revealed
        // for "china" must not carry back over to the full topic list.
        const { result, rerender } = renderHook(
            ({ hits, query }: { hits: { slug: string }[]; query: string }) =>
                useVisibleChartHits(hits, query),
            { initialProps: { hits: CHINA_HITS, query: "china" } }
        )

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(30)

        rerender({ hits: CO2_HITS, query: "" })

        expect(result.current.visibleHits).toHaveLength(15)
    })

    it("keeps what was revealed while the result set changes under an unchanged query", () => {
        // Only the reset key goes back to the first batch. Re-renders that
        // don't change it — including the Featured Metric record swap that
        // gives some of a topic's top charts a different objectID mid-typing —
        // must leave revealed rows revealed.
        const { result, rerender } = renderHook(
            ({ hits }: { hits: { slug: string }[] }) =>
                useVisibleChartHits(hits, "china"),
            { initialProps: { hits: CHINA_HITS } }
        )

        act(() => result.current.showMore())
        rerender({ hits: hits(164) })

        expect(result.current.visibleHits).toHaveLength(30)
        expect(result.current.nextBatchSize).toBe(15)
    })

    it("renders no control when the whole list fits in the first batch", () => {
        const { result } = renderHook(() => useVisibleChartHits(hits(15), ""))

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("renders no control for an empty result set", () => {
        const { result } = renderHook(() =>
            useVisibleChartHits([], "nonexistent")
        )

        expect(result.current.visibleHits).toEqual([])
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("keeps the slice a prefix of the full result set", () => {
        // What lets the block resolve its selected row against the full result
        // set while the table renders the slice: the two agree about which
        // index is which row only while this holds.
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 15))
    })

    // The block's V2 pages its list on the accordion layout too, ten rows at a
    // time rather than V1's fifteen. The rules are the same ones as above; what
    // these pin down is that every one of them follows the batch it is given,
    // rather than the default leaking into the first slice, the label, a click
    // or a reset.
    describe("with a batch of 10", () => {
        it("renders the first 10 rows, and adds 10 per click", () => {
            const { result } = renderHook(() =>
                useVisibleChartHits(CO2_HITS, "", 10)
            )

            expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 10))
            expect(result.current.nextBatchSize).toBe(10)

            act(() => result.current.showMore())
            expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 20))
            expect(result.current.nextBatchSize).toBe(10)
        })

        it("offers the remainder on the last batch, then nothing", () => {
            // 24 rows: 10, then 10 more, then "Show 4 more".
            const { result } = renderHook(() =>
                useVisibleChartHits(hits(24), "", 10)
            )

            act(() => result.current.showMore())
            expect(result.current.visibleHits).toHaveLength(20)
            expect(result.current.nextBatchSize).toBe(4)

            act(() => result.current.showMore())
            expect(result.current.visibleHits).toHaveLength(24)
            expect(result.current.nextBatchSize).toBe(0)
        })

        it("goes back to the first 10 on a new query", () => {
            const { result, rerender } = renderHook(
                ({
                    hits,
                    query,
                }: {
                    hits: { slug: string }[]
                    query: string
                }) => useVisibleChartHits(hits, query, 10),
                { initialProps: { hits: CO2_HITS, query: "" } }
            )

            act(() => result.current.showMore())
            act(() => result.current.showMore())
            expect(result.current.visibleHits).toHaveLength(30)

            rerender({ hits: CHINA_HITS, query: "china" })

            expect(result.current.visibleHits).toEqual(CHINA_HITS.slice(0, 10))
            expect(result.current.nextBatchSize).toBe(10)
        })

        it("starts again from the new batch when the batch size changes", () => {
            // A version switch from V1 to V2 on a phone, with the reset key
            // left alone so that the batch size is what triggers it: the 30
            // rows revealed fifteen at a time must not carry over as a stale
            // count into a list that pages by ten.
            const { result, rerender } = renderHook(
                ({ batchSize }: { batchSize: number }) =>
                    useVisibleChartHits(CO2_HITS, "", batchSize),
                { initialProps: { batchSize: 15 } }
            )

            act(() => result.current.showMore())
            expect(result.current.visibleHits).toHaveLength(30)

            rerender({ batchSize: 10 })

            expect(result.current.visibleHits).toHaveLength(10)
            expect(result.current.nextBatchSize).toBe(10)
        })

        it("renders no control when the whole list fits in the first 10", () => {
            const { result } = renderHook(() =>
                useVisibleChartHits(hits(10), "", 10)
            )

            expect(result.current.visibleHits).toHaveLength(10)
            expect(result.current.nextBatchSize).toBe(0)
        })
    })
})
