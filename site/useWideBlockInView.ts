import { useState, useEffect } from "react"
import { useDebounceCallback, useMediaQuery } from "usehooks-ts"

/**
 * True while a content block that would overlap the sidebar TOC is in the
 * viewport, so the sidebar can collapse out of its way (see isSidebarExpanded
 * in SidebarTableOfContents.tsx).
 *
 * Wide blocks are matched by span class so new wide block types are covered as
 * they ship:
 *
 * - Full-bleed (`span-cols-14`) blocks sit under the sidebar at any width.
 * - Full-text-column (`span-cols-12`) blocks only overlap while the viewport is
 *   too narrow to fit the 12-col content plus a full sidebar-width outer track
 *   on each side.
 *
 * The sidebar coexists with ≤8-col content, so 8-col blocks (e.g. chart-story)
 * are deliberately not matched.
 */
const WIDE_COL_SELECTOR = '[class*="article-block__"].span-cols-12'
const FULL_BLEED_SELECTOR = '[class*="article-block__"].span-cols-14'
const WIDE_BLOCK_SELECTORS = `${WIDE_COL_SELECTOR}, ${FULL_BLEED_SELECTOR}`

const REVEAL_DEBOUNCE_MS = 150

// Keep in sync with --inner-cols-max-total-width in site/css/grid.scss.
const GRID_INNER_COLS_MAX_WIDTH = 1280
// Keep in sync with $sidebar-toc-frame-wide in site/SidebarTableOfContents.scss.
// At widths where 12-col content can coexist with the sidebar, that frame applies.
const SIDEBAR_TOC_FRAME_WIDE = 273
const SIDEBAR_COEXIST_BREATHING_ROOM = 48
const COEXIST_MIN_WIDTH =
    GRID_INNER_COLS_MAX_WIDTH +
    2 * SIDEBAR_TOC_FRAME_WIDE +
    SIDEBAR_COEXIST_BREATHING_ROOM

export function useWideBlockInView(): boolean {
    // Defaults to `true` (assume a wide block overlaps) so the sidebar renders
    // collapsed on the server and on the first client render and only opens
    // once the client has measured that nothing overlaps.
    const [inView, setInView] = useState(true)
    const canWideColCoexist = useMediaQuery(
        `(min-width: ${COEXIST_MIN_WIDTH}px)`
    )
    // Collapsing the sidebar (→ true) is immediate; releasing it again (→ false)
    // is debounced, so the brief gap between two wide blocks in quick
    // succession doesn't flicker the sidebar back open. A wide block (re)entering
    // cancels the pending release.
    const debouncedSetInView = useDebounceCallback(
        setInView,
        REVEAL_DEBOUNCE_MS
    )

    useEffect(() => {
        if (!("IntersectionObserver" in window)) return

        // Track intersecting blocks split by kind: full-bleed always overlaps
        // the sidebar; 12-col only below the coexist width.
        const fullBleed = new Set<Element>()
        const wideCol = new Set<Element>()

        const apply = () => {
            const shouldCollapse =
                fullBleed.size > 0 || (!canWideColCoexist && wideCol.size > 0)
            if (shouldCollapse) {
                debouncedSetInView.cancel()
                setInView(true)
            } else {
                debouncedSetInView(false)
            }
        }

        const observer = new IntersectionObserver(
            (records) => {
                for (const record of records) {
                    const set = record.target.matches(FULL_BLEED_SELECTOR)
                        ? fullBleed
                        : wideCol
                    if (record.isIntersecting) set.add(record.target)
                    else set.delete(record.target)
                }
                apply()
            },
            // Small top/bottom buffer so the collapse begins just before the
            // wide block reaches the sidebar.
            { rootMargin: "80px 0px 80px 0px" }
        )

        const blocks = document.querySelectorAll(WIDE_BLOCK_SELECTORS)
        blocks.forEach((block) => observer.observe(block))

        // A page with no wide block gets no observer callback, so `inView` would
        // stay stuck at its `true` default and the sidebar would never open.
        // Resolve it explicitly (→ open). This is not hypothetical: 9 published
        // linear topic pages currently render zero wide blocks — renewable-energy,
        // fossil-fuels, energy-mix, electricity-mix, nuclear-energy, energy-access,
        // clean-water, sanitation, teaching (text + ≤8-col charts only).
        if (blocks.length === 0) apply()

        return () => {
            observer.disconnect()
            debouncedSetInView.cancel()
        }
    }, [canWideColCoexist, debouncedSetInView])

    return inView
}
