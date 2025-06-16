import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { TabItem, Tabs } from "./Tabs"

export const ExpandableTabs = <TabKey extends string = string>({
    items,
    selectedKey,
    onChange,
    isExpandedDefault = false,
    getVisibleItems = (items: TabItem<TabKey>[]) => items.slice(0, 3),
    maxTabWidth,
}: {
    items: TabItem<TabKey>[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    isExpandedDefault?: boolean
    getVisibleItems?: (items: TabItem<TabKey>[]) => TabItem<TabKey>[]
    maxTabWidth?: number // if undefined, don't clip labels
}) => {
    const [isExpanded, setExpanded] = useState(isExpandedDefault)

    const toggle = () => {
        setExpanded(!isExpanded)
    }

    const visibleItems = isExpanded ? items : getVisibleItems(items)

    const showMoreButton = (
        <button
            className="Tabs__Tab ExpandableTabs__ShowMoreButton"
            onClick={toggle}
        >
            <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} />
            <span>{isExpanded ? "Show less" : "Show more"}</span>
        </button>
    )

    return (
        <div
            className={cx("ExpandableTabs", {
                "ExpandableTabs--expanded": isExpanded,
            })}
        >
            <Tabs
                items={visibleItems}
                selectedKey={selectedKey}
                onChange={onChange}
                slot={showMoreButton}
                maxTabWidth={maxTabWidth}
            />
        </div>
    )
}
