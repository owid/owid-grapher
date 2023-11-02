import React, { useLayoutEffect, useRef } from "react"
import cx from "classnames"

export const Tabs = ({
    labels,
    activeIndex,
    setActiveIndex,
    horizontalScroll = false,
    slot,
}: {
    labels: string[]
    activeIndex: number
    setActiveIndex: (label: number) => void
    horizontalScroll?: boolean
    slot?: JSX.Element
}) => {
    const container = useRef<HTMLDivElement>(null)

    // roving tabindex for keyboard navigation
    function getNextIndex(eventKey: string): number {
        switch (eventKey) {
            case "Home":
                return 0
            case "End":
                return labels.length - 1
            case "ArrowRight":
                return activeIndex === labels.length - 1 ? 0 : activeIndex + 1
            case "ArrowLeft":
                return activeIndex === 0 ? labels.length - 1 : activeIndex - 1
            default:
                return activeIndex
        }
    }

    // enable keyboard navigation
    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        const nextIndex = getNextIndex(event.key)
        setActiveIndex(nextIndex)
    }

    // programmatically focus the active tab
    useLayoutEffect(() => {
        if (!container.current) return
        const activeTabElement = container.current.children[
            activeIndex
        ] as HTMLButtonElement
        if (activeTabElement) activeTabElement.focus()
    }, [activeIndex])

    return (
        <div
            className={cx("Tabs", {
                "Tabs--horizontal-scroll": horizontalScroll,
            })}
            role="tablist"
            ref={container}
        >
            {labels.map((label, index) => {
                const isActive = index === activeIndex
                return (
                    <button
                        key={label}
                        className={cx("Tabs__tab", {
                            "Tabs__tab--active": isActive,
                        })}
                        type="button"
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        aria-selected={isActive}
                        onClick={() => setActiveIndex(index)}
                        onKeyDown={handleKeyDown}
                    >
                        {label}
                    </button>
                )
            })}
            {slot}
        </div>
    )
}
