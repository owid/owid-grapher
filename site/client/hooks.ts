import { useEffect, RefObject, useState } from "react"
import throttle from "lodash/throttle"

export const useTriggerWhenClickOutside = (
    container: RefObject<HTMLElement>,
    trigger: (arg0: boolean) => void
) => {
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (container && !container.current?.contains(e.target as Node)) {
                trigger(false)
            }
        }
        document.addEventListener("mousedown", handleClick)

        return () => {
            document.removeEventListener("mousedown", handleClick)
        }
    }, [])
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
