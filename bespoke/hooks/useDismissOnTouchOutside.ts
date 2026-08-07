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
                // `composedPath`, not `contains`: inside a Shadow DOM the event is
                // retargeted to the host by the time it reaches the document, so a
                // containment check would treat every tap as an outside tap
                !event.composedPath().includes(element)
            ) {
                onDismiss()
            }
        }

        document.addEventListener("pointerdown", handler)

        return () => document.removeEventListener("pointerdown", handler)
    }, [ref, isActive, onDismiss])
}
