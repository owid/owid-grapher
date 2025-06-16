import * as React from "react"
import cx from "classnames"

export interface TabItem<TabKey extends string = string> {
    key: TabKey
    element: React.ReactElement
    buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        "data-track-note"?: string
    }
}

export const Tabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    horizontalScroll = false,
    maxTabWidth,
    slot,
    className,
    variant = "default",
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    slot?: React.ReactElement
    className?: string
    variant?: "default" | "slim"
}) => {
    const container = React.useRef<HTMLDivElement>(null)

    const activeIndex = items.findIndex((item) => item.key === selectedKey)

    // roving tabindex for keyboard navigation
    function getNextIndex(eventKey: string): number {
        const first = 0
        const last = items.length - 1

        const next = activeIndex + 1
        const previous = activeIndex - 1

        switch (eventKey) {
            case "Home":
                return first
            case "End":
                return last
            case "ArrowRight":
                return activeIndex === last ? first : next
            case "ArrowLeft":
                return activeIndex === first ? last : previous
            default:
                return activeIndex
        }
    }

    // enable keyboard navigation
    function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
        const nextIndex = getNextIndex(event.key)
        const nextKey = items[nextIndex].key
        onChange(nextKey)

        // programmatically focus the next active tab
        if (!container.current) return
        const activeTabElement = container.current.children[
            nextIndex
        ] as HTMLButtonElement
        if (activeTabElement) activeTabElement.focus()
    }

    return (
        <div
            className={cx("Tabs", "Tabs--variant-" + variant, className, {
                "Tabs--horizontal-scroll": horizontalScroll,
            })}
            role="tablist"
            ref={container}
        >
            {items.map((item) => {
                const isActive = item.key === selectedKey
                return (
                    <button
                        key={item.key}
                        className="Tabs__Tab"
                        style={{ maxWidth: maxTabWidth }}
                        type="button"
                        role="tab"
                        tabIndex={isActive ? 0 : -1}
                        data-selected={isActive ? true : undefined}
                        aria-selected={isActive}
                        onClick={() => onChange(item.key)}
                        onKeyDown={handleKeyDown}
                        {...item.buttonProps}
                    >
                        {item.element}
                    </button>
                )
            })}
            {slot}
        </div>
    )
}
