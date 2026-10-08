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

type Props = { hits: { slug: string }[]; query: string; selectedIndex?: number }

const renderList = (initialProps: Props) =>
    renderHook(
        ({ hits, query, selectedIndex }: Props) =>
            useVisibleChartHits(hits, query, selectedIndex),
        { initialProps }
    )

describe(useVisibleChartHits, () => {
    it("shows 15 rows of a long list on load, and offers 15 more", () => {
        const { result } = renderList({ hits: CO2_HITS, query: "" })

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(15)
    })

    it("adds 15 rows per click", () => {
        const { result } = renderList({ hits: CO2_HITS, query: "" })

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(30)
        expect(result.current.nextBatchSize).toBe(15)

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(45)
    })

    it("offers the real remainder as the last batch, then nothing", () => {
        // 31 rows: two full batches and a final batch of one.
        const { result } = renderList({ hits: hits(31), query: "" })

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(15)

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(30)
        expect(result.current.nextBatchSize).toBe(1)

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(31)
        // No control once the list is complete.
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("renders no control when the list is exactly one batch", () => {
        const { result } = renderList({ hits: hits(15), query: "" })

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("renders no control when the list is shorter than a batch", () => {
        const { result } = renderList({ hits: hits(7), query: "" })

        expect(result.current.visibleHits).toHaveLength(7)
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("renders no control for an empty result set", () => {
        const { result } = renderList({ hits: [], query: "nonexistent" })

        expect(result.current.visibleHits).toEqual([])
        expect(result.current.nextBatchSize).toBe(0)
    })

    it("goes back to 15 rows on a new query", () => {
        // The reason this rule exists: without it, searching after having
        // revealed a long list hands back a list just as long as the one the
        // slice is there to avoid.
        const { result, rerender } = renderList({ hits: CO2_HITS, query: "" })

        act(() => result.current.showMore())
        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(45)

        rerender({ hits: CHINA_HITS, query: "china" })

        expect(result.current.visibleHits).toHaveLength(15)
        expect(result.current.nextBatchSize).toBe(15)
    })

    it("goes back to 15 rows on a half-typed query too", () => {
        const { result, rerender } = renderList({ hits: CO2_HITS, query: "" })

        act(() => result.current.showMore())
        rerender({ hits: CO2_HITS, query: "chi" })

        expect(result.current.visibleHits).toHaveLength(15)
    })

    it("goes back to 15 rows when the search is cleared", () => {
        // Clearing the box is a new query like any other.
        const { result, rerender } = renderList({
            hits: CHINA_HITS,
            query: "china",
        })

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(30)

        rerender({ hits: CO2_HITS, query: "" })

        expect(result.current.visibleHits).toHaveLength(15)
    })

    it("keeps its reveals while the result set changes under an unchanged query", () => {
        // Only the query resets the list. Re-renders that don't change it —
        // including the Featured Metric record swap that gives some of a
        // topic's top charts a different objectID mid-typing — must leave the
        // revealed rows revealed.
        const { result, rerender } = renderList({
            hits: CHINA_HITS,
            query: "china",
        })

        act(() => result.current.showMore())
        rerender({ hits: hits(164), query: "china" })

        expect(result.current.visibleHits).toHaveLength(30)
    })

    it("keeps the selected row on screen after the reset", () => {
        // A chart picked at row 22 after one "Show 15 more", which survives a
        // country search at row 19: the query asks for 15 rows again, but the
        // row the sidecar is showing must stay in the list beside it.
        const { result, rerender } = renderList({
            hits: CO2_HITS,
            query: "",
            selectedIndex: 0,
        })

        act(() => result.current.showMore())
        rerender({ hits: CO2_HITS, query: "", selectedIndex: 22 })
        rerender({ hits: CHINA_HITS, query: "china", selectedIndex: 19 })

        expect(result.current.visibleHits).toHaveLength(30)
        expect(result.current.visibleHits[19]).toBe(CHINA_HITS[19])

        // ...and the next click still adds a whole batch beyond it.
        act(() => result.current.showMore())
        expect(result.current.visibleHits).toHaveLength(45)
    })

    it("keeps the window a prefix of the full result set", () => {
        // What lets the block resolve its selected row against the full result
        // set while the table renders the window: the two agree about which
        // index is which row only while this holds.
        const { result } = renderList({ hits: CO2_HITS, query: "" })

        act(() => result.current.showMore())
        expect(result.current.visibleHits).toEqual(CO2_HITS.slice(0, 30))
    })
})
