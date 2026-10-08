import { useEffect, useMemo, useState } from "react"
import {
    ALL_CHARTS_ROW_BATCH_SIZE,
    getChartRowWindow,
} from "./search/searchUtils.js"

/**
 * How much of a topic's chart list the all-charts block (site/AllChartsBlock.tsx)
 * puts in the page: ALL_CHARTS_ROW_BATCH_SIZE rows on load, and that many more
 * each time the visitor clicks "Show 15 more".
 *
 * The list has no scroll region of its own — it grows with the page, and the
 * chart sidecar is held beside it with `position: sticky` — so its length is
 * the page's length, and a topic like CO2 (196 charts) made the block 18,000px
 * tall and kept the sidecar pinned past seventeen viewports of it. See
 * getChartRowWindow for the rest of that reasoning.
 *
 * A module of its own rather than a few lines inside the block, because its
 * rules are each easy to get wrong and cheap to pin down in a test (see
 * useVisibleChartHits.test.tsx): the slice is a *prefix* of the full result set,
 * so the block's identity-based selection and the table's row indices still line
 * up; `nextBatchSize` is the real remainder when fewer than a batch are left
 * ("Show 7 more") and 0 when nothing is, so no control appears under a list
 * that is already complete; the selected row is always inside the window; and a
 * new query puts the list back to its first batch, without which searching after
 * revealing the full list would hand back the very list the slice exists to
 * avoid.
 *
 * Revealing only grows the list until the query changes: collapsing a list the
 * visitor has already scrolled down into would yank the page up from under
 * them.
 */
export function useVisibleChartHits<T>(
    hits: readonly T[],
    query: string,
    selectedIndex: number = 0
): {
    visibleHits: readonly T[]
    /** How many rows "Show N more" would add; 0 when the list is complete. */
    nextBatchSize: number
    showMore: () => void
} {
    const [revealedRowCount, setRevealedRowCount] = useState(
        ALL_CHARTS_ROW_BATCH_SIZE
    )

    // Keyed on the raw query rather than on the debounced result set, so the
    // list is already bounded by the time the new results land — and so that
    // clicking the reveal control, which changes the rows on screen but not the
    // query, is never undone by this effect.
    useEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect -- resets the row-cap reveal when the query changes; the rule arrived with the master merge
        setRevealedRowCount(ALL_CHARTS_ROW_BATCH_SIZE)
        // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `query` is the trigger, not a value the effect reads: a new query resets the row-cap reveal; the rule arrived with the master merge
    }, [query])

    const { visibleRowCount, nextBatchSize } = getChartRowWindow(
        hits.length,
        revealedRowCount,
        selectedIndex
    )

    const visibleHits = useMemo(
        () => hits.slice(0, visibleRowCount),
        [hits, visibleRowCount]
    )

    return {
        visibleHits,
        nextBatchSize,
        // From what is on screen, not from what was last asked for: a window
        // stretched to reach the selected row must grow past it, not to it.
        showMore: () =>
            setRevealedRowCount(visibleRowCount + ALL_CHARTS_ROW_BATCH_SIZE),
    }
}
