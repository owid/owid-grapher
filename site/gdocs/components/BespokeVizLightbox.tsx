import { useCallback, useEffect, useRef, useState } from "react"
import cx from "clsx"
import {
    OwidEnrichedGdocBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"
import { ArticleBlocks } from "./ArticleBlocks.js"

/**
 * Stage 2: hover expand-to-lightbox for the `layout: bespoke-viz` variant.
 *
 * Wraps the viz (right) column and provides a hover-to-expand lightbox. ALL of
 * this is gated behind the bespoke-viz layout and pointer-fine/hover devices;
 * it never affects normal articles or touch devices.
 *
 * CRITICAL — the live viz instance is preserved across expand/collapse. The
 * bespoke component is imperatively mounted into a shadow root (see
 * BespokeComponent.tsx) and would lose all user state (country/year/sex/view)
 * if it were unmounted/remounted. So we:
 *   - keep <BespokeComponent> mounted in one stable place in the React tree
 *     (inside `vizHostRef`, whose JSX never changes across renders), and
 *   - physically MOVE that live shadow-host DOM node into the modal and back
 *     via appendChild — never React.createPortal, which would change the
 *     node's React identity and trigger the destructive mount-effect cleanup.
 * Because the host's JSX children are identical across renders, React's
 * reconciler leaves the moved DOM node where we put it.
 *
 * Open: mouseenter on the viz card. Close: pointer-MOTION based — we watch
 * document mousemove and close once the pointer is outside the modal body.
 * (mouseleave is deliberately avoided: it fires spuriously when the viz
 * reflows under a stationary cursor.) A short settle window after open and a
 * cooldown after close prevent flicker/immediate re-open.
 */

// Timing constants (see spec).
const FLIP_DURATION_MS = 350
const FLIP_EASING = "cubic-bezier(.22,.61,.36,1)"
const SETTLE_MS = 550 // ignore close for this long after opening
const REOPEN_COOLDOWN_MS = 300 // wait this long after close before reopening

const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

const supportsHover = (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(hover: hover) and (pointer: fine)").matches === true

export function BespokeVizLightbox({
    blocks,
    toc,
}: {
    blocks: OwidEnrichedGdocBlock[]
    toc?: TocHeadingWithTitleSupertitle[]
}) {
    // The element that holds the live bespoke-component DOM (moved into/out of
    // the modal). Its React JSX is static, so the reconciler never relocates it.
    const vizHostRef = useRef<HTMLDivElement>(null)
    // Where the viz lives when inline (collapsed).
    const inlineSlotRef = useRef<HTMLDivElement>(null)
    // Where the viz lives when expanded.
    const modalBodyRef = useRef<HTMLDivElement>(null)
    // The scrim element, whose opacity is animated imperatively.
    const scrimRef = useRef<HTMLDivElement>(null)

    const [isExpanded, setIsExpanded] = useState(false)

    // Guards against flicker. Refs (not state) so they don't trigger renders.
    const openedAtRef = useRef(0)
    const cooldownUntilRef = useRef(0)
    const isAnimatingRef = useRef(false)

    // --- FLIP helpers ----------------------------------------------------

    const expand = useCallback(() => {
        const host = vizHostRef.current
        const modalBody = modalBodyRef.current
        const inlineSlot = inlineSlotRef.current
        const scrim = scrimRef.current
        if (!host || !modalBody || !inlineSlot || !scrim) return
        if (isAnimatingRef.current) return

        isAnimatingRef.current = true

        // Hold the inline column's height so the dimmed background doesn't
        // collapse/jump when the viz node is lifted out.
        const firstRect = host.getBoundingClientRect()
        inlineSlot.style.height = `${firstRect.height}px`

        // Reparent the LIVE host node into the modal body. No remount: the
        // viz's shadow root and its internal state come along untouched.
        modalBody.appendChild(host)

        const settle = () => {
            openedAtRef.current = performance.now()
            isAnimatingRef.current = false
        }

        if (prefersReducedMotion()) {
            // Skip the FLIP entirely: just reveal with a simple cross-fade.
            modalBody.style.visibility = "visible"
            scrim.style.opacity = "1"
            settle()
            return
        }

        // FLIP: measure Last (the modal body's final rect), then invert.
        const lastRect = modalBody.getBoundingClientRect()
        const dx = firstRect.left - lastRect.left
        const dy = firstRect.top - lastRect.top
        const scale = lastRect.width ? firstRect.width / lastRect.width : 1

        // Apply the inverse transform with no transition, while the body is
        // still hidden, to avoid a one-frame full-size flash.
        modalBody.style.transition = "none"
        modalBody.style.transformOrigin = "top left"
        modalBody.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
        modalBody.style.visibility = "visible"

        // Force reflow so the inverted transform is committed before animating.
        void modalBody.offsetWidth

        requestAnimationFrame(() => {
            modalBody.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
            modalBody.style.transform = "none"
            // Cross-fade the scrim in over the same window.
            scrim.style.opacity = "1"

            const onEnd = (e: TransitionEvent) => {
                if (e.propertyName !== "transform") return
                modalBody.removeEventListener("transitionend", onEnd)
                modalBody.style.transition = ""
                modalBody.style.transform = ""
                modalBody.style.transformOrigin = ""
                settle()
            }
            modalBody.addEventListener("transitionend", onEnd)
        })
    }, [])

    const collapse = useCallback(() => {
        const host = vizHostRef.current
        const modalBody = modalBodyRef.current
        const inlineSlot = inlineSlotRef.current
        const scrim = scrimRef.current
        if (!host || !modalBody || !inlineSlot || !scrim) return
        if (isAnimatingRef.current) return

        isAnimatingRef.current = true

        const finish = () => {
            // Move the live node back inline, reset the modal body, release the
            // held height, and start the re-open cooldown.
            inlineSlot.appendChild(host)
            modalBody.style.transition = ""
            modalBody.style.transform = ""
            modalBody.style.transformOrigin = ""
            modalBody.style.visibility = ""
            scrim.style.opacity = ""
            inlineSlot.style.height = ""
            cooldownUntilRef.current = performance.now() + REOPEN_COOLDOWN_MS
            isAnimatingRef.current = false
            // Tear down the modal scaffolding (display/pointer-events) last.
            setIsExpanded(false)
        }

        if (prefersReducedMotion()) {
            finish()
            return
        }

        // FLIP toward the inline rect.
        const lastRect = host.getBoundingClientRect() // current (expanded)
        const targetRect = inlineSlot.getBoundingClientRect()
        const dx = targetRect.left - lastRect.left
        const dy = targetRect.top - lastRect.top
        const scale = lastRect.width ? targetRect.width / lastRect.width : 1

        modalBody.style.transformOrigin = "top left"
        modalBody.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}`
        // Fade the scrim out alongside the transform.
        scrim.style.opacity = "0"

        requestAnimationFrame(() => {
            modalBody.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
        })

        const onEnd = (e: TransitionEvent) => {
            if (e.propertyName !== "transform") return
            modalBody.removeEventListener("transitionend", onEnd)
            finish()
        }
        modalBody.addEventListener("transitionend", onEnd)
    }, [])

    // --- Open trigger: mouseenter on the inline viz card -----------------

    const handleMouseEnter = useCallback(() => {
        if (isExpanded || isAnimatingRef.current) return
        if (!supportsHover()) return
        if (performance.now() < cooldownUntilRef.current) return
        setIsExpanded(true)
    }, [isExpanded])

    // Run the expand FLIP once the modal scaffolding (display/pointer-events)
    // has been rendered by React. `expand` is a stable useCallback, so this
    // effect only re-runs when `isExpanded` changes; collapse() is driven
    // explicitly by the close handler, not here.
    useEffect(() => {
        if (isExpanded) expand()
    }, [isExpanded, expand])

    // --- Close trigger: pointer MOTION outside the modal body ------------

    useEffect(() => {
        if (!isExpanded) return

        const onMove = (e: MouseEvent) => {
            // Settle window: ignore close shortly after opening (the viz
            // reflow can move things under a stationary cursor).
            if (performance.now() - openedAtRef.current < SETTLE_MS) return
            if (isAnimatingRef.current) return
            const modalBody = modalBodyRef.current
            if (!modalBody) return
            const target = e.target as Node | null
            if (target && modalBody.contains(target)) return
            collapse()
        }

        document.addEventListener("mousemove", onMove)
        return () => document.removeEventListener("mousemove", onMove)
    }, [isExpanded, collapse])

    return (
        <>
            <div className="bespoke-viz-layout__viz">
                <div
                    className="bespoke-viz-layout__viz-sticky"
                    ref={inlineSlotRef}
                    onMouseEnter={handleMouseEnter}
                >
                    {/* The live viz host. Its JSX is static across renders, so
                        the reconciler never relocates the DOM node we move by
                        hand. */}
                    <div
                        className="bespoke-viz-layout__viz-host"
                        ref={vizHostRef}
                    >
                        <ArticleBlocks blocks={blocks} toc={toc} />
                    </div>
                </div>
            </div>

            {/* Modal scaffolding, a sibling of the two columns inside
                .bespoke-viz-layout. It's absolutely positioned over the layout
                (NOT fixed to the viewport), so the site nav / header band stay
                uncovered. Kept mounted; --open toggles display + pointer-events,
                the scrim opacity and body transform are animated imperatively. */}
            <div
                className={cx("bespoke-viz-lightbox", {
                    "bespoke-viz-lightbox--open": isExpanded,
                })}
                aria-hidden={!isExpanded}
            >
                <div className="bespoke-viz-lightbox__scrim" ref={scrimRef} />
                <div className="bespoke-viz-lightbox__box">
                    <div
                        className="bespoke-viz-lightbox__body"
                        ref={modalBodyRef}
                    />
                </div>
            </div>
        </>
    )
}
