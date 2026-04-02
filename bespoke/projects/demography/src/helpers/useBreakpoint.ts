import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react"

export type Breakpoint = "large" | "medium" | "small" | "narrow"

const THRESHOLDS = {
    narrow: 500,
    small: 768,
    medium: 1024,
}

export function widthToBreakpoint(width: number): Breakpoint {
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
    const [node, setNode] = useState<HTMLElement | null>(null)
    const [breakpoint, setBreakpoint] = useState<Breakpoint>("large")

    const ref = useCallback((el: HTMLElement | null) => {
        setNode(el)
    }, [])

    useEffect(() => {
        // Observe the parent element's width to avoid circular dependencies
        // when this element has a max-width that depends on the breakpoint.
        const target = node?.parentElement
        if (!target) return

        const update = () =>
            setBreakpoint(widthToBreakpoint(target.clientWidth))

        const observer = new ResizeObserver(update)
        observer.observe(target)
        update()
        return () => observer.disconnect()
    }, [node])

    return { breakpoint, ref }
}

/** CSS class name for the current breakpoint */
export function breakpointClass(breakpoint: Breakpoint): string {
    return `breakpoint-${breakpoint}`
}
