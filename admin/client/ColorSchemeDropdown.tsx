import * as React from "react"
import { computed, action } from "mobx"
import Select, { ValueType } from "react-select"
import { ColorScheme, ColorSchemes } from "charts/ColorSchemes"
import { observer } from "mobx-react"

export interface ColorSchemeOption {
    colorScheme?: ColorScheme
    gradient?: string
    label: string
    value: string
}

export interface ColorSchemeDropdownProps {
    additionalColorSchemes: ColorSchemeOption[]
    initialValue?: string
    gradientColorCount: number
    invertedColorScheme: boolean
    onChange: (selected: ColorSchemeOption) => void
}

@observer
export class ColorSchemeDropdown extends React.Component<
    ColorSchemeDropdownProps
> {
    static defaultProps = {
        additionalColorSchemes: [],
        gradientColorCount: 6,
        invertedColorScheme: false
    }

    @computed get additionalColorSchemes() {
        return this.props.additionalColorSchemes
    }

    @computed get gradientColorCount() {
        return this.props.gradientColorCount
    }

    @computed get availableColorSchemes() {
        const { additionalColorSchemes, gradientColorCount } = this

        return additionalColorSchemes.concat(
            Object.entries(ColorSchemes).map(([key, scheme]) => {
                return {
                    colorScheme: scheme as ColorScheme,
                    gradient: this.createLinearGradient(
                        scheme as ColorScheme,
                        gradientColorCount
                    ),
                    label: (scheme as ColorScheme).name,
                    value: key
                }
            })
        )
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
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.

        this.props.onChange(selected as ColorSchemeOption)
    }

    @action.bound formatOptionLabel(option: ColorSchemeOption) {
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
        const { initialValue } = this.props

        return (
            <Select
                options={this.availableColorSchemes}
                formatOptionLabel={this.formatOptionLabel}
                onChange={this.onChange}
                defaultValue={this.availableColorSchemes.find(
                    scheme => scheme.value === initialValue
                )}
                styles={{
                    singleValue: provided => {
                        return {
                            ...provided,
                            width: "calc(100% - 10px)"
                        }
                    },
                    indicatorSeparator: provided => {
                        return {
                            ...provided,
                            visibility: "hidden"
                        }
                    }
                }}
            />
        )
    }
}
