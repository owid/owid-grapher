// adapted from https://wattenberger.com/blog/react-and-d3#sizing-responsivity

import { useState, useRef, useEffect } from "react"
// import { ResizeObserver } from "@juggle/resize-observer" // polyfill

interface Margins {
    top: number
    right: number
    bottom: number
    left: number
}

export interface DimensionsConfig {
    initialWidth?: number
    ratio?: number
    minHeight?: number
    maxHeight?: number
}

interface WindowDimensions {
    width: number
    height: number
}

export const useChartDimensions = <E extends HTMLElement>(options?: {
    margins?: Partial<Margins>
    config?: DimensionsConfig
}) => {
    const ref = useRef<E>(null)

    const passedMargins = options?.margins || {}
    const {
        initialWidth = 800,
        ratio = 16 / 9,
        minHeight = 300,
        maxHeight = 400,
    } = options?.config || {}

    // set default margins
    const margins = {
        top: passedMargins.top || 0,
        right: passedMargins.right || 0,
        bottom: passedMargins.bottom || 0,
        left: passedMargins.left || 0,
    }

    const [width, setWidth] = useState(initialWidth)

    useEffect(() => {
        const element = ref.current as E

        const resizeObserver = new ResizeObserver(
            (entries: ResizeObserverEntry[]) => {
                if (!Array.isArray(entries)) return
                if (entries.length === 0) return

                const entry = entries[0]
                setWidth(entry.contentRect.width)
            }
        )

        resizeObserver.observe(element)

        return () => resizeObserver.unobserve(element)
    }, [])

    // maintain given ratio between width and height (within bounds)
    const height = Math.min(Math.max((1 / ratio) * width, minHeight), maxHeight)

    const dimensions = {
        margins,
        width,
        height,
        boundedHeight: Math.max(height - margins.top - margins.bottom, 0),
        boundedWidth: Math.max(width - margins.left - margins.right, 0),
    }

    return { ref, dimensions }
}

export const useWindowDimensions = (): { dimensions: WindowDimensions } => {
    const [windowDimensions, setWindowDimensions] = useState<WindowDimensions>({
        width: typeof window !== "undefined" ? window.outerWidth : 1200,
        height: typeof window !== "undefined" ? window.outerHeight : 800,
    })

    useEffect(() => {
        const handleResize = () => {
            setWindowDimensions({
                width: window.outerWidth,
                height: window.outerHeight,
            })
        }

        window.addEventListener("resize", handleResize)

        // Set initial dimensions in case they changed between initial state and effect
        handleResize()

        return () => window.removeEventListener("resize", handleResize)
    }, [])

    return { dimensions: windowDimensions }
}
