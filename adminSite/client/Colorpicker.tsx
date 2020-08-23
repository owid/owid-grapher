import * as React from "react"
import { action } from "mobx"
import { SketchPicker } from "react-color"

import { lastOfNonEmptyArray } from "charts/utils/Util"
import { ColorSchemes, ColorScheme } from "charts/color/ColorSchemes"

export interface ColorpickerProps {
    color?: string
    onColor: (color: string | undefined) => void
}

export class Colorpicker extends React.Component<ColorpickerProps> {
    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    render() {
        const scheme = ColorSchemes["owid-distinct"] as ColorScheme
        const availableColors: string[] = lastOfNonEmptyArray(scheme.colorSets)

        return (
            <SketchPicker
                disableAlpha
                presetColors={availableColors}
                color={this.props.color}
                onChange={color => this.onColor(color.hex)}
            />
        )
    }
}
