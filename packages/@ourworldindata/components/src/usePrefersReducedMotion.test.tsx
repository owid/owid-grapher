/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react"
import type { ReactElement } from "react"
import ReactDOMServer from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import {
    getPrefersReducedMotion,
    usePrefersReducedMotion,
} from "./usePrefersReducedMotion"

function createMatchMediaMock(initialMatches: boolean): {
    matchMedia: typeof window.matchMedia
    setMatches: (matches: boolean) => void
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
} {
    const listeners = new Set<EventListenerOrEventListenerObject>()
    let matches = initialMatches

    const addEventListener = vi.fn(
        (type: string, listener: EventListenerOrEventListenerObject): void => {
            if (type === "change") listeners.add(listener)
        }
    )
    const removeEventListener = vi.fn(
        (type: string, listener: EventListenerOrEventListenerObject): void => {
            if (type === "change") listeners.delete(listener)
        }
    )

    const mediaQueryList = {
        get matches(): boolean {
            return matches
        },
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener,
        removeEventListener,
        dispatchEvent: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
    } as unknown as MediaQueryList

    return {
        matchMedia: vi.fn(() => mediaQueryList),
        setMatches: (nextMatches: boolean): void => {
            matches = nextMatches
            const event = new Event("change")
            for (const listener of listeners) {
                if (typeof listener === "function") listener(event)
                else listener.handleEvent(event)
            }
        },
        addEventListener,
        removeEventListener,
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

function ReducedMotionPreference(): ReactElement {
    return <span>{String(usePrefersReducedMotion())}</span>
}

it("returns false when rendered on the server", () => {
    vi.stubGlobal("window", undefined)
    expect(getPrefersReducedMotion()).toBe(false)
    expect(
        ReactDOMServer.renderToString(<ReducedMotionPreference />)
    ).toContain("false")
})

it("reads the current reduced-motion preference", () => {
    const { matchMedia } = createMatchMediaMock(true)
    vi.stubGlobal("matchMedia", matchMedia)

    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(true)
})

it("updates on preference changes and cleans up its listener", () => {
    const { matchMedia, setMatches, addEventListener, removeEventListener } =
        createMatchMediaMock(false)
    vi.stubGlobal("matchMedia", matchMedia)

    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
    expect(addEventListener).toHaveBeenCalledOnce()

    act(() => setMatches(true))
    expect(result.current).toBe(true)

    unmount()
    expect(removeEventListener).toHaveBeenCalledOnce()
})
