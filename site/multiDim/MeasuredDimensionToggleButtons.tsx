import { useRef, useState, type RefObject } from "react"
import { useResizeObserver } from "usehooks-ts"

import { DimensionEnriched } from "@ourworldindata/types"
import DimensionDropdown from "./DimensionDropdown.js"
import DimensionToggleButtons, {
    ToggleButtonOptions,
} from "./DimensionToggleButtons.js"
import { fitsAsToggleButtons } from "./toggleButtonsFit.js"

/**
 * Renders as a toggle group when there is enough space for that, and as a dropdown if not
 * (even when toggle buttons are explicitly configured via `presentation.type`).
 * To do that, a hidden instance of its options is always rendered, and we measure its width (using a ResizeObserver) to see if it fits.
 */
export default function MeasuredDimensionToggleButtons({
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
    // The decision depends on what is showing right now (see
    // fitsAsToggleButtons), so it's kept in state and updated while
    // rendering whenever a measurement changes it. Starts out as toggle
    // buttons, which is also what the server renders.
    const [showsToggleButtons, setShowsToggleButtons] = useState(true)
    const fitsAsToggleGroup = fitsAsToggleButtons({
        showsToggleButtons,
        requiredWidth,
        availableWidth,
    })
    if (fitsAsToggleGroup !== showsToggleButtons)
        setShowsToggleButtons(fitsAsToggleGroup)

    return (
        <>
            {/* Keep measuring even while the dropdown is shown, so switching
                controls cannot change the measured width and cause a loop.
                CSS sizes this instance for the active layout; ResizeObserver also
                catches changes from font loading and viewport breakpoints. */}
            <ToggleButtonOptions
                className="md-toggle-measure"
                dimension={dimension}
                isDisabled
                // Keeps it out of the tab order and the accessibility
                // tree, as do the styles, which make it invisible.
                inert
                ref={measureRef}
            />
            {fitsAsToggleGroup ? (
                <DimensionToggleButtons
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
