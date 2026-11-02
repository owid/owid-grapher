import cx from "clsx"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState } from "react"

import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import DimensionDropdown from "./DimensionDropdown.js"

export default function MultiDimControls({
    availableSettings,
    resolvedSettings,
    onChange,
    collapsedCount,
    readOnly,
}: {
    availableSettings: Record<string, DimensionEnriched>
    resolvedSettings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
    collapsedCount: number
    readOnly?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const dimensionsArray = Object.values(availableSettings)
    const needsToggle = dimensionsArray.length > collapsedCount

    return (
        <div className="md-controls">
            {dimensionsArray.map((dim, index) => (
                <DimensionDropdown
                    key={dim.slug}
                    className={cx({
                        "md-settings__control--hidden":
                            !isExpanded && index >= collapsedCount,
                    })}
                    dimension={dim}
                    value={resolvedSettings[dim.slug]}
                    onChange={(value) => {
                        onChange({
                            ...resolvedSettings,
                            [dim.slug]: value,
                        })
                    }}
                    readOnly={readOnly}
                />
            ))}
            {needsToggle && (
                <button
                    className="md-controls__toggle label-2-medium"
                    onClick={() => setIsExpanded(!isExpanded)}
                    type="button"
                    aria-expanded={isExpanded}
                >
                    <FontAwesomeIcon
                        className="md-controls__toggle-icon"
                        icon={isExpanded ? faMinus : faPlus}
                        aria-hidden="true"
                    />
                    <span className="md-controls__toggle-text">
                        {isExpanded ? "Show less" : "Show more"}
                    </span>
                </button>
            )}
        </div>
    )
}
