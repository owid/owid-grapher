// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { attachPanAndZoomGesture } from "./PanAndZoomGesture"

let element: HTMLDivElement
let detach: () => void
const onPan = vi.fn()
const onEnd = vi.fn()

beforeEach(() => {
    vi.useFakeTimers()
    element = document.createElement("div")
    // happy-dom doesn't implement pointer capture; these tests exercise gesture timing.
    element.setPointerCapture = vi.fn()
    detach = attachPanAndZoomGesture(element, {
        onPanStart: vi.fn(),
        onPan,
        onZoom: vi.fn(),
        onEnd,
    })
})

afterEach(() => {
    detach()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
})

function pointer(type: string, clientX = 0): void {
    element.dispatchEvent(
        Object.assign(new MouseEvent(type, { clientX }), {
            pointerId: 1,
            pointerType: "mouse",
        })
    )
}

it("keeps a pan active after wheel input goes idle", () => {
    pointer("pointerdown")
    pointer("pointermove", 10)
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))

    vi.advanceTimersByTime(150)
    expect(onEnd).not.toHaveBeenCalled()

    pointer("pointermove", 20)
    expect(onPan).toHaveBeenLastCalledWith([20, 0])
    pointer("pointerup", 20)
    expect(onEnd).toHaveBeenCalledExactlyOnceWith()
})

it("waits for wheel input to go idle when the pointer lifts first", () => {
    pointer("pointerdown")
    pointer("pointermove", 10)
    element.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }))
    pointer("pointerup", 10)
    expect(onEnd).not.toHaveBeenCalled()

    vi.advanceTimersByTime(150)
    expect(onEnd).toHaveBeenCalledExactlyOnceWith()
})
