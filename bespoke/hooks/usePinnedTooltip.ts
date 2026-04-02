import { useEffect, useRef } from "react"
import { isTouchDevice } from "@ourworldindata/utils"

/**
 * Hook for dismissing tooltips pinned to the bottom on touch devices
 * when the chart scrolls out of view.
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
        return () => observer.disconnect()
    }, [isPinned, isActive, onDismiss])

    return { ref, isPinned }
}
