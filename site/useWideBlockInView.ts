import { useState, useEffect } from "react"
import { useDebounceCallback } from "usehooks-ts"

/**
 * True while a content block that would actually overlap the sidebar TOC sidebar
 * is in the viewport, so the sidebar can slide out of its way.
 *
 * Wide blocks are matched by span class (not an enumerated block-type list) so
 * new wide block types are covered as they ship:
 *
 * - Full-bleed (`span-cols-14`) blocks span the whole viewport, so they sit
 *   under the sidebar at any width — always a reason to slide.
 * - Full-text-column (`span-cols-12`) blocks only overlap the sidebar at narrower
 *   desktop widths, where the sidebar overflows its left-margin column into the
 *   content. Once the margin is wide enough to hold the sidebar (see
 *   COHABIT_MIN_WIDTH_PX) the two no longer touch, so the slide-out would be
 *   pointless and we suppress it.
 *
 * The sidebar coexists with ≤8-col content, so 8-col blocks (e.g. chart-story) are
 * deliberately not matched.
 */
const WIDE_COL_SELECTOR = '[class*="article-block__"].span-cols-12'
const FULL_BLEED_SELECTOR = '[class*="article-block__"].span-cols-14'
const WIDE_BLOCK_SELECTORS = `${WIDE_COL_SELECTOR}, ${FULL_BLEED_SELECTOR}`

// At/above this viewport width the left-margin column is wide enough to hold
// the 273px sidebar, so it no longer overflows into (and overlaps) 12-col content
// — the slide-out is then unnecessary for those blocks. Derived from the grid:
// the sidebar clears the content once each 1fr margin ≥ the sidebar width, i.e. once
// the viewport exceeds the 1280px inner content + 2×273px sidebars (+ container
// padding). Approximate; only gates an optimisation, not correctness.
const COHABIT_MIN_WIDTH_PX = 1875

const REVEAL_DEBOUNCE_MS = 150

export function useWideBlockInView(): boolean {
    const [inView, setInView] = useState(false)
    // Hiding the sidebar (→ true) is immediate; revealing it again (→ false) is
    // debounced, so the brief gap between two wide blocks in quick succession
    // doesn't flicker the sidebar back in. A wide block (re)entering cancels the
    // pending reveal.
    const debouncedSetInView = useDebounceCallback(
        setInView,
        REVEAL_DEBOUNCE_MS
    )

    useEffect(() => {
        if (!("IntersectionObserver" in window)) return

        // Track intersecting blocks split by kind: full-bleed always overlaps
        // the sidebar; 12-col only below the cohabit width.
        const fullBleed = new Set<Element>()
        const wideCol = new Set<Element>()
        const cohabitQuery = window.matchMedia(
            `(min-width: ${COHABIT_MIN_WIDTH_PX}px)`
        )

        const apply = () => {
            const shouldSlide =
                fullBleed.size > 0 ||
                (!cohabitQuery.matches && wideCol.size > 0)
            if (shouldSlide) {
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
            // Small top/bottom buffer so the slide-out begins just before the
            // wide block overlaps the sidebar.
            { rootMargin: "80px 0px 80px 0px" }
        )

        const blocks = document.querySelectorAll(WIDE_BLOCK_SELECTORS)
        blocks.forEach((block) => observer.observe(block))
        // Crossing the cohabit width (resize / zoom / rotate) re-evaluates
        // whether in-view 12-col blocks still warrant the slide.
        cohabitQuery.addEventListener("change", apply)

        return () => {
            observer.disconnect()
            cohabitQuery.removeEventListener("change", apply)
            debouncedSetInView.cancel()
        }
    }, [debouncedSetInView])

    return inView
}
