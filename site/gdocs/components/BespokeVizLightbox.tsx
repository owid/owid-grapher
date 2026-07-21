import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExpand, faXmark } from "@fortawesome/free-solid-svg-icons"
import { EnrichedBlockBespokeComponent } from "@ourworldindata/types"
import { BespokeComponent } from "./BespokeComponent.js"

/**
 * Click-to-expand lightbox wrapper for a SINGLE `bespoke-component` block,
 * used by the `layout: bespoke-viz` article variant. It's rendered from
 * ArticleBlock's bespoke-component arm (gated on the bespoke-viz layout flag),
 * so it enhances the viz wherever it sits — including inside an author's
 * `{.sticky-left}` container. Normal articles render a plain <BespokeComponent>.
 *
 * CRITICAL — the live viz instance is preserved across expand/collapse. The
 * bespoke component is imperatively mounted into a shadow root (see
 * BespokeComponent.tsx) and would lose all user state (country/year/sex/view)
 * if it were unmounted/remounted. So we:
 *   - keep <BespokeComponent> mounted in one stable place in the React tree
 *     (inside `vizHostRef`, whose JSX never changes across renders), and
 *   - physically MOVE that live shadow-host DOM node into the modal and back
 *     via appendChild. We never React-RENDER the viz through the portal — that
 *     would change its React identity and trigger the destructive mount-effect
 *     cleanup. The imperative appendChild is independent of where the modal
 *     lives in the React tree, so it works fine into a portaled modal body.
 * Because the host's JSX children are identical across renders, React's
 * reconciler leaves the moved DOM node where we put it.
 *
 * Portal: the modal SCAFFOLDING (scrim + box, but NOT the viz) is rendered via
 * createPortal to document.body. The inline viz sits deep in the article
 * subtree, which is trapped inside an ancestor stacking context that paints
 * below the site nav — so a `position: fixed; z-index: 99990` modal left in
 * that subtree still renders under the nav. Portaling to document.body makes
 * the overlay a top-level stacking context (sibling to the nav), so its high
 * z-index wins and it covers the nav. The inline host slot stays in the
 * article tree for the live viz node to return to on close.
 *
 * Triggers (all explicit clicks/keys — no hover):
 *   - Open: the "Full screen" button on the inline viz.
 *   - Close: the × button, a click on the dimmed scrim, or the Escape key.
 *
 * The expand/collapse uses a FLIP animation (350ms), honouring
 * prefers-reduced-motion (which skips the FLIP and just cross-fades). The modal
 * is `position: fixed`, so getBoundingClientRect (viewport coords) drives the
 * FLIP correctly regardless of the portal (viewport-relative math is unchanged).
 *
 * Full-screen overlay: the scrim covers the ENTIRE viewport (nav + page header
 * + body) above the site chrome, and background scroll is locked (frozen at the
 * current position) while open, restored on close. The scroll lock is torn down
 * on close AND on unmount so the page can never get stuck unscrollable. On
 * unmount the live viz node is returned inline first so it's never orphaned.
 */

// Timing constants.
const FLIP_DURATION_MS = 350
const FLIP_EASING = "cubic-bezier(.22,.61,.36,1)"

const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true

export function BespokeVizLightbox({
    className,
    block,
}: {
    className?: string
    block: EnrichedBlockBespokeComponent
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
    // The modal box (white card + close button); faded in/out with the scrim.
    const boxRef = useRef<HTMLDivElement>(null)

    const [isExpanded, setIsExpanded] = useState(false)
    // The modal is portaled to document.body, which doesn't exist during SSR;
    // only render the portal once mounted on the client.
    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => setIsMounted(true), [])

    // Prevents overlapping open/close animations.
    const isAnimatingRef = useRef(false)

    // --- FLIP helpers ----------------------------------------------------

    const expand = useCallback(() => {
        const host = vizHostRef.current
        const modalBody = modalBodyRef.current
        const inlineSlot = inlineSlotRef.current
        const scrim = scrimRef.current
        const box = boxRef.current
        if (!host || !modalBody || !inlineSlot || !scrim || !box) return
        if (isAnimatingRef.current) return

        isAnimatingRef.current = true

        // Hold the inline slot's height so the surrounding layout doesn't
        // collapse/jump when the viz node is lifted out.
        const firstRect = host.getBoundingClientRect()
        inlineSlot.style.height = `${firstRect.height}px`

        // Reparent the LIVE host node into the modal body. No remount: the
        // viz's shadow root and its internal state come along untouched.
        modalBody.appendChild(host)

        const settle = () => {
            isAnimatingRef.current = false
        }

        if (prefersReducedMotion()) {
            // Skip the FLIP entirely: just reveal with a simple cross-fade.
            modalBody.style.visibility = "visible"
            scrim.style.opacity = "1"
            box.style.opacity = "1"
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
            // Cross-fade the scrim and box in over the same window.
            scrim.style.opacity = "1"
            box.style.opacity = "1"

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
        const box = boxRef.current
        if (!host || !modalBody || !inlineSlot || !scrim || !box) return
        if (isAnimatingRef.current) return

        isAnimatingRef.current = true

        const finish = () => {
            // Move the live node back inline, reset the modal body, release the
            // held height.
            inlineSlot.appendChild(host)
            modalBody.style.transition = ""
            modalBody.style.transform = ""
            modalBody.style.transformOrigin = ""
            modalBody.style.visibility = ""
            scrim.style.opacity = ""
            box.style.opacity = ""
            inlineSlot.style.height = ""
            isAnimatingRef.current = false
            // Tear down the modal scaffolding (display) last.
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
        // Fade the scrim and box out alongside the transform.
        scrim.style.opacity = "0"
        box.style.opacity = "0"

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

    // --- Triggers --------------------------------------------------------

    const handleExpandClick = useCallback(() => {
        if (isExpanded || isAnimatingRef.current) return
        setIsExpanded(true)
    }, [isExpanded])

    const handleCloseClick = useCallback(() => {
        if (!isExpanded) return
        collapse()
    }, [isExpanded, collapse])

    // Run the expand FLIP once the modal scaffolding has been rendered by
    // React. `expand` is a stable useCallback, so this effect only re-runs when
    // `isExpanded` changes; collapse() is driven explicitly by the close
    // handlers, not here.
    useEffect(() => {
        if (isExpanded) expand()
    }, [isExpanded, expand])

    // Escape closes the lightbox (keyboard freebie; no full focus-trap).
    useEffect(() => {
        if (!isExpanded) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") collapse()
        }
        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [isExpanded, collapse])

    // Lock background scroll while the lightbox is open, freezing the page at
    // its current position. We use `overflow: hidden` on <html> (rather than
    // the fixed-body technique) because it does NOT move the page content —
    // that keeps the inline viz's getBoundingClientRect stable for the FLIP.
    // We compensate for the removed scrollbar with padding-right so the page
    // behind doesn't shift. The cleanup restores the original inline styles and
    // runs on BOTH close (isExpanded -> false re-runs this effect) AND unmount,
    // so the page can never get stuck unscrollable.
    useEffect(() => {
        if (!isExpanded) return
        if (typeof document === "undefined") return

        const html = document.documentElement
        const prevOverflow = html.style.overflow
        const prevPaddingRight = html.style.paddingRight

        const scrollbarWidth = window.innerWidth - html.clientWidth
        html.style.overflow = "hidden"
        if (scrollbarWidth > 0) {
            html.style.paddingRight = `${scrollbarWidth}px`
        }

        return () => {
            html.style.overflow = prevOverflow
            html.style.paddingRight = prevPaddingRight
        }
    }, [isExpanded])

    // Safety: if this component unmounts while the viz is expanded, the live
    // host node currently lives in the portaled modal body — which React will
    // tear down. Move it back to its inline slot on unmount so it isn't
    // orphaned/destroyed. (Runs only on unmount: empty dep array.)
    // Capture the ref nodes now (they're stable for the component's life) so the
    // cleanup doesn't read ref.current directly — which the react-hooks lint
    // rule flags as unsafe. We still check the host's live parent at cleanup.
    useEffect(() => {
        const host = vizHostRef.current
        const inlineSlot = inlineSlotRef.current
        return () => {
            if (host && inlineSlot && host.parentElement !== inlineSlot) {
                inlineSlot.appendChild(host)
            }
        }
    }, [])

    // Hide the viz's OWN internal heading (title + subtitle) inside its shadow
    // root, but ONLY in the bespoke-viz chrome — the standalone migration
    // article must keep its heading. The bespoke component mounts into an open
    // shadow root asynchronously, so we watch for the shadow host to appear and
    // then inject a scoped <style> into that shadow root. (The selector is
    // migration-specific for now, since that's the only bespoke bundle.)
    useEffect(() => {
        const root = vizHostRef.current
        if (!root) return

        let cancelled = false
        // Stop polling after ~10s so we never leak a timer if the shadow root
        // (for whatever reason) never appears.
        const deadline = performance.now() + 10_000

        const tryInject = (): boolean => {
            // Find the shadow host (the element attachShadow was called on)
            // among the viz host's descendants, and inject once.
            const candidates = root.querySelectorAll<HTMLElement>("*")
            for (const el of candidates) {
                const shadow = el.shadowRoot
                if (!shadow) continue
                if (
                    shadow.querySelector("style[data-bespoke-viz-hide-heading]")
                )
                    return true
                const style = document.createElement("style")
                style.setAttribute("data-bespoke-viz-hide-heading", "")
                style.textContent = ".migration-heading { display: none; }"
                shadow.appendChild(style)
                return true
            }
            return false
        }

        // The shadow root is attached asynchronously (dynamic import in
        // BespokeComponent), and attaching it does not produce a light-DOM
        // mutation we could observe — so poll on a frame timer until it exists.
        const tick = () => {
            if (cancelled) return
            if (tryInject()) return
            if (performance.now() > deadline) return
            window.setTimeout(tick, 100)
        }
        tick()

        return () => {
            cancelled = true
        }
    }, [])

    return (
        <>
            {/* Inline slot: the viz sits here in the flow (inside whatever
                container the author placed it in). Fit-to-viewport sizing and
                the sticky behaviour come from the surrounding column CSS. */}
            <div
                className={cx("bespoke-viz-enhanced", className)}
                ref={inlineSlotRef}
            >
                <div className="bespoke-viz-enhanced__inner">
                    {/* Explicit open trigger — icon + label; the aria-label
                        provides the accessible name. */}
                    <button
                        type="button"
                        className="bespoke-viz-expand-button"
                        onClick={handleExpandClick}
                        aria-label="Expand visualization"
                    >
                        <FontAwesomeIcon icon={faExpand} />
                        Full screen
                    </button>
                    {/* The live viz host. Its JSX is static across renders, so
                        the reconciler never relocates the DOM node we move by
                        hand. */}
                    <div
                        className="bespoke-viz-enhanced__host"
                        ref={vizHostRef}
                    >
                        <BespokeComponent block={block} />
                    </div>
                </div>
            </div>

            {/* Modal scaffolding — portaled to document.body so it escapes the
                article's trapped stacking context and covers the site nav.
                Kept mounted (client-only); --open toggles display, the scrim
                opacity and body transform are animated imperatively. The live
                viz node is moved into __body imperatively (not rendered here),
                so no remount. */}
            {isMounted &&
                createPortal(
                    <div
                        className={cx("bespoke-viz-lightbox", {
                            "bespoke-viz-lightbox--open": isExpanded,
                        })}
                        aria-hidden={!isExpanded}
                    >
                        <div
                            className="bespoke-viz-lightbox__scrim"
                            ref={scrimRef}
                            onClick={handleCloseClick}
                        />
                        <div className="bespoke-viz-lightbox__box" ref={boxRef}>
                            <button
                                type="button"
                                className="bespoke-viz-lightbox__close"
                                onClick={handleCloseClick}
                                aria-label="Close"
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                            <div
                                className="bespoke-viz-lightbox__body"
                                ref={modalBodyRef}
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}
