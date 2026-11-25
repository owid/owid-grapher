import { useEffect, useRef } from "react"

/**
 * A stroked SVG path that draws itself in from its start over `durationMs`
 * when it first appears, unless the reader prefers reduced motion. Later
 * changes to `d`, e.g. on resize, show at once.
 */
export function DrawnPath({
    durationMs,
    ...pathProps
}: React.SVGProps<SVGPathElement> & {
    durationMs: number
}): React.ReactElement {
    const ref = useRef<SVGPathElement>(null)
    useEffect(() => {
        const element = ref.current
        if (
            !element ||
            typeof element.animate !== "function" ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
            return
        const length = element.getTotalLength()
        element.style.strokeDasharray = `${length}`
        const animation = element.animate(
            [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
            { duration: durationMs, easing: "ease-in-out" }
        )
        const settle = (): void => {
            element.style.strokeDasharray = ""
        }
        animation.addEventListener("finish", settle)
        return () => {
            animation.cancel()
            settle()
        }
    }, [durationMs])
    return <path ref={ref} {...pathProps} />
}
