import { useEffect, RefObject, useState } from "react"
import throttle from "lodash/throttle.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { RelatedChart } from "../clientUtils/owidTypes.js"

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
    }, [active])
}

export enum ScrollDirection {
    Up = "up",
    Down = "down",
}

export const useScrollDirection = () => {
    let lastScrollY = window.pageYOffset

    const [direction, setDirection] = useState<null | ScrollDirection>(null)

    useEffect(() => {
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
    currentChart: RelatedChart | string,
    refChartContainer: React.RefObject<HTMLDivElement>
) => {
    useEffect(() => {
        if (refChartContainer.current) {
            // Track newly injected <figure> elements in embedder
            MultiEmbedderSingleton.observeFigures(refChartContainer.current)
        }
    }, [currentChart])
}
