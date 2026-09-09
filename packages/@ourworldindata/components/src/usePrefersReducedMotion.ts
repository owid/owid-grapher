import { useMediaQuery } from "usehooks-ts"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

export function getPrefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia(REDUCED_MOTION_QUERY).matches
    )
}

export const usePrefersReducedMotion = () => useMediaQuery(REDUCED_MOTION_QUERY)
