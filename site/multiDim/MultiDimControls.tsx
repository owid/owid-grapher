import cx from "clsx"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useMemo, useRef, useState, type RefObject } from "react"
import { useResizeObserver } from "usehooks-ts"

import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { resolveDimensionPresentationType } from "@ourworldindata/utils"
import DimensionDropdown from "./DimensionDropdown.js"
import MeasuredDimensionRadioGroup from "./MeasuredDimensionRadioGroup.js"

export default function MultiDimControls({
    dimensions,
    availableSettings,
    resolvedSettings,
    onChange,
    collapsedCount,
    readOnly,
}: {
    dimensions: Record<string, DimensionEnriched>
    availableSettings: Record<string, DimensionEnriched>
    resolvedSettings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
    collapsedCount: number
    readOnly?: boolean
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const controls = useMemo(
        () =>
            Object.values(availableSettings).map((dim) => {
                const fullDimension = dimensions[dim.slug] ?? dim
                const presentationType = resolveDimensionPresentationType({
                    dimension: fullDimension,
                    numberOfDimensions: Object.keys(dimensions).length,
                    // `dim` holds just the choices available right now
                    availableChoiceCount: dim.choices.length,
                })
                return { dim, fullDimension, presentationType }
            }),
        [availableSettings, dimensions]
    )
    const needsToggle = controls.length > collapsedCount

    const containerRef = useRef<HTMLDivElement | null>(null)
    const { width: availableWidth } = useResizeObserver({
        ref: containerRef as RefObject<HTMLDivElement>,
    })

    return (
        <div className="md-controls" ref={containerRef}>
            {controls.map(({ dim, fullDimension, presentationType }, index) => {
                const controlClassName = cx({
                    "md-settings__control--hidden":
                        !isExpanded && index >= collapsedCount,
                })
                const handleChange = (value: string) => {
                    onChange({
                        ...resolvedSettings,
                        [dim.slug]: value,
                    })
                }
                return presentationType === "radio" ? (
                    <MeasuredDimensionRadioGroup
                        key={dim.slug}
                        className={controlClassName}
                        dimension={fullDimension}
                        availableDimension={dim}
                        availableWidth={availableWidth}
                        value={resolvedSettings[dim.slug]}
                        onChange={handleChange}
                        readOnly={readOnly}
                    />
                ) : (
                    <DimensionDropdown
                        key={dim.slug}
                        className={controlClassName}
                        dimension={dim}
                        value={resolvedSettings[dim.slug]}
                        onChange={handleChange}
                        readOnly={readOnly}
                        showSearch={presentationType === "dropdown-with-search"}
                    />
                )
            })}
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
