import { useState, useEffect } from "react"
import { useDebounceCallback } from "usehooks-ts"

/**
 * True while a content block wider than the standard text column is in the
 * viewport, so the sidebar TOC can slide out of its way.
 *
 * A block is "wide" when the layout system stamped its wrapper as full
 * text-column width (`span-cols-12`) or full-bleed (`span-cols-14`) — those are
 * the widths that reach under the sidebar. We match on that span class rather than
 * an enumerated list of block types, so new wide block types are covered
 * automatically as they ship. The sidebar coexists with ≤8-col content, so 8-col
 * blocks (e.g. chart-story) are deliberately not matched.
 */
const WIDE_BLOCK_SELECTORS = [
    ".article-block__sticky-left",
    ".article-block__sticky-right",
    ".article-block__sticky-left-right-column",
    ".article-block__sticky-right-left-column",
    ".article-block__side-by-side",
    ".article-block__chart-story",
    ".article-block__key-insights",
    ".article-block__all-charts",
    ".article-block__explorer",
    ".article-block__explorer-tiles",
    ".article-block__gray-section",
    ".article-block__featured-metrics",
    ".article-block__featured-data-insights",
    ".explore-data-section",
].join(", ")

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

        const intersecting = new Set<Element>()
        const observer = new IntersectionObserver(
            (records) => {
                for (const record of records) {
                    if (record.isIntersecting) intersecting.add(record.target)
                    else intersecting.delete(record.target)
                }
                if (intersecting.size > 0) {
                    debouncedSetInView.cancel()
                    setInView(true)
                } else {
                    debouncedSetInView(false)
                }
            },
            // Small top/bottom buffer so the slide-out begins just before the
            // wide block overlaps the sidebar.
            { rootMargin: "80px 0px 80px 0px" }
        )

        const blocks = document.querySelectorAll(WIDE_BLOCK_SELECTORS)
        blocks.forEach((block) => observer.observe(block))

        return () => {
            observer.disconnect()
            debouncedSetInView.cancel()
        }
    }, [debouncedSetInView])

    return inView
}
