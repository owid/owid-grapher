import * as React from "react"
import cx from "classnames"
import { Tabs as AriaTabs, TabList, Tab } from "react-aria-components"

export interface TabItem<TabKey extends string = string> {
    key: TabKey
    element: React.ReactElement
    buttonProps?: {
        className?: string
        ariaLabel?: string
        dataTrackNote?: string
    }
}

export const Tabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    horizontalScroll = false,
    maxTabWidth,
    className,
    variant = "default",
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    className?: string
    variant?: "default" | "slim"
}) => {
    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={(key) => {
                if (typeof key === "string") onChange(key as TabKey)
            }}
        >
            <TabList
                className={cx("Tabs", "Tabs--variant-" + variant, className, {
                    "Tabs--horizontal-scroll": horizontalScroll,
                })}
            >
                {items.map((item) => (
                    <Tab
                        key={item.key}
                        id={item.key}
                        style={{ maxWidth: maxTabWidth }}
                        data-track-note={item.buttonProps?.dataTrackNote}
                        aria-label={item.buttonProps?.ariaLabel}
                        className={cx("Tabs__Tab", item.buttonProps?.className)}
                    >
                        {item.element}
                    </Tab>
                ))}
            </TabList>
        </AriaTabs>
    )
}
