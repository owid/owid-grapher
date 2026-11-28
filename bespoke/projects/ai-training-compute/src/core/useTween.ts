import { useEffect, useRef, useState } from "react"

const DEFAULT_DURATION_MS = 900

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
}

/**
 * Follows `target`, a list of numbers, easing from the current values to
 * new ones over `duration` when `animate` is set and jumping straight there
 * otherwise (or when the reader prefers reduced motion). A change that
 * arrives mid-animation starts from wherever the animation had got to.
 */
export function useTween(
    target: number[],
    {
        animate,
        duration = DEFAULT_DURATION_MS,
    }: { animate: boolean; duration?: number }
): number[] {
    const targetKey = target.join(",")
    // The values on screen, and the target they've settled on (undefined
    // while easing towards one)
    const [shown, setShown] = useState<{
        values: number[]
        settledKey?: string
    }>({ values: target, settledKey: targetKey })
    // The same values, for the effect to start an animation from
    const currentRef = useRef(target)

    useEffect(() => {
        const to = targetKey.split(",").map(Number)
        const from = currentRef.current
        const settle = (): void => {
            currentRef.current = to
            setShown({ values: to, settledKey: targetKey })
        }
        if (!animate || prefersReducedMotion()) {
            settle()
            return
        }

        let frame = 0
        const startTime = performance.now()
        const step = (now: number): void => {
            const t = Math.min(1, (now - startTime) / duration)
            if (t >= 1) {
                settle()
                return
            }
            const eased = easeInOutCubic(t)
            const values = from.map(
                (start, i) => start + (to[i] - start) * eased
            )
            currentRef.current = values
            setShown({ values })
            frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
        return () => cancelAnimationFrame(frame)
    }, [targetKey, animate, duration])

    // A jump shows at once; an animated change holds the values on screen
    // until its frames take over, rather than flash the new ones
    if (!animate) return target
    return shown.settledKey === targetKey ? target : shown.values
}
