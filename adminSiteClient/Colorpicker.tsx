import { Component, Fragment } from "react"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { SketchPicker } from "react-color"
import Tippy from "@tippyjs/react"
import cx from "classnames"

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

interface PresetColor {
    color: string
    lines: string[]
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

    private get presetColors(): PresetColor[] {
        const isOwidCategoricalMap =
            this.props.baseColorScheme === ColorSchemeName.OwidCategoricalMap

        if (isOwidCategoricalMap) {
            // We use OwidMapColors instead of the scheme's palette
            // because it includes three additional 'special' colors
            // to be used sparingly when needed (Taupe, Mustard, Tomato)
            return Object.entries(OwidMapColors).map(([name, color]) => ({
                color,
                lines: [name],
            }))
        }

        const scheme = this.props.showLineChartColors
            ? ColorSchemes.get(ColorSchemeName.OwidDistinctLines)
            : ColorSchemes.get(ColorSchemeName["owid-distinct"])

        const colorNameLookupFn = this.props.showLineChartColors
            ? getColorNameOwidDistinctLinesAndSemanticPalettes
            : getColorNameOwidDistinctAndSemanticPalettes

        return lastOfNonEmptyArray(scheme.colorSets).map((color) => ({
            color,
            lines: colorNameLookupFn(color),
        }))
    }

    private renderPresetSwatch(preset: PresetColor) {
        const { color, lines } = preset
        const isSelected =
            this.props.color !== undefined &&
            this.props.color.toLowerCase() === color.toLowerCase()

        const tooltipContent =
            lines.length > 0 ? (
                <>
                    {lines.map((line) => (
                        <span
                            key={line}
                            className="colorpicker-presets__tooltip-line"
                        >
                            {line}
                        </span>
                    ))}
                </>
            ) : (
                color
            )

        return (
            <Tippy
                key={color + lines.join("|")}
                content={tooltipContent}
                delay={[100, 0]}
                placement="top"
                appendTo={() => document.body}
            >
                <button
                    type="button"
                    className={cx("colorpicker-presets__swatch", {
                        "colorpicker-presets__swatch--selected": isSelected,
                    })}
                    style={{ backgroundColor: color }}
                    onClick={() => this.onColor(color)}
                    aria-label={lines.join(", ") || color}
                />
            </Tippy>
        )
    }

    override render() {
        return (
            <Fragment>
                <SketchPicker
                    disableAlpha
                    presetColors={[]}
                    color={this.props.color}
                    onChange={(color) => this.onColor(color.hex)}
                />
                <div className="colorpicker-presets">
                    {this.presetColors.map((preset) =>
                        this.renderPresetSwatch(preset)
                    )}
                </div>
            </Fragment>
        )
    }
}
