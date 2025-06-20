import { useRef } from "react"
import * as React from "react"
import cx from "classnames"
import { Tabs as AriaTabs } from "react-aria-components"

export interface TabLabel {
    element: React.ReactElement
    buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        "data-track-note"?: string
    }
}

export const Tabs = ({
    labels,
    activeIndex,
    setActiveIndex,
    horizontalScroll = false,
    maxTabWidth,
    slot,
    extraClassNames,
    variant = "default",
}: {
    labels: TabLabel[]
    activeIndex: number
    setActiveIndex: (label: number) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    slot?: React.ReactElement
    extraClassNames?: string
    variant?: "default" | "slim"
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

        // programmatically focus the next active tab
        if (!container.current) return
        const activeTabElement = container.current.children[
            nextIndex
        ] as HTMLButtonElement
        if (activeTabElement) activeTabElement.focus()
    }

    let style: React.CSSProperties | undefined = undefined
    if (maxTabWidth !== undefined && Number.isFinite(maxTabWidth)) {
        style = {
            maxWidth: maxTabWidth,
            textOverflow: "ellipsis",
            overflow: "hidden",
        }
    }

    return (
        <>
            <div
                className={cx(
                    "Tabs",
                    "Tabs--variant-" + variant,
                    extraClassNames,
                    {
                        "Tabs--horizontal-scroll": horizontalScroll,
                    }
                )}
                role="tablist"
                ref={container}
            >
                {labels.map((label, index) => {
                    const isActive = index === activeIndex
                    return (
                        <button
                            key={index}
                            className={cx("Tabs__tab", {
                                active: isActive,
                            })}
                            style={style}
                            type="button"
                            role="tab"
                            tabIndex={isActive ? 0 : -1}
                            aria-selected={isActive}
                            onClick={() => setActiveIndex(index)}
                            onKeyDown={handleKeyDown}
                            {...label.buttonProps}
                        >
                            {label.element}
                        </button>
                    )
                })}
                {slot}
            </div>
            <AriaTabs />
        </>
    )
}
