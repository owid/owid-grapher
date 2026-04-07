import { useCallback, useRef } from "react"

/**
 * Returns a ref and a `getTippyContainer` callback for use with Tippy's `appendTo`.
 * Inside a Shadow DOM, portals the tooltip into the shadow root so styles apply.
 * Outside a Shadow DOM, falls back to `document.body`.
 */
export function useTippyContainer<T extends HTMLElement>(): {
    ref: React.RefObject<T | null>
    getTippyContainer: () => Element
} {
    const ref = useRef<T>(null)
    const getTippyContainer = useCallback(() => {
        const root = ref.current?.getRootNode()
        if (root instanceof ShadowRoot) return root as unknown as Element
        return document.body
    }, [])
    return { ref, getTippyContainer }
}
