import { useSyncExternalStore } from "react"

export type Breakpoint = "large" | "medium" | "small"

const BREAKPOINTS = {
    medium: "(max-width: 1024px)",
    small: "(max-width: 768px)",
}

function getBreakpoint(): Breakpoint {
    if (typeof window === "undefined") return "large"
    if (window.matchMedia(BREAKPOINTS.small).matches) return "small"
    if (window.matchMedia(BREAKPOINTS.medium).matches) return "medium"
    return "large"
}

function subscribe(callback: () => void): () => void {
    const mediaQueries = Object.values(BREAKPOINTS).map((query) =>
        window.matchMedia(query)
    )
    for (const mq of mediaQueries) {
        mq.addEventListener("change", callback)
    }
    return () => {
        for (const mq of mediaQueries) {
            mq.removeEventListener("change", callback)
        }
    }
}

export function useBreakpoint(): Breakpoint {
    return useSyncExternalStore(subscribe, getBreakpoint, () => "large")
}
