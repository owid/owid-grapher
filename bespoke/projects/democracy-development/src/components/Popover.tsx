import { useEffect } from "react"

/**
 * Close an inline popover on a pointer press outside `container`, or on Escape.
 *
 * `event.target` is retargeted to the Shadow DOM host by the time the event reaches the document,
 * so the event path is used to detect presses inside the container rather than DOM containment.
 */
export function useDismiss(
    container: React.RefObject<HTMLElement | null>,
    isOpen: boolean,
    onClose: () => void
): void {
    useEffect(() => {
        if (!isOpen) return
        const onPointerDown = (event: PointerEvent): void => {
            const el = container.current
            if (el && !event.composedPath().includes(el)) onClose()
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") onClose()
        }
        document.addEventListener("pointerdown", onPointerDown)
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("pointerdown", onPointerDown)
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [container, isOpen, onClose])
}
