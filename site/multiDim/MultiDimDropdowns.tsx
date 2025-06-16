import cx from "classnames"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { forwardRef, useState } from "react"

import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import DimensionDropdown from "./DimensionDropdown.js"

const MultiDimDropdowns = forwardRef<
    HTMLDivElement,
    {
        className?: string
        availableSettings: Record<string, DimensionEnriched>
        resolvedSettings: MultiDimDimensionChoices
        onChange: (settings: MultiDimDimensionChoices) => void
        collapsedCount: number
    }
>(function MultiDimDropdowns(
    {
        className,
        availableSettings,
        resolvedSettings,
        onChange,
        collapsedCount,
    },
    ref
) {
    const [isExpanded, setIsExpanded] = useState(false)
    const dimensionsArray = Object.values(availableSettings)
    const needsToggle = dimensionsArray.length > collapsedCount
    const displayedDimensions = isExpanded
        ? dimensionsArray
        : dimensionsArray.slice(0, collapsedCount)

    return (
        <div className={cx("md-dropdowns", className)} ref={ref}>
            {displayedDimensions.map((dim) => (
                <DimensionDropdown
                    key={dim.slug}
                    dimension={dim}
                    value={resolvedSettings[dim.slug]}
                    onChange={(value) => {
                        onChange({
                            ...resolvedSettings,
                            [dim.slug]: value,
                        })
                    }}
                />
            ))}
            {needsToggle && (
                <button
                    className="md-dropdowns__toggle"
                    onClick={() => setIsExpanded(!isExpanded)}
                    type="button"
                    aria-expanded={isExpanded}
                >
                    <FontAwesomeIcon
                        className="md-dropdowns__toggle-icon"
                        icon={isExpanded ? faMinus : faPlus}
                        aria-hidden="true"
                    />
                    <span className="md-dropdowns__toggle-text">
                        {isExpanded ? "Show less" : "Show more"}
                    </span>
                </button>
            )}
        </div>
    )
})

export default MultiDimDropdowns
