import { Component, Fragment } from "react"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { SketchPicker } from "react-color"

import { ColorSchemeName, lastOfNonEmptyArray } from "@ourworldindata/utils"
import {
    ColorSchemes,
    getColorNameOwidDistinctAndSemanticPalettes,
    getColorNameOwidDistinctLinesAndSemanticPalettes,
    OwidMapColors,
} from "@ourworldindata/grapher"
interface ColorpickerProps {
    color?: string
    showLineChartColors: boolean
    baseColorScheme?: ColorSchemeName
    onColor: (color: string | undefined) => void
}

@observer
export class Colorpicker extends Component<ColorpickerProps> {
    constructor(props: ColorpickerProps) {
        super(props)
        makeObservable(this)
    }

    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    private get presetColors(): { color: string; title: string }[] {
        const isOwidCategoricalMap =
            this.props.baseColorScheme === ColorSchemeName.OwidCategoricalMap

        if (isOwidCategoricalMap) {
            // We use OwidMapColors instead of the scheme's palette
            // because it includes three additional 'special' colors
            // to be used sparingly when needed (Taupe, Mustard, Tomato)
            return Object.entries(OwidMapColors).map(([name, color]) => ({
                color,
                title: name,
            }))
        } else {
            const scheme = this.props.showLineChartColors
                ? ColorSchemes.get(ColorSchemeName.OwidDistinctLines)
                : ColorSchemes.get(ColorSchemeName["owid-distinct"])

            const colorNameLookupFn = (color: string) => {
                const nameLines = this.props.showLineChartColors
                    ? getColorNameOwidDistinctLinesAndSemanticPalettes(color)
                    : getColorNameOwidDistinctAndSemanticPalettes(color)
                return nameLines.join(" ")
            }
            return lastOfNonEmptyArray(scheme.colorSets).map((color) => ({
                color,
                title: colorNameLookupFn(color),
            }))
        }
    }

    override render() {
        return (
            <Fragment>
                <SketchPicker
                    disableAlpha
                    presetColors={this.presetColors}
                    color={this.props.color}
                    onChange={(color) => this.onColor(color.hex)}
                />
            </Fragment>
        )
    }
}
