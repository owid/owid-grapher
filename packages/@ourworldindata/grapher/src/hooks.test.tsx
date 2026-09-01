/**
 * @vitest-environment happy-dom
 */

import { act, render } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { useElementBounds } from "./hooks.js"

let resizeObserverCallback: ResizeObserverCallback | undefined

class ResizeObserverMock implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback
    }

    observe(): void {
        return
    }
    unobserve(): void {
        return
    }
    disconnect(): void {
        return
    }
}

function BoundsProbe(): React.ReactElement {
    const ref = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(ref, null, {
        throttleTime: 0,
        preserveLastNonZeroBounds: true,
    })

    return (
        <div ref={ref} data-testid="probe">
            {bounds ? `${bounds.width}x${bounds.height}` : "unmeasured"}
        </div>
    )
}

function reportResize(width: number, height: number): void {
    const callback = resizeObserverCallback
    if (!callback) throw new Error("ResizeObserver has not been initialized")

    callback(
        [
            {
                contentRect: { width, height },
            } as ResizeObserverEntry,
        ],
        {} as ResizeObserver
    )
}

afterEach(() => {
    resizeObserverCallback = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

it("preserves the last non-zero bounds while an element is hidden", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: 800,
        height: 600,
    } as DOMRect)

    const { getByTestId } = render(<BoundsProbe />)
    expect(getByTestId("probe")).toHaveTextContent("800x600")

    act(() => reportResize(0, 0))
    expect(getByTestId("probe")).toHaveTextContent("800x600")

    act(() => reportResize(700, 500))
    expect(getByTestId("probe")).toHaveTextContent("700x500")
})
