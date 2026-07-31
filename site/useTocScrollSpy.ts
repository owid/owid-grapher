import { useState, useEffect } from "react"

/**
 * Scroll-spy for the sidebar TOC. Given a document-ordered list of element ids
 * (H1 section slugs interleaved with chart anchor ids), returns the id the
 * reader is currently on: the last target whose top edge has scrolled above a
 * fixed activation line near the top of the viewport. Pure function of scroll
 * position — same model as the topic-page top nav, site/blocks/StickyNav.tsx.
 * `undefined` until the first measurement, "" once measured while above the
 * first target.
 *
 * Clicking a TOC link needs no special handling: the anchor jump fires a
 * scroll event and the spy recomputes from the landing position.
 */

// Activation line, in px from the top of the viewport: far enough below the
// page chrome that the TOC advances when a section feels visually current.
const ACTIVATION_OFFSET_PX = 160

export function useTocScrollSpy(ids: string[]): string | undefined {
    const [activeId, setActiveId] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (ids.length === 0) return

        let frame = 0

        const computeActiveId = (): string => {
            // "" when above the first target (reader at the top of the page).
            let current = ""
            for (const id of ids) {
                const el = document.getElementById(id)
                if (!el) continue // chart that didn't render — skip, no dead zone
                // Hidden responsive variant (e.g. a mobile-only chart on
                // desktop): display:none reports rect top 0, which would
                // always sit above the line and steal the active state.
                if (el.offsetParent === null) continue
                if (el.getBoundingClientRect().top <= ACTIVATION_OFFSET_PX)
                    current = id
                // Document order: once one target is below the line, the rest
                // are too.
                else break
            }
            return current
        }

        const update = () => {
            frame = 0
            const next = computeActiveId()
            setActiveId((prev) => (prev === next ? prev : next))
        }

        const onScrollOrResize = () => {
            if (frame === 0) frame = window.requestAnimationFrame(update)
        }

        window.addEventListener("scroll", onScrollOrResize, { passive: true })
        window.addEventListener("resize", onScrollOrResize, { passive: true })
        update() // initial sync (deep-link / reload mid-page)

        return () => {
            window.removeEventListener("scroll", onScrollOrResize)
            window.removeEventListener("resize", onScrollOrResize)
            if (frame !== 0) window.cancelAnimationFrame(frame)
        }
    }, [ids])

    return activeId
}
