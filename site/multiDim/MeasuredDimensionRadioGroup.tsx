import { useRef, type RefObject } from "react"
import { useResizeObserver } from "usehooks-ts"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionDropdown from "./DimensionDropdown.js"
import DimensionRadioGroup from "./DimensionRadioGroup.js"

/**
 * Renders as a radio when there is enough space for that, and as a dropdown if not.
 * To do that, a hidden radio is always rendered, and we measure its width (using a ResizeObserver) to see if it fits.
 */
export default function MeasuredDimensionRadioGroup({
    className,
    dimension,
    availableDimension,
    availableWidth,
    value,
    onChange,
    readOnly,
}: {
    className?: string
    dimension: DimensionEnriched
    availableDimension: DimensionEnriched
    availableWidth?: number
    value: string
    onChange: (value: string) => void
    readOnly?: boolean
}) {
    const measureRef = useRef<HTMLDivElement>(null)
    const { width: requiredWidth } = useResizeObserver({
        ref: measureRef as RefObject<HTMLDivElement>,
        box: "border-box",
    })
    // Keep the radio group until both widths are known, including during SSR.
    const fitsAsRadio =
        requiredWidth === undefined ||
        !availableWidth ||
        requiredWidth <= availableWidth

    return (
        <>
            {/* Keep measuring even while the dropdown is shown, so switching
                controls cannot change the measured width and cause a loop.
                CSS sizes this copy for the active layout; ResizeObserver also
                catches changes from font loading and viewport breakpoints. */}
            <div
                className="md-settings__radio-group-options md-radio-measure"
                aria-hidden="true"
                ref={measureRef}
            >
                {dimension.choices.map((choice) => (
                    <div key={choice.slug} className="md-settings__radio-field">
                        <span className="md-settings__radio">
                            <span className="md-settings__radio-label">
                                {choice.name}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
            {fitsAsRadio ? (
                <DimensionRadioGroup
                    className={className}
                    dimension={dimension}
                    availableChoiceSlugs={
                        new Set(Object.keys(availableDimension.choicesBySlug))
                    }
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                />
            ) : (
                <DimensionDropdown
                    className={className}
                    dimension={availableDimension}
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                    showSearch={false}
                />
            )}
        </>
    )
}
