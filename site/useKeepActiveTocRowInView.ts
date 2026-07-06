import { useEffect, useRef, type RefObject } from "react"

const ACTIVE_TOC_ROW_SCROLL_MARGIN = 16

export const useKeepActiveTocRowInView = (
    activeId: string | undefined
): RefObject<HTMLDivElement | null> => {
    const containerRef = useRef<HTMLDivElement>(null)

    // Keep the active row visible inside the TOC's own scroll container as the
    // scroll-spy advances. scrollTop is computed by hand (not scrollIntoView,
    // which walks up the scroll chain) so this can never move the page.
    useEffect(() => {
        if (!activeId) return
        const container = containerRef.current
        // offsetParent is null when the container is display:none (mobile).
        if (!container || container.offsetParent === null) return

        const row = container.querySelector<HTMLElement>(
            `[data-toc-id="${CSS.escape(activeId)}"]`
        )
        if (!row) return

        // Row position relative to the container's scrollable content (uses
        // rects, not offsetTop, since the row can be positioned).
        const containerRect = container.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        const rowTop = rowRect.top - containerRect.top + container.scrollTop
        const rowBottom = rowTop + rowRect.height
        const viewTop = container.scrollTop
        const viewBottom = viewTop + container.clientHeight

        let targetScrollTop: number | undefined
        if (rowTop < viewTop + ACTIVE_TOC_ROW_SCROLL_MARGIN) {
            targetScrollTop = rowTop - ACTIVE_TOC_ROW_SCROLL_MARGIN
        } else if (rowBottom > viewBottom - ACTIVE_TOC_ROW_SCROLL_MARGIN) {
            targetScrollTop =
                rowBottom -
                container.clientHeight +
                ACTIVE_TOC_ROW_SCROLL_MARGIN
        } else {
            return // already comfortably visible
        }

        const maxScrollTop = container.scrollHeight - container.clientHeight
        const nextScrollTop = Math.max(
            0,
            Math.min(targetScrollTop, maxScrollTop)
        )
        if (Math.abs(nextScrollTop - viewTop) < 1) return
        // Instant: no animation to compete with the reader's own scrolling.
        container.scrollTo({ top: nextScrollTop })
    }, [activeId])

    return containerRef
}
