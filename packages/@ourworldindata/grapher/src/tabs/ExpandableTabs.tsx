import { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { TabKey, TabLabel, Tabs } from "./Tabs"

export const ExpandableTabs = ({
    labels,
    selectedKey,
    onChange,
    isExpandedDefault = false,
    getVisibleLabels = (labels: TabLabel[]) => labels.slice(0, 3),
    maxTabWidth,
}: {
    labels: TabLabel[]
    selectedKey: TabKey
    onChange: (key: TabKey) => void
    isExpandedDefault?: boolean
    getVisibleLabels?: (tabLabels: TabLabel[]) => TabLabel[]
    maxTabWidth?: number // if undefined, don't clip labels
}) => {
    const [isExpanded, setExpanded] = useState(isExpandedDefault)

    const toggle = () => {
        setExpanded(!isExpanded)
    }

    const visibleLabels = isExpanded ? labels : getVisibleLabels(labels)

    const moreButton = (
        <button className="Tabs__tab ExpandableTabs__button" onClick={toggle}>
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
                labels={visibleLabels}
                selectedKey={selectedKey}
                onChange={onChange}
                slot={moreButton}
                maxTabWidth={maxTabWidth}
            />
        </div>
    )
}
