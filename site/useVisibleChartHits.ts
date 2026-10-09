import { useEffect, useMemo, useState } from "react"
import {
    ALL_CHARTS_ROW_BATCH_SIZE,
    getNextChartHitBatchSize,
    getVisibleChartHits,
} from "./search/searchUtils.js"

/**
 * How much of a topic's chart list the all-charts block (site/AllChartsBlock.tsx)
 * puts in the page in its paged layout: `batchSize` rows to start with, and that
 * many more each time the visitor asks. The batch is ALL_CHARTS_ROW_BATCH_SIZE
 * unless the caller says otherwise; the block's V2 pages ten at a time on the
 * accordion layout.
 *
 * The list has no scroll region of its own in that layout — it grows with the
 * page, and the chart sidecar is held beside it with `position: sticky` — so
 * its length is the page's length, and a topic like CO2 (196 charts) made the
 * block 18,000px tall and kept the sidecar pinned past seventeen viewports of
 * it. See ALL_CHARTS_ROW_BATCH_SIZE for the rest of that reasoning.
 *
 * A module of its own rather than a few lines inside the block, because its
 * rules are each easy to get wrong and cheap to pin down in a test (see
 * useVisibleChartHits.test.tsx): the slice is a *prefix* of the full result set,
 * so the block's identity-based selection and the table's row indices still line
 * up; `nextBatchSize` is the number of rows a click really adds, and 0 once
 * there is nothing left to reveal, so the control neither over-promises on the
 * last batch nor lingers under a complete list; and a new `resetKey` (the query,
 * in practice) collapses the list back to the first batch, without which
 * searching after revealing the full list would hand back the very list the
 * slice exists to avoid. A new `batchSize` does the same, so a count revealed
 * at one batch size never carries over to another.
 *
 * Revealing only ever grows the list until the reset key changes: collapsing a
 * list the visitor has already scrolled down into would yank the page up from
 * under them.
 */
export function useVisibleChartHits<T>(
    hits: readonly T[],
    resetKey: string,
    batchSize: number = ALL_CHARTS_ROW_BATCH_SIZE
): {
    visibleHits: readonly T[]
    nextBatchSize: number
    showMore: () => void
} {
    const [visibleRowCount, setVisibleRowCount] = useState(batchSize)

    // Keyed on the raw query rather than on the debounced result set, so the
    // list is already bounded by the time the new results land — and so that
    // clicking the reveal control, which changes the rows on screen but not the
    // query, is never undone by this effect.
    useEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect -- resets the row-cap reveal when the query changes; the rule arrived with the master merge
        setVisibleRowCount(batchSize)
        // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `resetKey` is the trigger, not a value the effect reads: a new query resets the row-cap reveal; the rule arrived with the master merge
    }, [resetKey, batchSize])

    const visibleHits = useMemo(
        () => getVisibleChartHits(hits, visibleRowCount),
        [hits, visibleRowCount]
    )

    return {
        visibleHits,
        nextBatchSize: getNextChartHitBatchSize(
            hits.length,
            visibleRowCount,
            batchSize
        ),
        showMore: () => setVisibleRowCount((count) => count + batchSize),
    }
}
