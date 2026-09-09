import { createContext, useContext } from "react"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

export type Breakpoint = "large" | "medium" | "small" | "narrow"

const THRESHOLDS = {
    narrow: 500,
    small: 768,
    medium: 1024,
}

export function toBreakpoint(width: number): Breakpoint {
    if (width <= THRESHOLDS.narrow) return "narrow"
    if (width <= THRESHOLDS.small) return "small"
    if (width <= THRESHOLDS.medium) return "medium"
    return "large"
}

const BreakpointContext = createContext<Breakpoint>("large")

export const BreakpointProvider = BreakpointContext.Provider

export function useBreakpoint(): Breakpoint {
    return useContext(BreakpointContext)
}

/** Measure the width of a container element and return the breakpoint + a callback ref. */
export function useContainerBreakpoint(): {
    breakpoint: Breakpoint
    ref: (node: HTMLElement | null) => void
} {
    // Observe the parent element's width to avoid circular dependencies
    // when this element has a max-width that depends on the breakpoint.
    const { width, ref } = useContainerWidth({ target: "parent" })

    // Default to "large" until the first measurement lands (width 0)
    const breakpoint = width > 0 ? toBreakpoint(width) : "large"

    return { breakpoint, ref }
}

/** CSS class name for the current breakpoint */
export function breakpointClass(breakpoint: Breakpoint): string {
    return `breakpoint-${breakpoint}`
}
