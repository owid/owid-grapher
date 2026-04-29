import { Component, Fragment } from "react"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { SketchPicker } from "react-color"
import Tippy from "@tippyjs/react"
import cx from "classnames"

import { ColorSchemeName, lastOfNonEmptyArray } from "@ourworldindata/utils"
import {
    ColorSchemes,
    ColorSemanticInfo,
    getColorNameOwidDistinctAndSemanticPalettes,
    getColorNameOwidDistinctLinesAndSemanticPalettes,
    OwidMapColors,
    toColorDisplayName,
} from "@ourworldindata/grapher"

interface ColorpickerProps {
    color?: string
    showLineChartColors: boolean
    baseColorScheme?: ColorSchemeName
    onColor: (color: string | undefined) => void
}

interface PresetColor {
    color: string
    info: ColorSemanticInfo
}

type PresetFilter = "all" | "regions" | "others"

const FILTER_OPTIONS: { value: PresetFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "regions", label: "Regions" },
    { value: "others", label: "Others" },
]

@observer
export class Colorpicker extends Component<ColorpickerProps> {
    filter: PresetFilter = "all"

    constructor(props: ColorpickerProps) {
        super(props)
        makeObservable(this, {
            filter: observable,
        })
    }

    @action.bound private setFilter(filter: PresetFilter) {
        this.filter = filter
    }

    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    @computed private get isCategoricalMap(): boolean {
        return this.props.baseColorScheme === ColorSchemeName.OwidCategoricalMap
    }

    @computed private get presetColors(): PresetColor[] {
        if (this.isCategoricalMap) {
            // We use OwidMapColors instead of the scheme's palette
            // because it includes three additional 'special' colors
            // to be used sparingly when needed (Taupe, Mustard, Tomato)
            return Object.entries(OwidMapColors).map(([name, color]) => ({
                color,
                info: { colorName: toColorDisplayName(name) },
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
            info: colorNameLookupFn(color),
        }))
    }

    private isPresetDimmed(preset: PresetColor): boolean {
        switch (this.filter) {
            case "regions":
                return !preset.info.region
            case "others":
                return !preset.info.energy
            default:
                return false
        }
    }

    private renderPresetSwatch(preset: PresetColor) {
        const { color, info } = preset
        const { colorName, region, energy } = info
        const isSelected =
            this.props.color !== undefined &&
            this.props.color.toLowerCase() === color.toLowerCase()
        const isDimmed = this.isPresetDimmed(preset)

        const ariaLabelParts = [
            colorName,
            region ? `Regions: ${region}` : undefined,
            energy ? `Others: ${energy}` : undefined,
        ].filter((x): x is string => !!x)

        const tooltipContent = (
            <div className="colorpicker-presets__tooltip">
                <div className="colorpicker-presets__tooltip-title">
                    {colorName ?? color}
                </div>
                {region && (
                    <div className="colorpicker-presets__tooltip-row">
                        <span className="colorpicker-presets__tooltip-label">
                            Regions:
                        </span>{" "}
                        {region}
                    </div>
                )}
                {energy && (
                    <div className="colorpicker-presets__tooltip-row">
                        <span className="colorpicker-presets__tooltip-label">
                            Others:
                        </span>{" "}
                        {energy}
                    </div>
                )}
            </div>
        )

        const swatch = (
            <button
                type="button"
                className={cx("colorpicker-presets__swatch", {
                    "colorpicker-presets__swatch--selected": isSelected,
                    "colorpicker-presets__swatch--dimmed": isDimmed,
                })}
                style={{ backgroundColor: color }}
                onClick={isDimmed ? undefined : () => this.onColor(color)}
                disabled={isDimmed}
                aria-label={ariaLabelParts.join(", ") || color}
            />
        )

        // No tooltip for dimmed swatches — they're inactive in the current filter view
        if (isDimmed) return <Fragment key={color}>{swatch}</Fragment>

        return (
            <Tippy
                key={color}
                content={tooltipContent}
                delay={[100, 0]}
                placement="top"
                appendTo={() => document.body}
                maxWidth={220}
            >
                {swatch}
            </Tippy>
        )
    }

    private renderFilterTabs() {
        if (this.isCategoricalMap) return null
        return (
            <div className="colorpicker-filter" role="tablist">
                {FILTER_OPTIONS.map(({ value, label }) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={this.filter === value}
                        className={cx("colorpicker-filter__tab", {
                            "colorpicker-filter__tab--active":
                                this.filter === value,
                        })}
                        onClick={() => this.setFilter(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>
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
                {this.renderFilterTabs()}
                <div className="colorpicker-presets">
                    {this.presetColors.map((preset) =>
                        this.renderPresetSwatch(preset)
                    )}
                </div>
            </Fragment>
        )
    }
}
