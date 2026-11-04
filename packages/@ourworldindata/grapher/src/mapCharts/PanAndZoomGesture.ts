import { getRelativeMouse } from "@ourworldindata/utils"
import { calculateDistance } from "./MapHelpers"

export type Position = [x: number, y: number]

export interface PanAndZoomGestureHandlers {
    /** A pan begins at the given position (relative to the element) */
    onPanStart: (position: Position) => void
    /** The pointer moved to the given position during a pan */
    onPan: (position: Position) => void
    /**
     * Zoom in (positive) or out (negative), either by scrolling (the wheel's
     * delta) or by pinching (the change in distance between both fingers)
     */
    onZoom: (delta: number) => void
    /** The gesture is over */
    onEnd: () => void
}

// A wheel gesture is considered over after this many ms without wheel events
const WHEEL_IDLE_DELAY = 150

/**
 * Turns pointer and wheel events on an element into pan and zoom callbacks:
 * - dragging with the mouse, a pen or one finger pans
 * - scrolling or pinching with two fingers zooms
 *
 * Once a gesture has pinched, it doesn't pan anymore until all pointers are
 * lifted, since lifting one finger would otherwise make the pan jump.
 *
 * It also
 * - keeps tracking a drag when the pointer leaves the element
 * - prevents text selection and native dragging during a drag
 * - suppresses the click that follows a drag
 * - prevents page scrolling while wheeling on the element
 * - ignores ctrl+click and non-primary mouse buttons
 *
 * The element needs `touch-action: none` so that the browser doesn't scroll
 * or zoom the page when a touch gesture starts on it.
 *
 * Returns a cleanup function that removes all listeners.
 */
export function attachPanAndZoomGesture(
    element: Element,
    handlers: PanAndZoomGestureHandlers
): () => void {
    const { onPanStart, onPan, onZoom, onEnd } = handlers

    const getPosition = (event: PointerEvent): Position => {
        const { x, y } = getRelativeMouse(element, event)
        return [x, y]
    }

    const preventDefault = (event: Event): void => event.preventDefault()

    const swallow = (event: Event): void => {
        event.preventDefault()
        event.stopImmediatePropagation()
    }

    // Wheel

    let wheelTimeout: ReturnType<typeof setTimeout> | undefined

    const onWheel = (event: WheelEvent): void => {
        swallow(event)
        if (wheelTimeout !== undefined) clearTimeout(wheelTimeout)
        onZoom(-event.deltaY)
        wheelTimeout = setTimeout(() => {
            wheelTimeout = undefined
            onEnd()
        }, WHEEL_IDLE_DELAY)
    }

    // Pointers

    // Client coordinates of all pointers that are currently down
    const pointers = new Map<number, Position>()
    let moved = false
    let hasPinched = false
    let pinchDistance: number | undefined

    const getPinchDistance = (): number => {
        const [a, b] = pointers.values()
        return calculateDistance(a, b)
    }

    const blockSelectionAndDragging = (block: boolean): void => {
        const method = block ? "addEventListener" : "removeEventListener"
        window[method]("dragstart", preventDefault, true)
        window[method]("selectstart", preventDefault, true)
    }

    const onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "mouse" && (event.ctrlKey || event.button))
            return

        pointers.set(event.pointerId, [event.clientX, event.clientY])

        if (pointers.size === 1) {
            moved = false
            blockSelectionAndDragging(true)
            onPanStart(getPosition(event))
        } else if (pointers.size === 2) {
            hasPinched = true
            pinchDistance = getPinchDistance()
        }
    }

    const onPointerMove = (event: PointerEvent): void => {
        const previous = pointers.get(event.pointerId)
        if (!previous) return
        if (previous[0] === event.clientX && previous[1] === event.clientY)
            return
        pointers.set(event.pointerId, [event.clientX, event.clientY])

        // Only capture the pointer once it moves, since capturing it on
        // pointerdown would retarget the click on a country to this element
        if (!moved) {
            moved = true
            element.setPointerCapture(event.pointerId)
        }

        if (pointers.size >= 2) {
            const distance = getPinchDistance()
            const delta = distance - (pinchDistance ?? distance)
            pinchDistance = distance
            if (delta !== 0) onZoom(delta)
        } else if (!hasPinched) {
            onPan(getPosition(event))
        }
    }

    const onPointerUp = (event: PointerEvent): void => {
        if (!pointers.delete(event.pointerId)) return
        if (pointers.size < 2) pinchDistance = undefined

        // The gesture is over once the last pointer is lifted
        if (pointers.size > 0) return

        blockSelectionAndDragging(false)

        // Swallow the click that the browser fires after a drag
        if (moved && event.type === "pointerup") {
            window.addEventListener("click", swallow, true)
            setTimeout(() => window.removeEventListener("click", swallow, true))
        }

        hasPinched = false
        onEnd()
    }

    const el = element as HTMLElement
    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove)
    el.addEventListener("pointerup", onPointerUp)
    el.addEventListener("pointercancel", onPointerUp)

    return (): void => {
        el.removeEventListener("wheel", onWheel)
        el.removeEventListener("pointerdown", onPointerDown)
        el.removeEventListener("pointermove", onPointerMove)
        el.removeEventListener("pointerup", onPointerUp)
        el.removeEventListener("pointercancel", onPointerUp)
        blockSelectionAndDragging(false)
        if (wheelTimeout !== undefined) clearTimeout(wheelTimeout)
    }
}
