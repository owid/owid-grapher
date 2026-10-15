import { RefObject, useEffect, useRef } from "react"
import { getPrefersReducedMotion } from "@ourworldindata/components"

/**
 * Scrolls the referenced alert into view whenever `error` changes to a
 * non-null value. Callers pass a fresh object per failed submit, so repeated
 * submits scroll again even when the message is the same.
 */
export function useScrollAlertIntoView(
    error: object | null | undefined
): RefObject<HTMLDivElement | null> {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!error) return
        ref.current?.scrollIntoView({
            behavior: getPrefersReducedMotion() ? "auto" : "smooth",
            block: "center",
        })
    }, [error])
    return ref
}
