import * as React from "react"
import { Tabs as AriaTabs, TabList, Tab, type Key } from "react-aria-components"
import cx from "classnames"

export type TabKey = Key

export interface TabLabel {
    key: TabKey
    element: React.ReactElement
    buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        "data-track-note"?: string
    }
}

export const Tabs = ({
    labels,
    selectedKey,
    onChange,
    horizontalScroll = false,
    maxTabWidth,
    slot,
    extraClassNames,
    variant = "default",
}: {
    labels: TabLabel[]
    selectedKey: Key
    onChange: (key: Key) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    slot?: React.ReactElement
    extraClassNames?: string
    variant?: "default" | "slim"
}) => {
    let tabStyle: React.CSSProperties | undefined = undefined
    if (maxTabWidth !== undefined && Number.isFinite(maxTabWidth)) {
        tabStyle = {
            maxWidth: maxTabWidth,
            textOverflow: "ellipsis",
            overflow: "hidden",
        }
    }

    return (
        <AriaTabs
            selectedKey={selectedKey}
            onSelectionChange={onChange}
            className={cx("Tabs", "Tabs--variant-" + variant, extraClassNames, {
                "Tabs--horizontal-scroll": horizontalScroll,
            })}
        >
            <TabList className="Tabs__tablist">
                {labels.map((label) => (
                    <Tab
                        key={label.key}
                        id={label.key}
                        className={({ isSelected }) =>
                            cx("Tabs__tab", {
                                active: isSelected,
                            })
                        }
                        style={tabStyle}
                        {...label.buttonProps}
                    >
                        {label.element}
                    </Tab>
                ))}
            </TabList>
            {slot}
        </AriaTabs>
    )
}
