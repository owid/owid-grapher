import { Component, Fragment } from "react"
import { action, makeObservable } from "mobx";
import { observer } from "mobx-react"
import { SketchPicker } from "react-color"

import { ColorSchemeName, lastOfNonEmptyArray } from "@ourworldindata/utils"
import {
    ColorSchemes,
    getColorNameOwidDistinctAndSemanticPalettes,
    getColorNameOwidDistinctLinesAndSemanticPalettes,
} from "@ourworldindata/grapher"
interface ColorpickerProps {
    color?: string
    showLineChartColors: boolean
    onColor: (color: string | undefined) => void
}

@observer
export class Colorpicker extends Component<ColorpickerProps> {
    constructor(props: ColorpickerProps) {
        super(props);
        makeObservable(this);
    }

    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    render() {
        const scheme = this.props.showLineChartColors
            ? ColorSchemes.get(ColorSchemeName.OwidDistinctLines)
            : ColorSchemes.get(ColorSchemeName["owid-distinct"])

        const availableColors: string[] = lastOfNonEmptyArray(scheme.colorSets)
        const colorNameLookupFn = (color: string) => {
            const nameLines = this.props.showLineChartColors
                ? getColorNameOwidDistinctLinesAndSemanticPalettes(color)
                : getColorNameOwidDistinctAndSemanticPalettes(color)
            return nameLines.join(" ")
        }

        return (
            <Fragment>
                <SketchPicker
                    disableAlpha
                    presetColors={availableColors.map((color) => ({
                        color,
                        title: colorNameLookupFn(color),
                    }))}
                    color={this.props.color}
                    onChange={(color) => this.onColor(color.hex)}
                />
            </Fragment>
        )
    }
}
