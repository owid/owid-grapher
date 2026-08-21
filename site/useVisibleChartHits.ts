import { useEffect, useMemo, useState } from "react"
import {
    getVisibleChartHits,
    hasHiddenChartHits,
} from "./search/searchUtils.js"

/**
 * How much of a topic's chart list the all-charts block (site/AllChartsBlock.tsx)
 * puts in the page: the first ALL_CHARTS_INITIAL_ROW_COUNT rows until the
 * visitor reveals the rest.
 *
 * The list has no scroll region of its own — it grows with the page, and the
 * chart sidecar is held beside it with `position: sticky` — so its length is
 * the page's length, and a topic like CO2 (196 charts) made the block 18,000px
 * tall and kept the sidecar pinned past seventeen viewports of it. See
 * getVisibleChartHits for the rest of that reasoning.
 *
 * A module of its own rather than a few lines inside the block, because its
 * three rules are each easy to get wrong and cheap to pin down in a test (see
 * useVisibleChartHits.test.tsx): the slice is a *prefix* of the full result set,
 * so the block's identity-based selection and the table's row indices still line
 * up; `hasHiddenHits` is false when there is nothing left to reveal, so no
 * "Show all 25 indicators" appears above a list of all 25 of them; and a new
 * query collapses the list again, without which searching after revealing the
 * full list would hand back the very list the slice exists to avoid.
 *
 * Revealing is deliberately one-way until the query changes: collapsing a list
 * the visitor has already scrolled down into would yank the page up from under
 * them.
 */
export function useVisibleChartHits<T>(
    hits: readonly T[],
    query: string
): {
    visibleHits: readonly T[]
    hasHiddenHits: boolean
    revealAll: () => void
} {
    const [isListExpanded, setIsListExpanded] = useState(false)

    // Keyed on the raw query rather than on the debounced result set, so the
    // list is already bounded by the time the new results land — and so that
    // clicking the reveal control, which changes the rows on screen but not the
    // query, is never undone by this effect.
    useEffect(() => {
        setIsListExpanded(false)
    }, [query])

    const visibleHits = useMemo(
        () => getVisibleChartHits(hits, isListExpanded),
        [hits, isListExpanded]
    )

    return {
        visibleHits,
        hasHiddenHits: !isListExpanded && hasHiddenChartHits(hits.length),
        revealAll: () => setIsListExpanded(true),
    }
}
