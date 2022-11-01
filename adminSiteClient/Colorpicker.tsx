import React from "react"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { SketchPicker } from "react-color"

import { invert, lastOfNonEmptyArray } from "@ourworldindata/utils"
import {
    ColorSchemes,
    getColorNameOwidDistinctAndSematicPalettes,
    getColorNameOwidDistinctLinesAndSematicPalettes,
} from "@ourworldindata/grapher"
interface ColorpickerProps {
    color?: string
    showLineChartColors: boolean
    onColor: (color: string | undefined) => void
}

@observer
export class Colorpicker extends React.Component<ColorpickerProps> {
    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    @action.bound setHoveredSwatch(hex: string) {
        const uiDisplayName = this.props.showLineChartColors
            ? getColorNameOwidDistinctLinesAndSematicPalettes(hex)
            : getColorNameOwidDistinctAndSematicPalettes(hex)
        this.hoveredSwatch = uiDisplayName
    }

    @observable hoveredSwatch: string[] = []

    render() {
        const scheme = this.props.showLineChartColors
            ? ColorSchemes["OwidDistinctLines"]
            : ColorSchemes["owid-distinct"]
        const { hoveredSwatch } = this
        const availableColors: string[] = lastOfNonEmptyArray(scheme.colorSets)

        return (
            <React.Fragment>
                <SketchPicker
                    disableAlpha
                    presetColors={availableColors}
                    color={this.props.color}
                    onSwatchHover={(color) => this.setHoveredSwatch(color.hex)}
                    onChange={(color) => this.onColor(color.hex)}
                />
                <div style={{ paddingLeft: "8px", paddingRight: "8px" }}>
                    {hoveredSwatch.map((line) => (
                        <div key="line">{line}</div>
                    ))}
                </div>
            </React.Fragment>
        )
    }
}
