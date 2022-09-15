import { useEffect, RefObject, useState, useRef } from "react"
import throttle from "lodash/throttle.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement>,
    active: boolean,
    trigger: (arg0: boolean) => void
) => {
    useEffect(() => {
        if (!active) return
        const handleClick = (e: MouseEvent) => {
            if (container && !container.current?.contains(e.target as Node)) {
                trigger(false)
            }
        }
        document.addEventListener("mousedown", handleClick)

        return () => {
            document.removeEventListener("mousedown", handleClick)
        }
    }, [active, container, trigger])
}

export enum ScrollDirection {
    Up = "up",
    Down = "down",
}

export const useScrollDirection = () => {
    const [direction, setDirection] = useState<null | ScrollDirection>(null)

    useEffect(() => {
        let lastScrollY = window.pageYOffset
        const updateDirection = () => {
            const scrollY = window.pageYOffset
            setDirection(
                scrollY > lastScrollY
                    ? ScrollDirection.Down
                    : ScrollDirection.Up
            )
            lastScrollY = scrollY
        }

        const updateDirectionThrottled = throttle(() => {
            updateDirection()
        }, 500)

        document.addEventListener("scroll", updateDirectionThrottled)
        return () => {
            document.removeEventListener("scroll", updateDirectionThrottled)
        }
    })

    return direction
}

export const useEmbedChart = (
    activeChartIdx: number,
    refChartContainer: React.RefObject<HTMLDivElement>
) => {
    useEffect(() => {
        if (refChartContainer.current) {
            // Track newly injected <figure> elements in embedder
            MultiEmbedderSingleton.observeFigures(refChartContainer.current)
        }
    }, [activeChartIdx, refChartContainer])
}

// Adapted from https://overreacted.io/making-setinterval-declarative-with-react-hooks/
export const useInterval = (callback: VoidFunction, delay: number | null) => {
    const savedCallback = useRef(callback)

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback
    }, [callback])

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current()
        }
        if (delay !== null) {
            const id = setInterval(tick, delay)
            return () => clearInterval(id)
        }
        return
    }, [delay])
}
