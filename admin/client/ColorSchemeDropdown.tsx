import * as React from "react"
import { computed, action } from "mobx"
import Select, { ValueType } from "react-select"
import { ColorScheme, ColorSchemes } from "charts/ColorSchemes"
import { observer } from "mobx-react"
import { bind } from "decko"

import { asArray } from "utils/client/react-select"

export interface ColorSchemeOption {
    colorScheme?: ColorScheme
    gradient?: string
    label: string
    value: string
}

export interface ColorSchemeDropdownProps {
    additionalOptions: ColorSchemeOption[]
    value?: string
    gradientColorCount: number
    invertedColorScheme: boolean
    onChange: (selected: ColorSchemeOption) => void
}

@observer
export class ColorSchemeDropdown extends React.Component<
    ColorSchemeDropdownProps
> {
    static defaultProps = {
        additionalOptions: [],
        gradientColorCount: 6,
        invertedColorScheme: false
    }

    @computed get additionalOptions() {
        return this.props.additionalOptions
    }

    @computed get gradientColorCount() {
        return this.props.gradientColorCount
    }

    @computed get colorSchemeOptions() {
        return Object.entries(ColorSchemes)
            .filter(([, v]) => v !== undefined)
            .map(([key, scheme]) => {
                return {
                    colorScheme: scheme as ColorScheme,
                    gradient: this.createLinearGradient(
                        scheme as ColorScheme,
                        this.gradientColorCount
                    ),
                    label: (scheme as ColorScheme).name,
                    value: key
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

    @action.bound onChange(selected: ValueType<ColorSchemeOption>) {
        const value = asArray(selected)[0]
        this.props.onChange(value)
    }

    @bind formatOptionLabel(option: ColorSchemeOption) {
        const { invertedColorScheme } = this.props

        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
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
                                : undefined
                        }}
                    />
                )}
            </div>
        )
    }

    render() {
        return (
            <Select
                options={this.allOptions}
                formatOptionLabel={this.formatOptionLabel}
                onChange={this.onChange}
                value={this.allOptions.find(
                    scheme => scheme.value === this.props.value
                )}
                components={{
                    IndicatorSeparator: null
                }}
                styles={{
                    singleValue: provided => {
                        return {
                            ...provided,
                            width: "calc(100% - 10px)"
                        }
                    }
                }}
                menuPlacement="auto"
            />
        )
    }
}
