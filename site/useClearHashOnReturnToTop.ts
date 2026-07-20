import { useEffect, useRef } from "react"

/**
 * Clears a lingering #section from the URL when the reader returns to the top
 * of the page (scrolling up above the first section, or clicking "Back to
 * top"), so it no longer points at a section they've scrolled away from.
 *
 * Fires only on the transition from a section to "" — `undefined` (scroll-spy
 * hasn't measured yet) never counts, so a deep-link #section survives the
 * initial render. replaceState avoids both a new history entry and a scroll
 * jump.
 */
export const useClearHashOnReturnToTop = (
    activeId: string | undefined
): void => {
    const prevActiveIdRef = useRef(activeId)
    useEffect(() => {
        const prev = prevActiveIdRef.current
        prevActiveIdRef.current = activeId
        const hadActiveSection = prev !== undefined && prev !== ""
        if (hadActiveSection && activeId === "" && window.location.hash) {
            history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
            )
        }
    }, [activeId])
}
