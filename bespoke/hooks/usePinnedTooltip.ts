import { useEffect, useRef } from "react"
import { isTouchDevice } from "@ourworldindata/utils"

/**
 * Hook for dismissing tooltips pinned to the bottom on touch devices.
 * Dismisses when:
 * - the chart scrolls out of view
 * - the user taps outside the chart
 */
export function usePinnedTooltip<T extends HTMLElement = HTMLElement>(
    isActive: boolean,
    onDismiss: () => void
): {
    ref: React.RefObject<T | null>
    isPinned: boolean
} {
    const ref = useRef<T>(null)
    const isPinned = isTouchDevice()

    useEffect(() => {
        if (!isPinned || !isActive) return
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) onDismiss()
            },
            { threshold: 0 }
        )
        observer.observe(el)

        const handleDocumentTouch = (e: TouchEvent) => {
            if (!el.contains(e.target as Node)) onDismiss()
        }
        document.addEventListener("touchstart", handleDocumentTouch)

        return () => {
            observer.disconnect()
            document.removeEventListener("touchstart", handleDocumentTouch)
        }
    }, [isPinned, isActive, onDismiss])

    return { ref, isPinned }
}
