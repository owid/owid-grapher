import { Component } from "react"
import { computed, action, makeObservable } from "mobx"
import { Select } from "antd"
import { GrapherChartOrMapType } from "@ourworldindata/types"
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

interface ColorSchemeDropdownProps {
    additionalOptions: ColorSchemeOption[]
    value?: string
    gradientColorCount: number
    invertedColorScheme: boolean
    chartType: GrapherChartOrMapType
    onChange: (selected: ColorSchemeOption) => void
    onBlur?: () => void
}

@observer
export class ColorSchemeDropdown extends Component<ColorSchemeDropdownProps> {
    static defaultProps = {
        additionalOptions: [],
        gradientColorCount: 6,
        invertedColorScheme: false,
    }

    constructor(props: ColorSchemeDropdownProps) {
        super(props)
        makeObservable(this)
    }

    @computed get additionalOptions() {
        return this.props.additionalOptions
    }

    @computed get gradientColorCount() {
        return this.props.gradientColorCount
    }

    @computed get colorSchemeOptions() {
        return Object.entries(getColorSchemeForChartType(this.props.chartType))
            .filter(([, v]) => v !== undefined)
            .map(([key, scheme]) => {
                return {
                    colorScheme: scheme,
                    gradient: this.createLinearGradient(
                        scheme,
                        this.gradientColorCount
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

    createLinearGradient(colorScheme: ColorScheme, count: number) {
        const colors = colorScheme.getColors(count)

        const step = 100 / count
        const gradientEntries = colors.map(
            (color, i) => `${color} ${i * step}%, ${color} ${(i + 1) * step}%`
        )

        return `linear-gradient(90deg, ${gradientEntries.join(", ")})`
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
                optionFilterProp="searchLabel"
                value={this.props.value}
                placeholder="Select..."
                showSearch={false}
                style={{ width: "100%" }}
            />
        )
    }
}
