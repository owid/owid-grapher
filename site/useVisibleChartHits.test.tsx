/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { ALL_CHARTS_INITIAL_ROW_COUNT } from "./search/searchUtils.js"
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
    it("renders a bounded slice of a long list, and offers the rest", () => {
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        expect(result.current.visibleHits).toHaveLength(
            ALL_CHARTS_INITIAL_ROW_COUNT
        )
        expect(result.current.hasHiddenHits).toBe(true)
    })

    it("reveals the whole list when asked, and stops offering it", () => {
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        act(() => result.current.revealAll())

        expect(result.current.visibleHits).toHaveLength(196)
        expect(result.current.hasHiddenHits).toBe(false)
    })

    it("collapses the list again on a new query", () => {
        // The reason this rule exists: without it, searching after having
        // revealed all 196 rows hands back a list just as long as the one the
        // slice is there to avoid.
        const { result, rerender } = renderHook(
            ({ hits, query }: { hits: { slug: string }[]; query: string }) =>
                useVisibleChartHits(hits, query),
            { initialProps: { hits: CO2_HITS, query: "" } }
        )

        act(() => result.current.revealAll())
        expect(result.current.visibleHits).toHaveLength(196)

        rerender({ hits: CHINA_HITS, query: "china" })

        expect(result.current.visibleHits).toHaveLength(
            ALL_CHARTS_INITIAL_ROW_COUNT
        )
        // ...and the control is back, now counting the narrowed result set.
        expect(result.current.hasHiddenHits).toBe(true)
    })

    it("collapses on a half-typed query too, not only on a recognised one", () => {
        const { result, rerender } = renderHook(
            ({ query }: { query: string }) =>
                useVisibleChartHits(CO2_HITS, query),
            { initialProps: { query: "" } }
        )

        act(() => result.current.revealAll())
        rerender({ query: "chi" })

        expect(result.current.visibleHits).toHaveLength(
            ALL_CHARTS_INITIAL_ROW_COUNT
        )
    })

    it("collapses again when the search is cleared after being revealed", () => {
        // Clearing the box is a new query like any other: an expansion granted
        // for "china" must not carry back over to the full topic list.
        const { result, rerender } = renderHook(
            ({ hits, query }: { hits: { slug: string }[]; query: string }) =>
                useVisibleChartHits(hits, query),
            { initialProps: { hits: CHINA_HITS, query: "china" } }
        )

        act(() => result.current.revealAll())
        expect(result.current.visibleHits).toHaveLength(165)

        rerender({ hits: CO2_HITS, query: "" })

        expect(result.current.visibleHits).toHaveLength(
            ALL_CHARTS_INITIAL_ROW_COUNT
        )
    })

    it("stays revealed while the result set changes under an unchanged query", () => {
        // Only the query collapses the list. Re-renders that don't change it —
        // including the Featured Metric record swap that gives some of a
        // topic's top charts a different objectID mid-typing — must leave a
        // revealed list revealed.
        const { result, rerender } = renderHook(
            ({ hits }: { hits: { slug: string }[] }) =>
                useVisibleChartHits(hits, "china"),
            { initialProps: { hits: CHINA_HITS } }
        )

        act(() => result.current.revealAll())
        rerender({ hits: hits(164) })

        expect(result.current.visibleHits).toHaveLength(164)
        expect(result.current.hasHiddenHits).toBe(false)
    })

    it("renders no control when the whole list already fits in the slice", () => {
        const { result } = renderHook(() =>
            useVisibleChartHits(hits(ALL_CHARTS_INITIAL_ROW_COUNT), "")
        )

        expect(result.current.visibleHits).toHaveLength(
            ALL_CHARTS_INITIAL_ROW_COUNT
        )
        expect(result.current.hasHiddenHits).toBe(false)
    })

    it("renders no control for an empty result set", () => {
        const { result } = renderHook(() =>
            useVisibleChartHits([], "nonexistent")
        )

        expect(result.current.visibleHits).toEqual([])
        expect(result.current.hasHiddenHits).toBe(false)
    })

    it("keeps the slice a prefix of the full result set", () => {
        // What lets the block resolve its selected row against the full result
        // set while the table renders the slice: the two agree about which
        // index is which row only while this holds.
        const { result } = renderHook(() => useVisibleChartHits(CO2_HITS, ""))

        expect(result.current.visibleHits).toEqual(
            CO2_HITS.slice(0, ALL_CHARTS_INITIAL_ROW_COUNT)
        )
    })
})
