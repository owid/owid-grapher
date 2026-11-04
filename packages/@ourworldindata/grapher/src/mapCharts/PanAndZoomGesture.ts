import { getRelativeMouse } from "@ourworldindata/utils"
import { calculateDistance } from "./MapHelpers"

export type Position = [x: number, y: number]

export interface PanAndZoomGestureHandlers {
    /** Start position relative to the element */
    onPanStart: (position: Position) => void
    /** Current pan position relative to the element */
    onPan: (position: Position) => void
    /** Negated wheel delta or change in pinch distance; positive zooms in */
    onZoom: (delta: number) => void
    onEnd: () => void
}

// End wheel gestures after 150 ms of inactivity
const WHEEL_IDLE_DELAY = 150

/**
 * Pan by dragging; zoom by wheel or pinch. After pinching, panning stays disabled
 * until all pointers lift to avoid jumps. Suppresses native dragging, selection,
 * wheel scrolling and clicks after drags; ignores ctrl+click and secondary buttons.
 * Requires `touch-action: none`. Returns listener cleanup.
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

    let wheelTimeout: ReturnType<typeof setTimeout> | undefined

    const onWheel = (event: WheelEvent): void => {
        swallow(event)
        if (wheelTimeout !== undefined) clearTimeout(wheelTimeout)
        onZoom(-event.deltaY)
        wheelTimeout = setTimeout(() => {
            wheelTimeout = undefined
            if (pointers.size === 0) onEnd()
        }, WHEEL_IDLE_DELAY)
    }

    // Active pointers in client coordinates
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

        // Defer capture until movement to preserve country click targets.
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

        if (pointers.size > 0) return

        blockSelectionAndDragging(false)

        // Suppress the click following a drag.
        if (moved && event.type === "pointerup") {
            window.addEventListener("click", swallow, true)
            setTimeout(() => window.removeEventListener("click", swallow, true))
        }

        hasPinched = false
        if (wheelTimeout === undefined) onEnd()
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
