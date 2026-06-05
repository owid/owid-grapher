import { useCallback, useEffect, useState } from "react"

/**
 * Measure an element's width via ResizeObserver and return it along with a
 * callback ref to attach
 */
export function useContainerWidth(options?: { target?: "self" | "parent" }): {
    width: number
    node: HTMLElement | null
    ref: (node: HTMLElement | null) => void
} {
    const target = options?.target ?? "self"
    const [node, setNode] = useState<HTMLElement | null>(null)
    const [width, setWidth] = useState(0)

    const ref = useCallback((el: HTMLElement | null) => {
        setNode(el)
    }, [])

    useEffect(() => {
        const observed = target === "parent" ? node?.parentElement : node
        if (!observed || typeof ResizeObserver === "undefined") return

        const update = () => setWidth(observed.clientWidth)

        const observer = new ResizeObserver(update)
        observer.observe(observed)
        update()
        return () => observer.disconnect()
    }, [node, target])

    return { width, node, ref }
}
