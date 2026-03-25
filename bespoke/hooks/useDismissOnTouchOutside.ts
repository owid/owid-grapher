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

        const handler = (e: PointerEvent) => {
            if (
                e.pointerType === "touch" &&
                !ref.current?.contains(e.target as Node)
            ) {
                onDismiss()
            }
        }

        document.addEventListener("pointerdown", handler)

        return () => document.removeEventListener("pointerdown", handler)
    }, [ref, isActive, onDismiss])
}
