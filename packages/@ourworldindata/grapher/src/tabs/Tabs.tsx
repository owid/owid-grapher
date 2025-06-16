import * as React from "react"
import {
    Tabs as AriaTabs,
    TabList,
    Tab,
    type Key,
    type TabProps,
} from "react-aria-components"
import cx from "classnames"

export type TabKey = Key

export interface TabItem {
    key: TabKey
    element: React.ReactElement
    props?: TabProps & {
        "data-track-note"?: string
    }
}

export const Tabs = ({
    items,
    selectedKey,
    onChange,
    horizontalScroll = false,
    maxTabWidth,
    slot,
    className,
    variant = "default",
}: {
    items: TabItem[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    slot?: React.ReactElement
    className?: string
    variant?: "default" | "slim"
}) => {
    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={onChange}
            className={cx("Tabs", "Tabs--variant-" + variant, className, {
                "Tabs--horizontal-scroll": horizontalScroll,
            })}
        >
            <TabList className="Tabs__TabList">
                {items.map((item) => (
                    <Tab
                        key={item.key}
                        id={item.key.toString()}
                        className="Tabs__Tab"
                        style={{ maxWidth: maxTabWidth }}
                        {...item.props}
                    >
                        {item.element}
                    </Tab>
                ))}
            </TabList>
            {slot}
        </AriaTabs>
    )
}
