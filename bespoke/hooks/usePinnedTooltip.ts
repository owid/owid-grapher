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

        // `composedPath`, not `contains`: inside a Shadow DOM the event is
        // retargeted to the host by the time it reaches the document, so a
        // containment check would treat every tap as an outside tap
        const handleDocumentTouch = (e: TouchEvent) => {
            if (!e.composedPath().includes(el)) onDismiss()
        }
        document.addEventListener("touchstart", handleDocumentTouch)

        return () => {
            observer.disconnect()
            document.removeEventListener("touchstart", handleDocumentTouch)
        }
    }, [isPinned, isActive, onDismiss])

    return { ref, isPinned }
}
