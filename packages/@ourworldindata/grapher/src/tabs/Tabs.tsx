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
        ref?: React.RefObject<HTMLDivElement | null>
    }
}

export const Tabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    className,
    variant = "default",
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    className?: string
    variant?: "default" | "slim" | "stretch" | "scroll"
}) => {
    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={(key) => {
                if (typeof key === "string") onChange(key as TabKey)
            }}
        >
            <TabList
                className={cx("Tabs", "Tabs--variant-" + variant, className)}
            >
                {items.map((item) => (
                    <Tab
                        key={item.key}
                        id={item.key}
                        data-track-note={item.buttonProps?.dataTrackNote}
                        aria-label={item.buttonProps?.ariaLabel}
                        className={cx("Tabs__Tab", item.buttonProps?.className)}
                        ref={item.buttonProps?.ref}
                    >
                        {item.element}
                    </Tab>
                ))}
            </TabList>
        </AriaTabs>
    )
}
