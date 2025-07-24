/* eslint-disable react/prop-types */
import { useEffect, useState } from "react"

import * as React from "react"
import classnames from "classnames"

type VerticalScrollContainerProps = React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
> & {
    scrollingShadows?: boolean
    scrollLock?: boolean
    contentsId?: string
}

type ReactRef<T> =
    | ((instance: T | null) => void)
    | React.MutableRefObject<T | null>
    | null

function useCombinedRefs<T>(...refs: ReactRef<T>[]): React.RefObject<T | null> {
    const targetRef = React.useRef<T>(null)

    React.useEffect(() => {
        refs.forEach((ref) => {
            if (!ref) return
            if (typeof ref === "function") {
                ref(targetRef.current || null)
            } else {
                ref.current = targetRef.current || null
            }
        })
    }, [refs])

    return targetRef
}

export const VerticalScrollContainer = React.forwardRef(
    function VerticalScrollContainer(
        props: VerticalScrollContainerProps,
        ref: ReactRef<HTMLDivElement>
    ) {
        let {
            scrollingShadows,
            className,
            children,
            contentsId,
            style,
            scrollLock,
            ...rest
        } = props

        scrollingShadows ??= true

        const scrollContainerRef = useCombinedRefs<HTMLDivElement>(ref)
        const [scrollTop, scrollBottom] = useScrollBounds(
            scrollContainerRef,
            contentsId
        )

        useScrollLock(scrollContainerRef, {
            enable: scrollLock,
            doNotLockIfNoScroll: true,
        })

        return (
            <div
                className="VerticalScrollContainerShadows"
                style={{
                    position: "relative",
                    height: "100%",
                }}
            >
                {scrollingShadows && (
                    <ScrollingShadow
                        direction="down"
                        size={10}
                        opacity={getShadowOpacity(0.15, 80, scrollTop)}
                    />
                )}
                <div
                    className={classnames(className, "VerticalScrollContainer")}
                    style={{
                        overflowY: "auto",
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        ...style,
                    }}
                    ref={scrollContainerRef}
                    {...rest}
                >
                    {children}
                </div>
                {scrollingShadows && (
                    <ScrollingShadow
                        direction="up"
                        size={10}
                        opacity={getShadowOpacity(0.15, 80, scrollBottom)}
                    />
                )}
            </div>
        )
    }
)

function getShadowOpacity(
    maxOpacity: number,
    maxDistance: number,
    scrollDistance: number | undefined
): number {
    const distance =
        scrollDistance !== undefined ? Math.min(scrollDistance, maxDistance) : 0
    return (distance / maxDistance) * maxOpacity
}

const ScrollingShadow = (props: {
    direction: "up" | "down"
    size: number
    opacity: number
}): React.ReactElement => {
    // "Eased" gradient
    // https://larsenwork.com/easing-gradients/
    const background = `linear-gradient(
        to ${props.direction === "up" ? "bottom" : "top"},
        hsla(0, 0%, 0%, 0) 0%,
        hsla(0, 0%, 0%, 0.104) 25.8%,
        hsla(0, 0%, 0%, 0.45) 60.9%,
        hsla(0, 0%, 0%, 0.825) 88.7%,
        hsl(0, 0%, 0%) 100%
    )`
    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                right: 0,
                [props.direction === "up" ? "bottom" : "top"]: 0,
                height: `${props.size}px`,
                background: background,
                opacity: props.opacity,
                pointerEvents: "none",
                zIndex: 2,
            }}
        />
    )
}

/**
 * A throttled function that returns the available scrollTop and scrollBottom
 * @param ref
 * @param contentsId when this string changes, it's a signal that the contents have re-rendered and
 * the height has likely changed.
 */
function useScrollBounds<ElementType extends HTMLElement>(
    ref: React.RefObject<ElementType | null>,
    contentsId?: string
): [number | undefined, number | undefined] {
    const [scrollTop, onScrollTop] = useState<number | undefined>(undefined)
    const [scrollBottom, onScrollBottom] = useState<number | undefined>(
        undefined
    )

    useEffect(() => {
        const el = ref.current!
        if (el) {
            let pendingUpdate = false

            function onScroll(): void {
                const { scrollTop, scrollHeight, offsetHeight } = el
                onScrollTop(scrollTop)
                onScrollBottom(scrollHeight - offsetHeight - scrollTop)
                pendingUpdate = false
            }
            onScroll() // execute for first time to setState

            const onScrollThrottled = (): void => {
                if (!pendingUpdate) {
                    window.requestAnimationFrame(onScroll)
                    pendingUpdate = true
                }
            }

            el.addEventListener("scroll", onScrollThrottled)
            return (): void => {
                el.removeEventListener("scroll", onScrollThrottled)
            }
        }
        return
    }, [contentsId, ref])

    return [scrollTop, scrollBottom]
}

interface ScrollLockOptions {
    enable: boolean
    doNotLockIfNoScroll: boolean
}

/**
 * React hook to prevent scroll events propagating to parent element.
 * @param ref the ReactRef of the scrolling container
 */
function useScrollLock<ElementType extends HTMLElement>(
    ref: React.RefObject<ElementType | null>,
    opts?: Partial<ScrollLockOptions>
): void {
    useEffect(() => {
        const el = ref.current
        const options: ScrollLockOptions = {
            doNotLockIfNoScroll: false,
            enable: true,
            ...opts,
        }
        if (options.enable && el) {
            function onWheel(ev: WheelEvent): void {
                const el = ref.current
                if (el) {
                    const delta = ev.deltaY
                    const up = delta < 0
                    const { scrollTop, scrollHeight, offsetHeight } = el

                    if (
                        options.doNotLockIfNoScroll &&
                        scrollHeight <= offsetHeight
                    ) {
                        return
                    }

                    function prevent(): void {
                        ev.stopPropagation()
                        ev.preventDefault()
                    }

                    if (
                        !up &&
                        delta > scrollHeight - offsetHeight - scrollTop
                    ) {
                        // Scrolling down, but this will take us past the bottom.
                        el.scrollTop = scrollHeight
                        return prevent()
                    } else if (up && -delta > scrollTop) {
                        // Scrolling up, but this will take us past the top.
                        el.scrollTop = 0
                        return prevent()
                    }
                }
            }
            el.addEventListener("wheel", onWheel as any, {
                // We need to be in non-passive mode to be able to cancel the event
                passive: false,
            })
            return (): void => {
                if (el) {
                    el.removeEventListener("wheel", onWheel as any)
                }
            }
        }
        return
    }, [opts, ref])
}
