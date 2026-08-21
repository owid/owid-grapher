import { useSyncExternalStore } from "react"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(callback: () => void): () => void {
    if (typeof window === "undefined") return (): void => undefined

    const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY)
    mediaQueryList.addEventListener("change", callback)

    return (): void => {
        mediaQueryList.removeEventListener("change", callback)
    }
}

export function getPrefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia(REDUCED_MOTION_QUERY).matches
    )
}

export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getPrefersReducedMotion, () => false)
}
