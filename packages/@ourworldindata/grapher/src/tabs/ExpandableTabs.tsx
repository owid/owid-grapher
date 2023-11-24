import React, { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus, faMinus } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { Tabs } from "./Tabs"

export const ExpandableTabs = ({
    labels,
    activeIndex,
    setActiveIndex,
    isExpandedDefault = false,
    getVisibleLabels = (labels: string[]) => labels.slice(0, 3),
    maxTabWidth = 240,
}: {
    labels: string[]
    activeIndex: number
    setActiveIndex: (index: number) => void
    isExpandedDefault?: boolean
    getVisibleLabels?: (tabLabels: string[]) => string[]
    maxTabWidth?: number | null // if null, don't clip labels
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
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                slot={moreButton}
                maxTabWidth={maxTabWidth}
            />
        </div>
    )
}
