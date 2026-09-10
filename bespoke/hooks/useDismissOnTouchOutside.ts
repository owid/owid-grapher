import { useEffect } from "react"

/**
 * Dismisses a hover/tooltip state when the user taps outside the given element.
 * Only responds to touch events — mouse clicks are ignored.
 */
export function useDismissOnTouchOutside(
    ref: React.RefObject<Element | null>,
    isActive: boolean,
    onDismiss: () => void
): void {
    useEffect(() => {
        if (!isActive) return

        const handler = (event: PointerEvent) => {
            const element = ref.current
            if (
                event.pointerType === "touch" &&
                element &&
                // `event.target` is retargeted to the Shadow DOM host by the time
                // the event reaches the document, so use the event path to detect
                // taps inside `element` rather than checking DOM containment
                !event.composedPath().includes(element)
            ) {
                onDismiss()
            }
        }

        document.addEventListener("pointerdown", handler)

        return () => document.removeEventListener("pointerdown", handler)
    }, [ref, isActive, onDismiss])
}
