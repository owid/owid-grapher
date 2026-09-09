import { Component } from "react"
import { computed, action, makeObservable } from "mobx"
import { Select } from "antd"
import { Color, GrapherChartOrMapType } from "@ourworldindata/types"
import {
    ColorScheme,
    getColorSchemeForChartType,
} from "@ourworldindata/grapher"
import { observer } from "mobx-react"
import { bind } from "@ourworldindata/utils"

export interface ColorSchemeOption {
    colorScheme?: ColorScheme
    gradient?: string
    label: string
    value: string
}

interface ColorSchemeSelectOption {
    value: string
    label: React.ReactNode
    searchLabel: string
}

const MAX_PREVIEW_BANDS = 6

interface ColorSchemeDropdownProps {
    additionalOptions: ColorSchemeOption[]
    value?: string
    invertedColorScheme: boolean
    chartType: GrapherChartOrMapType
    onChange: (selected: ColorSchemeOption) => void
    onBlur?: () => void
}

@observer
export class ColorSchemeDropdown extends Component<ColorSchemeDropdownProps> {
    static defaultProps = {
        additionalOptions: [],
        invertedColorScheme: false,
    }

    constructor(props: ColorSchemeDropdownProps) {
        super(props)
        makeObservable(this)
    }

    @computed get additionalOptions() {
        return this.props.additionalOptions
    }

    @computed get colorSchemeOptions() {
        return Object.entries(getColorSchemeForChartType(this.props.chartType))
            .filter(([, v]) => v !== undefined)
            .map(([key, scheme]) => {
                return {
                    colorScheme: scheme,
                    gradient: createLinearGradient(
                        scheme.getColors(this.getPreviewColorCount(scheme))
                    ),
                    label: scheme.name,
                    value: key,
                }
            })
    }

    @computed get allOptions() {
        const { additionalOptions } = this

        return additionalOptions.concat(this.colorSchemeOptions)
    }

    getPreviewColorCount(colorScheme: ColorScheme): number {
        const { isDistinct, paletteSize } = colorScheme
        if (!isDistinct || paletteSize === 0) return MAX_PREVIEW_BANDS
        return Math.min(MAX_PREVIEW_BANDS, paletteSize)
    }

    @action.bound onChange(value: ColorSchemeOption | null) {
        if (value) this.props.onChange(value)
    }

    @action.bound onSelectChange(value: string) {
        const selected = this.allOptions.find(
            (option) => option.value === value
        )
        this.onChange(selected ?? null)
    }

    @bind formatOptionLabel(option: ColorSchemeOption) {
        const { invertedColorScheme } = this.props

        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>{option.label}</div>

                {option.gradient && (
                    <span
                        style={{
                            backgroundImage: option.gradient,
                            width: "6rem",
                            height: "1.25rem",
                            border: "1px solid #aaa",

                            // Mirror the element if color schemes are inverted
                            transform: invertedColorScheme
                                ? "scaleX(-1)"
                                : undefined,
                        }}
                    />
                )}
            </div>
        )
    }

    override render() {
        const selectOptions: ColorSchemeSelectOption[] = this.allOptions.map(
            (option) => ({
                value: option.value,
                label: this.formatOptionLabel(option),
                searchLabel: option.label,
            })
        )
        return (
            <Select<string, ColorSchemeSelectOption>
                options={selectOptions}
                onChange={this.onSelectChange}
                onBlur={this.props.onBlur}
                value={this.props.value}
                placeholder="Select..."
                showSearch={{ optionFilterProp: "searchLabel" }}
                style={{ width: "100%" }}
            />
        )
    }
}

/** One hard-edged band per color, as a CSS background-image value. */
function createLinearGradient(colors: Color[]): string {
    const step = 100 / colors.length
    const bands = colors.map(
        (color, i) => `${color} ${i * step}%, ${color} ${(i + 1) * step}%`
    )
    return `linear-gradient(90deg, ${bands.join(", ")})`
}
