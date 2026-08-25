import cx from "clsx"
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { forwardRef, useState } from "react"

import {
    DimensionEnriched,
    MultiDimDimensionChoices,
} from "@ourworldindata/types"
import { resolveDimensionPresentationType } from "@ourworldindata/utils"
import DimensionDropdown from "./DimensionDropdown.js"
import DimensionRadioGroup from "./DimensionRadioGroup.js"

const MultiDimControls = forwardRef<
    HTMLDivElement,
    {
        className?: string
        dimensions: Record<string, DimensionEnriched>
        availableSettings: Record<string, DimensionEnriched>
        resolvedSettings: MultiDimDimensionChoices
        onChange: (settings: MultiDimDimensionChoices) => void
        collapsedCount: number
        disabled?: boolean
    }
>(function MultiDimControls(
    {
        className,
        dimensions,
        availableSettings,
        resolvedSettings,
        onChange,
        collapsedCount,
        disabled,
    },
    ref
) {
    const [isExpanded, setIsExpanded] = useState(false)
    const dimensionsArray = Object.values(availableSettings)
    const needsToggle = dimensionsArray.length > collapsedCount

    return (
        <div className={cx("md-controls", className)} ref={ref}>
            {dimensionsArray.map((dim, index) => {
                const fullDimension = dimensions[dim.slug] ?? dim
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
                return resolveDimensionPresentationType(fullDimension) ===
                    "radio" ? (
                    <DimensionRadioGroup
                        key={dim.slug}
                        className={controlClassName}
                        dimension={fullDimension}
                        availableChoiceSlugs={
                            new Set(Object.keys(dim.choicesBySlug))
                        }
                        value={resolvedSettings[dim.slug]}
                        onChange={handleChange}
                        disabled={disabled}
                    />
                ) : (
                    <DimensionDropdown
                        key={dim.slug}
                        className={controlClassName}
                        dimension={dim}
                        value={resolvedSettings[dim.slug]}
                        onChange={handleChange}
                        disabled={disabled}
                    />
                )
            })}
            {needsToggle && (
                <button
                    className="md-controls__toggle"
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
})

export default MultiDimControls
