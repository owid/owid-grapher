import { useEffect, RefObject, useState, useRef } from "react"
import throttle from "lodash/throttle.js"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { debounce, DimensionProperty } from "@ourworldindata/utils"
import {
    ChartTypeName,
    Grapher,
    GrapherProgrammaticInterface,
    GrapherTabOption,
} from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"

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

export const useEmbedVariableChart = (
    variableId: number,
    chartType:
        | "LineChart"
        | "ScatterPlot"
        | "TimeScatter"
        | "StackedArea"
        | "DiscreteBar"
        | "StackedDiscreteBar"
        | "SlopeChart"
        | "StackedBar"
        | "WorldMap"
        | "Marimekko"
        | undefined,
    hideTabs: boolean,
    refChartContainer: React.RefObject<HTMLElement>
) => {
    useEffect(() => {
        if (refChartContainer.current) {
            // TODO: this does not use the InteractionObserver yet but just directly
            // creates a chart. This doesn't scale terrible well when you have many graphers
            // on a page, but the current implemenation of the MultiEmbedder assumes that the
            // thing being shown is a normal chart with a /grapher/ url.
            const common: GrapherProgrammaticInterface = {
                isEmbeddedInAnOwidPage: true,
                queryStr: "", // TODO: use query string?
                adminBaseUrl: ADMIN_BASE_URL,
                bakedGrapherURL: BAKED_GRAPHER_URL,
            }

            const config: GrapherProgrammaticInterface = {
                ...common,
                type: chartType as ChartTypeName,
                shownTabs: hideTabs ? [GrapherTabOption.chart] : undefined,
                dimensions: [
                    {
                        variableId,
                        property: DimensionProperty.y,
                    },
                ],
            }
            // if (config.manager?.selection)
            //     this.graphersAndExplorersToUpdate.add(config.manager.selection)

            const grapherInstance = Grapher.renderGrapherIntoContainer(
                config,
                refChartContainer.current
            )
        }
    }, [variableId, chartType, hideTabs, refChartContainer])
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

export const useDebounceCallback = (callback: any, delay: number) => {
    return useRef(debounce(callback, delay)).current
}
