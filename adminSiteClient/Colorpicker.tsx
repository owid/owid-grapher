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

type InputMode = "hex" | "rgb"

function expandHex(input: string): string | undefined {
    const cleaned = input.trim().replace(/^#/, "")
    const expanded =
        cleaned.length === 3
            ? cleaned
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : cleaned
    return /^[0-9a-fA-F]{6}$/.test(expanded)
        ? expanded.toLowerCase()
        : undefined
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const expanded = expandHex(hex)
    if (!expanded) return { r: 0, g: 0, b: 0 }
    return {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
    }
}

function rgbToHex(r: number, g: number, b: number): string {
    const channel = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, "0")
    return "#" + channel(r) + channel(g) + channel(b)
}

@observer
export class Colorpicker extends Component<ColorpickerProps> {
    regionsFilter: boolean = false
    othersFilter: boolean = false
    inputMode: InputMode = "hex"
    hexInputDraft: string | undefined = undefined

    constructor(props: ColorpickerProps) {
        super(props)
        makeObservable(this, {
            regionsFilter: observable,
            othersFilter: observable,
            inputMode: observable,
            hexInputDraft: observable,
        })
    }

    @action.bound private toggleRegionsFilter() {
        this.regionsFilter = !this.regionsFilter
    }

    @action.bound private toggleOthersFilter() {
        this.othersFilter = !this.othersFilter
    }

    @action.bound private toggleInputMode() {
        this.inputMode = this.inputMode === "hex" ? "rgb" : "hex"
        this.hexInputDraft = undefined
    }

    @action.bound onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    @action.bound private onHexInputChange(value: string) {
        this.hexInputDraft = value
        const expanded = expandHex(value)
        if (expanded) this.props.onColor("#" + expanded)
    }

    @action.bound private onHexInputBlur() {
        this.hexInputDraft = undefined
    }

    @action.bound private onRgbChannelChange(
        channel: "r" | "g" | "b",
        value: string
    ) {
        const num = Math.max(0, Math.min(255, parseInt(value, 10) || 0))
        const current = this.displayedRgb ?? { r: 0, g: 0, b: 0 }
        const next = { ...current, [channel]: num }
        this.props.onColor(rgbToHex(next.r, next.g, next.b))
    }

    @computed private get isCategoricalMap(): boolean {
        return this.props.baseColorScheme === ColorSchemeName.OwidCategoricalMap
    }

    @computed private get displayedHex(): string {
        if (this.hexInputDraft !== undefined) return this.hexInputDraft
        if (this.props.color === undefined) return ""
        return this.props.color.replace(/^#/, "").toUpperCase()
    }

    @computed private get displayedRgb():
        | { r: number; g: number; b: number }
        | undefined {
        if (this.props.color === undefined) return undefined
        return hexToRgb(this.props.color)
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
        const { regionsFilter, othersFilter } = this
        if (!regionsFilter && !othersFilter) return false
        // Show a swatch (don't dim) if it matches AT LEAST one active filter
        const matchesRegions = regionsFilter && !!preset.info.region
        const matchesOthers = othersFilter && !!preset.info.energy
        return !(matchesRegions || matchesOthers)
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
                theme="light"
            >
                {swatch}
            </Tippy>
        )
    }

    private renderFilterPills() {
        if (this.isCategoricalMap) return null
        return (
            <div className="colorpicker-filter">
                <button
                    type="button"
                    className={cx("colorpicker-filter__pill", {
                        "colorpicker-filter__pill--active": this.regionsFilter,
                    })}
                    aria-pressed={this.regionsFilter}
                    onClick={this.toggleRegionsFilter}
                >
                    Regions
                </button>
                <button
                    type="button"
                    className={cx("colorpicker-filter__pill", {
                        "colorpicker-filter__pill--active": this.othersFilter,
                    })}
                    aria-pressed={this.othersFilter}
                    onClick={this.toggleOthersFilter}
                >
                    Others
                </button>
            </div>
        )
    }

    private renderColorInput() {
        const otherMode = this.inputMode === "hex" ? "RGB" : "HEX"
        return (
            <div className="colorpicker-input">
                <Tippy
                    content={`Switch to ${otherMode}`}
                    placement="top"
                    appendTo={() => document.body}
                    theme="light"
                >
                    <button
                        type="button"
                        className="colorpicker-input__mode"
                        onClick={this.toggleInputMode}
                        aria-label={`Switch to ${otherMode} input`}
                    >
                        {this.inputMode === "hex" ? "HEX" : "RGB"}
                    </button>
                </Tippy>
                {this.inputMode === "hex" ? (
                    <input
                        type="text"
                        className="colorpicker-input__hex"
                        value={this.displayedHex}
                        placeholder="Default"
                        onChange={(e) => this.onHexInputChange(e.target.value)}
                        onBlur={this.onHexInputBlur}
                        spellCheck={false}
                        maxLength={7}
                        aria-label="Hex value"
                    />
                ) : (
                    <div className="colorpicker-input__rgb">
                        {(["r", "g", "b"] as const).map((channel) => (
                            <input
                                key={channel}
                                type="number"
                                min={0}
                                max={255}
                                className="colorpicker-input__rgb-cell"
                                value={this.displayedRgb?.[channel] ?? ""}
                                placeholder="—"
                                onChange={(e) =>
                                    this.onRgbChannelChange(
                                        channel,
                                        e.target.value
                                    )
                                }
                                aria-label={channel.toUpperCase()}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    override render() {
        return (
            <Fragment>
                <div className="colorpicker-header">Choose color</div>
                <div className="colorpicker-presets">
                    {this.presetColors.map((preset) =>
                        this.renderPresetSwatch(preset)
                    )}
                </div>
                {this.renderFilterPills()}
                <SketchPicker
                    disableAlpha
                    presetColors={[]}
                    color={this.props.color}
                    onChange={(color) => this.onColor(color.hex)}
                />
                {this.renderColorInput()}
            </Fragment>
        )
    }
}
