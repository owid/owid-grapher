import * as _ from "lodash-es"
import {
    useEffect,
    RefObject,
    useState,
    useCallback,
    useMemo,
    useSyncExternalStore,
} from "react"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import { Bounds, getWindowQueryStr } from "@ourworldindata/utils"
import { DEFAULT_GRAPHER_BOUNDS } from "@ourworldindata/grapher"
import { useResizeObserver } from "usehooks-ts"
import { reaction } from "mobx"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement | null>,
    active: boolean,
    trigger: () => void
) => {
    useEffect(() => {
        if (!active) return
        const handleClick = (e: MouseEvent) => {
            if (container && !container.current?.contains(e.target as Node)) {
                trigger()
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

        const updateDirectionThrottled = _.throttle(() => {
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
    refChartContainer: React.RefObject<HTMLDivElement | null>,
    isPreviewing: boolean
) => {
    useEffect(() => {
        if (refChartContainer.current) {
            // Track newly injected <figure> elements in embedder
            MultiEmbedderSingleton.observeFigures(
                refChartContainer.current,
                isPreviewing
            )
        }
    }, [activeChartIdx, refChartContainer, isPreviewing])
}

export const useTriggerOnEscape = (
    trigger: VoidFunction,
    { active = true }: { active?: boolean } = {}
) => {
    useEffect(() => {
        if (!active) return

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                trigger()
            }
        }
        document.addEventListener("keydown", handleEscape)
        return () => {
            document.removeEventListener("keydown", handleEscape)
        }
    }, [trigger, active])
}

// Auto-updating Bounds object based on ResizeObserver
// Optionally throttles the bounds updates
export const useElementBounds = (
    ref: RefObject<HTMLElement | null>,
    initialValue: Bounds = DEFAULT_GRAPHER_BOUNDS,
    throttleTime: number | undefined = 100
) => {
    const [bounds, setBounds] = useState<Bounds>(initialValue)

    type Size = {
        width: number | undefined
        height: number | undefined
    }

    const updateBoundsImmediately = useCallback((size: Size) => {
        if (size.width === undefined || size.height === undefined) return
        setBounds(new Bounds(0, 0, size.width, size.height))
    }, [])

    const updateBoundsThrottled = useMemo(
        () =>
            throttleTime !== undefined
                ? _.throttle(
                      updateBoundsImmediately,
                      throttleTime,

                      // We use `leading` because, in many cases, there is only a single resize event (e.g. phone screen
                      // orientation change), and we want to optimize for a fast response time in that case
                      { leading: true }
                  )
                : updateBoundsImmediately,
        [throttleTime, updateBoundsImmediately]
    )

    useResizeObserver({
        ref: ref as React.RefObject<HTMLDivElement>,
        onResize: updateBoundsThrottled,
    })

    return bounds
}

// Transforms Mobx state into a functional React state, by setting up
// a listener with Mobx's `reaction` and updating the React state.
// Make sure that the `mobxStateGetter` function is wrapped in `useCallback`,
// otherwise the listener will be set up on every render, causing
// an infinite loop.
export const useMobxStateToReactState = <T>(
    mobxStateGetter: () => T,
    enabled: boolean = true
) => {
    const [state, setState] = useState(() =>
        enabled ? mobxStateGetter() : undefined
    )

    useEffect(() => {
        if (!enabled) return
        const disposer = reaction(mobxStateGetter, setState, {
            fireImmediately: true,
        })
        return disposer
    }, [enabled, mobxStateGetter])
    return state
}

declare global {
    interface Window {
        navigation?: {
            addEventListener: (type: string, listener: () => void) => void
            removeEventListener: (type: string, listener: () => void) => void
        }
    }
}

export const useWindowQueryParams = () => {
    function subscribe(callback: () => void) {
        const navigation = window.navigation
        if (navigation) {
            // At the time of writing (June 2025), the Navigation API is only
            // available in Chrome/Edge 102+, and not in Firefox or Safari.
            // https://caniuse.com/mdn-api_navigation
            navigation.addEventListener("navigatesuccess", callback)
            return () => {
                navigation.removeEventListener("navigatesuccess", callback)
            }
        } else {
            // Fall back to polling.
            let lastQueryString = getWindowQueryStr()
            const interval = setInterval(() => {
                const currentQueryString = getWindowQueryStr()
                if (currentQueryString !== lastQueryString) {
                    lastQueryString = currentQueryString
                    callback()
                }
            }, 1000)
            return () => clearInterval(interval)
        }
    }

    function getSnapshot() {
        if (typeof window === "undefined") return ""
        return getWindowQueryStr()
    }

    function getServerSnapshot() {
        return ""
    }

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
