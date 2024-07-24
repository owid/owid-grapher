import {
    useEffect,
    RefObject,
    useState,
    useRef,
    useCallback,
    useMemo,
} from "react"
import { MultiEmbedderSingleton } from "./multiembedder/MultiEmbedder.js"
import {
    Bounds,
    debounce,
    DEFAULT_BOUNDS,
    throttle,
} from "@ourworldindata/utils"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement>,
    active: boolean,
    trigger: (arg0: boolean) => void
) => {
    useEffect(() => {
        if (!active) return
        // Don't toggle if viewport width is xxlg or larger
        if (window.innerWidth >= 1536) return
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

export const useDebounceCallback = (callback: any, delay: number) => {
    return useRef(debounce(callback, delay)).current
}

export const useTriggerOnEscape = (trigger: VoidFunction) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                trigger()
            }
        }
        document.addEventListener("keydown", handleEscape)
        return () => {
            document.removeEventListener("keydown", handleEscape)
        }
    }, [trigger])
}

// Auto-updating Grapher bounds based on ResizeObserver
// Optionally debounces the bounds updates
export const useElementBounds = (
    ref: RefObject<HTMLElement>,
    initialValue: Bounds = DEFAULT_BOUNDS,
    debounceTime: number | undefined = 100
) => {
    const [bounds, setBounds] = useState<Bounds>(initialValue)

    const computeAndUpdateBoundsImmediately = useCallback(
        (target: HTMLElement) =>
            setBounds(Bounds.fromRect(target.getBoundingClientRect())),
        []
    )

    const computeAndUpdateBoundsDebounced = useMemo(
        () =>
            debounceTime !== undefined
                ? debounce(
                      (target: HTMLElement) =>
                          computeAndUpdateBoundsImmediately(target),
                      debounceTime,

                      // We use `leading` because, in many cases, there is only a single resize event (e.g. phone screen
                      // orientation change), and we want to optimize for a fast response time in that case
                      { leading: true }
                  )
                : computeAndUpdateBoundsImmediately,
        [debounceTime, computeAndUpdateBoundsImmediately]
    )

    // Ensure bounds are computed on mount
    useEffect(() => {
        if (ref.current) computeAndUpdateBoundsImmediately(ref.current)
    }, [ref, computeAndUpdateBoundsImmediately])

    // Set up the actual ResizeObserver
    useEffect(() => {
        if (!ref.current) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                computeAndUpdateBoundsDebounced(entry.target as HTMLElement)
            }
        })
        if (ref.current) {
            observer.observe(ref.current)
        }
        return () => {
            observer.disconnect()
        }
    }, [ref, computeAndUpdateBoundsDebounced])

    return bounds
}
