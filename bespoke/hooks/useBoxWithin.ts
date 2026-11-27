import { useEffect, useState } from "react"

/** An axis-aligned box in px, relative to a container's top-left corner */
export interface Box {
    left: number
    right: number
    top: number
    bottom: number
}

function isSameBox(a: Box, b: Box): boolean {
    return (
        a.left === b.left &&
        a.right === b.right &&
        a.top === b.top &&
        a.bottom === b.bottom
    )
}

/**
 * Where `element` sits within `container` (both laid out), kept up to date as
 * either resizes; undefined while either is missing. The box object is kept
 * while nothing moves, so it can be a memo dependency, e.g. of a label layout
 * that keeps clear of it.
 */
export function useBoxWithin(
    container: HTMLElement | null,
    element: HTMLElement | null
): Box | undefined {
    const [box, setBox] = useState<Box | undefined>(undefined)

    useEffect(() => {
        if (!container || !element || typeof ResizeObserver === "undefined")
            return
        const update = (): void => {
            const outer = container.getBoundingClientRect()
            const inner = element.getBoundingClientRect()
            const next: Box = {
                left: inner.left - outer.left,
                right: inner.right - outer.left,
                top: inner.top - outer.top,
                bottom: inner.bottom - outer.top,
            }
            setBox((prev) => (prev && isSameBox(prev, next) ? prev : next))
        }
        // Also reports both elements' sizes once when they're observed
        const observer = new ResizeObserver(update)
        observer.observe(container)
        observer.observe(element)
        return () => observer.disconnect()
    }, [container, element])

    return container && element ? box : undefined
}
