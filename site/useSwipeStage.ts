import { useEffect, useRef } from "react"
import { getPrefersReducedMotion } from "@ourworldindata/components"

/**
 * Drag-to-swipe with a real slide transition, shared by the swipe-driven
 * data-perspectives variants.
 *
 * The "stage" element follows the finger while you drag. Past the threshold,
 * it slides the rest of the way off-screen, the change is applied while it's
 * out of view, and it slides back in from the opposite edge — so a swipe reads
 * as "this moved away and the next one arrived", rather than something
 * changing in place with no visible cause.
 *
 * Only the axes you enable are claimed; a drag on any other axis is left alone
 * (so vertical page scrolling keeps working in the horizontal-only variants).
 */

export type SwipeDirection = "left" | "right" | "up" | "down"

export interface SwipeStageOptions {
    /** The element that moves. */
    stageRef: React.RefObject<HTMLElement | null>
    /** Where gestures are listened for. Omit to use the whole document. */
    surfaceRef?: React.RefObject<HTMLElement | null>
    axes: { x: boolean; y: boolean }
    /** Whether there's anything in that direction. Dead ends rubber-band. */
    canGo: (direction: SwipeDirection) => boolean
    /**
     * Apply the change. Called while the stage is off-screen. Return "leave"
     * when the change navigates to another page, so there's no slide-in.
     */
    onCommit: (direction: SwipeDirection) => void | "leave"
    /**
     * Gestures starting on these belong to the control, not the swipe. Only
     * list things with their own drag behaviour (sliders, text inputs):
     * links and buttons are fine to swipe from, as the click that follows a
     * swipe is swallowed.
     */
    isIgnoredTarget?: (target: EventTarget | null) => boolean
    /** Fires once a drag is recognised as a swipe (e.g. to dismiss a hint). */
    onInteract?: () => void
    enabled?: boolean
}

/** Movement before we decide which axis a drag is on, in px. */
const LOCK_PX = 10
/** Distance past which a released drag commits, in px. */
const COMMIT_PX = 60
/** Fraction of the drag a dead end follows, so it feels like a wall. */
const RESISTANCE = 0.3
const OUT_MS = 200
const IN_MS = 260

const directionOf = (axis: "x" | "y", delta: number): SwipeDirection =>
    axis === "x" ? (delta < 0 ? "left" : "right") : delta < 0 ? "up" : "down"

const translate = (axis: "x" | "y", px: number): string =>
    axis === "x" ? `translate3d(${px}px, 0, 0)` : `translate3d(0, ${px}px, 0)`

export interface SwipeStageControls {
    /**
     * Slide the stage out in `direction`, run `commit` while it's off-screen,
     * then slide back in — the same motion a swipe makes, for taps on dots.
     */
    slide: (direction: SwipeDirection, commit: () => void) => void
}

export function useSwipeStage(options: SwipeStageOptions): SwipeStageControls {
    // Keep the latest options in a ref so listeners bind once, not per render.
    const opts = useRef(options)
    opts.current = options
    const slideRef = useRef<SwipeStageControls["slide"]>((_d, commit) =>
        commit()
    )

    useEffect(() => {
        const surface = opts.current.surfaceRef?.current ?? document
        const gesture = {
            pointerId: null as number | null,
            x0: 0,
            y0: 0,
            axis: null as "x" | "y" | null,
            animating: false,
            // A swipe that starts on a link or button ends with the browser
            // firing a click on it; swallow that one click so the swipe
            // doesn't also navigate or toggle something.
            suppressClickUntil: 0,
        }

        const stage = () => opts.current.stageRef.current

        const snapBack = () => {
            const el = stage()
            if (!el) return
            el.style.transition = `transform ${IN_MS}ms ease-out`
            el.style.transform = ""
        }

        const slideThrough = (
            axis: "x" | "y",
            direction: SwipeDirection,
            commit: (d: SwipeDirection) => void | "leave" = opts.current
                .onCommit
        ) => {
            const el = stage()
            if (!el || getPrefersReducedMotion()) {
                commit(direction)
                if (el) el.style.transform = ""
                return
            }
            gesture.animating = true
            const size = axis === "x" ? el.offsetWidth : el.offsetHeight
            const sign = direction === "left" || direction === "up" ? -1 : 1

            el.style.transition = `transform ${OUT_MS}ms ease-in, opacity ${OUT_MS}ms ease-in`
            el.style.transform = translate(axis, sign * size)
            el.style.opacity = "0"

            window.setTimeout(() => {
                if (commit(direction) === "leave") return
                // Jump to the opposite edge with no transition, then slide in.
                el.style.transition = "none"
                el.style.transform = translate(axis, -sign * size)
                void el.offsetWidth // flush, so the jump isn't animated
                requestAnimationFrame(() => {
                    el.style.transition = `transform ${IN_MS}ms ease-out, opacity ${IN_MS}ms ease-out`
                    el.style.transform = ""
                    el.style.opacity = ""
                    window.setTimeout(() => {
                        gesture.animating = false
                        el.style.transition = ""
                    }, IN_MS)
                })
            }, OUT_MS)
        }

        slideRef.current = (direction, commit) => {
            if (gesture.animating) return
            const axis =
                direction === "left" || direction === "right" ? "x" : "y"
            slideThrough(axis, direction, () => {
                commit()
            })
        }

        const onDown = (e: Event) => {
            const ev = e as PointerEvent
            const o = opts.current
            if (o.enabled === false || gesture.animating) return
            if (o.isIgnoredTarget?.(ev.target)) return
            gesture.pointerId = ev.pointerId
            gesture.x0 = ev.clientX
            gesture.y0 = ev.clientY
            gesture.axis = null
        }

        const onMove = (e: Event) => {
            const ev = e as PointerEvent
            if (ev.pointerId !== gesture.pointerId) return
            const dx = ev.clientX - gesture.x0
            const dy = ev.clientY - gesture.y0

            if (!gesture.axis) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return
                const axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
                if (!opts.current.axes[axis]) {
                    // Not ours — e.g. a vertical scroll in a horizontal variant.
                    gesture.pointerId = null
                    return
                }
                gesture.axis = axis
                opts.current.onInteract?.()
            }

            const delta = gesture.axis === "x" ? dx : dy
            const direction = directionOf(gesture.axis, delta)
            const factor = opts.current.canGo(direction) ? 1 : RESISTANCE
            const el = stage()
            if (!el) return
            el.style.transition = "none"
            el.style.transform = translate(gesture.axis, delta * factor)
        }

        const onUp = (e: Event) => {
            const ev = e as PointerEvent
            if (ev.pointerId !== gesture.pointerId) return
            gesture.pointerId = null
            const axis = gesture.axis
            if (!axis) return
            gesture.suppressClickUntil = Date.now() + 400
            const delta =
                axis === "x" ? ev.clientX - gesture.x0 : ev.clientY - gesture.y0
            const direction = directionOf(axis, delta)
            if (Math.abs(delta) > COMMIT_PX && opts.current.canGo(direction)) {
                slideThrough(axis, direction)
            } else {
                snapBack()
            }
        }

        const onCancel = (e: Event) => {
            const ev = e as PointerEvent
            if (ev.pointerId !== gesture.pointerId) return
            gesture.pointerId = null
            if (gesture.axis) snapBack()
        }

        const onClick = (e: Event) => {
            if (Date.now() > gesture.suppressClickUntil) return
            gesture.suppressClickUntil = 0
            e.preventDefault()
            e.stopPropagation()
        }

        surface.addEventListener("pointerdown", onDown, true)
        surface.addEventListener("click", onClick, true)
        surface.addEventListener("pointermove", onMove, true)
        surface.addEventListener("pointerup", onUp, true)
        surface.addEventListener("pointercancel", onCancel, true)
        return () => {
            surface.removeEventListener("pointerdown", onDown, true)
            surface.removeEventListener("click", onClick, true)
            surface.removeEventListener("pointermove", onMove, true)
            surface.removeEventListener("pointerup", onUp, true)
            surface.removeEventListener("pointercancel", onCancel, true)
        }
    }, [])

    return {
        slide: (direction, commit) => slideRef.current(direction, commit),
    }
}
