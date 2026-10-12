import React from "react"
import { useTransition, animated, SpringValue, config } from "@react-spring/web"
import { usePrefersReducedMotion } from "@ourworldindata/components"

interface AnimatedRowsProps<T> {
    items: readonly T[]
    keyAccessor: (item: T) => string
    getY: (item: T) => number
    renderRow: (item: T) => React.ReactElement
    immediate?: boolean
}

interface AnimatedStyle {
    y: SpringValue<number>
}

export function AnimatedRows<T>({
    items,
    keyAccessor,
    getY,
    renderRow,
    immediate,
}: AnimatedRowsProps<T>): React.ReactElement {
    const prefersReducedMotion = usePrefersReducedMotion()

    const transitions = useTransition<T, { y: number }>(items, {
        keys: keyAccessor,
        from: (item: T) => ({ y: getY(item) }),
        enter: (item: T) => ({ y: getY(item) }),
        update: (item: T) => ({ y: getY(item) }),
        config: config.default,
        immediate: immediate || prefersReducedMotion,
    })

    return (
        <>
            {transitions((style: AnimatedStyle, item: T) => (
                <animated.g
                    key={keyAccessor(item)}
                    transform={style.y.to((y: number) => `translate(0, ${y})`)}
                >
                    {renderRow(item)}
                </animated.g>
            ))}
        </>
    )
}
