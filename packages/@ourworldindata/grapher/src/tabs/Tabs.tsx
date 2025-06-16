import * as React from "react"
import cx from "classnames"

export type TabKey = string

export interface TabItem {
    key: string
    element: React.ReactElement
    props?: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        "data-track-note"?: string
    }
}

// props?: TabProps &
//     React.RefAttributes<object> & {
//         "data-track-note"?: string
//     }

export const Tabs = ({
    items,
    selectedKey,
    onChange,
    horizontalScroll = false,
    maxTabWidth,
    slot,
    className,
    variant = "default",
    onHoverStart,
    onHoverEnd,
}: {
    items: TabItem[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    horizontalScroll?: boolean
    maxTabWidth?: number // if undefined, don't clip labels
    slot?: React.ReactElement
    className?: string
    variant?: "default" | "slim"
    onHoverStart?: (event: any) => void
    onHoverEnd?: (event: any) => void
}) => {
    let style: React.CSSProperties | undefined = undefined
    if (maxTabWidth !== undefined && Number.isFinite(maxTabWidth)) {
        style = {
            maxWidth: maxTabWidth,
            textOverflow: "ellipsis",
            overflow: "hidden",
        }
    }

    return (
        <div
            className={cx("Tabs", "Tabs--variant-" + variant, className, {
                "Tabs--horizontal-scroll": horizontalScroll,
            })}
            role="tablist"
        >
            <div className="Tabs__TabList">
                {items.map((label) => {
                    const active = label.key === selectedKey
                    return (
                        <button
                            key={label.key}
                            className={cx("Tabs__Tab", { active })}
                            style={style}
                            type="button"
                            role="tab"
                            tabIndex={active ? 0 : -1}
                            data-selected={active ? true : undefined}
                            aria-selected={active}
                            onClick={() => onChange(label.key)}
                            {...label.props}
                        >
                            {label.element}
                        </button>
                    )
                })}
            </div>
            {slot}
        </div>
    )
}

//    <Tab
//                 key={item.key}
//                 id={item.key.toString()}
//                 style={{ maxWidth: maxTabWidth }}
//                 onHoverStart={onHoverStart}
//                 onHoverEnd={onHoverEnd}
//                 {...item.props}
//                 className={cx("Tabs__Tab", item.props?.className)}
//             >
//                 {item.element}
//             </Tab>
