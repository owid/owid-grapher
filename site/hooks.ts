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
import { useResizeObserver } from "usehooks-ts"
import { reaction } from "mobx"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement>,
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

// Auto-updating Bounds object based on ResizeObserver
// Optionally throttles the bounds updates
export const useElementBounds = (
    ref: RefObject<HTMLElement>,
    initialValue: Bounds = DEFAULT_BOUNDS,
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
                ? throttle(
                      updateBoundsImmediately,
                      throttleTime,

                      // We use `leading` because, in many cases, there is only a single resize event (e.g. phone screen
                      // orientation change), and we want to optimize for a fast response time in that case
                      { leading: true }
                  )
                : updateBoundsImmediately,
        [throttleTime, updateBoundsImmediately]
    )

    useResizeObserver({ ref, onResize: updateBoundsThrottled })

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
        const disposer = reaction(() => mobxStateGetter(), setState, {
            fireImmediately: true,
        })
        return disposer
    }, [enabled, mobxStateGetter])
    return state
}

export const useFocusTrap = (
    ref: React.RefObject<HTMLElement>,
    isActive: boolean
): void => {
    useEffect(() => {
        if (!ref || !ref.current) return
        const element = ref.current

        const focusableElements = element.querySelectorAll<HTMLElement>(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        )
        const firstFocusableElement = focusableElements[0]
        const lastFocusableElement =
            focusableElements[focusableElements.length - 1]

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Tab") {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusableElement) {
                        e.preventDefault()
                        lastFocusableElement.focus()
                    }
                } else {
                    if (document.activeElement === lastFocusableElement) {
                        e.preventDefault()
                        firstFocusableElement.focus()
                    }
                }
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [ref, isActive])
}

export function useOffsetTop(ref: React.RefObject<HTMLElement>) {
    const [offsetTop, setOffsetTop] = useState(0)
    useEffect(() => {
        if (ref.current) {
            setOffsetTop(ref.current.offsetTop)
            const observer = new ResizeObserver(() => {
                setOffsetTop(ref.current!.offsetTop)
            })
            observer.observe(ref.current)
            return () => observer.disconnect()
        }
        return
    }, [ref])
    return offsetTop
}
