import { LabeledDropdown } from "../../../../components/LabeledDropdown/LabeledDropdown.js"

import { COLOR_BY_OPTIONS, ColorBy } from "../core/constants.js"
import { COLOR_SCHEMES } from "../core/colorSchemes.js"

const OPTIONS = COLOR_BY_OPTIONS.map((colorBy) => ({
    value: colorBy,
    label: COLOR_SCHEMES[colorBy].label,
}))

export function ColorByDropdown({
    colorBy,
    onChange,
}: {
    colorBy: ColorBy
    onChange: (colorBy: ColorBy) => void
}) {
    return (
        <LabeledDropdown
            label="Color by"
            className="color-by-dropdown"
            options={OPTIONS}
            selectedValue={colorBy}
            onChange={(value) => onChange(value as ColorBy)}
        />
    )
}
