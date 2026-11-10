import cx from "clsx"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useMemo, useState } from "react"

import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { resolveDimensionPresentationType } from "@ourworldindata/utils"
import DimensionDropdown from "./DimensionDropdown.js"
import DimensionToggleButtons from "./DimensionToggleButtons.js"

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
                    // `dim` holds just the choices available right now
                    availableChoiceCount: dim.choices.length,
                })
                return { dim, fullDimension, presentationType }
            }),
        [availableSettings, dimensions]
    )
    const needsToggle = controls.length > collapsedCount

    return (
        <div className="md-controls">
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
                return presentationType === "toggle-buttons" ? (
                    <DimensionToggleButtons
                        key={dim.slug}
                        className={controlClassName}
                        dimension={fullDimension}
                        availableChoiceSlugs={
                            new Set(Object.keys(dim.choicesBySlug))
                        }
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
