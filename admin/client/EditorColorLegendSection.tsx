import * as React from "react"
import { action, IReactionDisposer, reaction, computed } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"

import { ColorLegendTransform } from "charts/ColorLegendTransform"
import {
    ColorLegendBin,
    NumericBin,
    CategoricalBin
} from "charts/ColorLegendBin"
import { clone, noop } from "charts/Util"
import { Color } from "charts/Color"

import {
    Section,
    Toggle,
    EditableList,
    EditableListItem,
    FieldsRow,
    NumberField,
    TextField,
    ColorBox,
    BindAutoFloat
} from "./Forms"
import { ColorSchemeOption, ColorSchemeDropdown } from "./ColorSchemeDropdown"

@observer
export class EditorColorLegendSection extends React.Component<{
    legend: ColorLegendTransform
}> {
    render() {
        return (
            <React.Fragment>
                <ColorsSection legend={this.props.legend} />
                <ColorLegendSection legend={this.props.legend} />
            </React.Fragment>
        )
    }
}

@observer
class ColorLegendSection extends React.Component<{
    legend: ColorLegendTransform
}> {
    @action.bound onEqualSizeBins(isEqual: boolean) {
        this.props.legend.config.equalSizeBins = isEqual ? true : undefined
    }

    render() {
        const { legend } = this.props
        return (
            <Section name="Legend">
                <Toggle
                    label="Disable visual scaling of legend bins"
                    value={!!legend.config.equalSizeBins}
                    onValue={this.onEqualSizeBins}
                />
                {legend.config.isManualBuckets && (
                    <EditableList>
                        {legend.legendData.map((bin, index) => (
                            <BinLabelView
                                key={index}
                                legend={legend}
                                bin={bin}
                                index={index}
                            />
                        ))}
                    </EditableList>
                )}
            </Section>
        )
    }
}

@observer
class ColorsSection extends React.Component<{
    legend: ColorLegendTransform
}> {
    disposers: IReactionDisposer[] = []

    componentDidMount() {
        const { legend } = this.props
        this.disposers.push(
            // When the user disables automatic classification,
            // populate with automatic buckets.
            reaction(
                () => legend.config.isManualBuckets,
                () => {
                    const { colorSchemeValues } = legend
                    if (
                        legend.config.isManualBuckets &&
                        colorSchemeValues.length <= 1
                    ) {
                        const { autoBinMaximums } = legend
                        for (let i = 0; i < autoBinMaximums.length; i++) {
                            if (i >= colorSchemeValues.length) {
                                colorSchemeValues.push(autoBinMaximums[i])
                            }
                        }
                        legend.config.colorSchemeValues = colorSchemeValues
                    }
                }
            )
        )
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
    }

    @action.bound onColorScheme(selected: ColorSchemeOption) {
        const { legend } = this.props

        if (selected.value === "custom") {
            legend.config.customColorsActive = true
        } else {
            legend.config.baseColorScheme = selected.value
            legend.config.customColorsActive = undefined
        }
    }

    @action.bound onInvert(invert: boolean) {
        this.props.legend.config.colorSchemeInvert = invert || undefined
    }

    @action.bound onAutomatic(isAutomatic: boolean) {
        this.props.legend.config.isManualBuckets = isAutomatic
            ? undefined
            : true
    }

    @computed get currentColorScheme() {
        const { legend } = this.props

        return legend.isCustomColors ? "custom" : legend.baseColorScheme
    }

    render() {
        const { legend } = this.props

        return (
            <Section name="Colors">
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={this.currentColorScheme}
                            onChange={this.onColorScheme}
                            invertedColorScheme={
                                !!legend.config.colorSchemeInvert
                            }
                            additionalOptions={[
                                {
                                    colorScheme: undefined,
                                    gradient: undefined,
                                    label: "Custom",
                                    value: "custom"
                                }
                            ]}
                        />
                    </div>
                </FieldsRow>
                <FieldsRow>
                    <Toggle
                        label="Invert colors"
                        value={legend.config.colorSchemeInvert || false}
                        onValue={this.onInvert}
                    />
                    <Toggle
                        label="Automatic classification"
                        value={!legend.config.isManualBuckets}
                        onValue={this.onAutomatic}
                    />
                </FieldsRow>
                <BindAutoFloat
                    field="colorSchemeMinValue"
                    store={legend.config}
                    label="Minimum value"
                    auto={legend.autoMinBinValue}
                />
                {!legend.config.isManualBuckets && (
                    <BindAutoFloat
                        label="Step size"
                        field="binStepSize"
                        store={legend.config}
                        auto={legend.binStepSizeDefault}
                    />
                )}
                {legend.config.isManualBuckets && (
                    <ColorSchemeEditor legend={legend} />
                )}
            </Section>
        )
    }
}

@observer
export class ColorSchemeEditor extends React.Component<{
    legend: ColorLegendTransform
}> {
    render() {
        const { legend } = this.props
        return (
            <div>
                <EditableList className="ColorSchemeEditor">
                    {legend.legendData.map((bin, index) => {
                        if (bin instanceof NumericBin) {
                            return (
                                <NumericBinView
                                    key={index}
                                    legend={legend}
                                    bin={bin}
                                    index={index}
                                />
                            )
                        } else {
                            return (
                                <CategoricalBinView
                                    key={index}
                                    legend={legend}
                                    bin={bin}
                                />
                            )
                        }
                    })}
                </EditableList>
            </div>
        )
    }
}

@observer
class BinLabelView extends React.Component<{
    legend: ColorLegendTransform
    bin: ColorLegendBin
    index: number
}> {
    @action.bound onLabel(value: string) {
        if (this.props.bin instanceof NumericBin) {
            const { legend, index } = this.props
            while (legend.config.colorSchemeLabels.length < legend.numBins)
                legend.config.colorSchemeLabels.push(undefined)
            legend.config.colorSchemeLabels[index] = value
        } else {
            const { legend, bin } = this.props
            const customCategoryLabels = clone(
                legend.config.customCategoryLabels
            )
            customCategoryLabels[bin.value] = value
            legend.config.customCategoryLabels = customCategoryLabels
        }
    }

    render() {
        const { bin } = this.props

        return (
            <EditableListItem className="BinLabelView">
                <FieldsRow>
                    {bin instanceof NumericBin ? (
                        <NumberField
                            value={bin.max}
                            onValue={() => null}
                            allowDecimal
                            allowNegative
                            disabled
                        />
                    ) : (
                        <TextField
                            value={bin.value}
                            onValue={() => null}
                            disabled
                        />
                    )}
                    <TextField
                        placeholder="Custom label"
                        value={bin.label}
                        onValue={this.onLabel}
                    />
                </FieldsRow>
            </EditableListItem>
        )
    }
}

@observer
class NumericBinView extends React.Component<{
    legend: ColorLegendTransform
    bin: NumericBin
    index: number
}> {
    @action.bound onColor(color: Color | undefined) {
        const { legend, index } = this.props

        if (!legend.isCustomColors) {
            // Creating a new custom color scheme
            legend.config.customCategoryColors = {}
            legend.config.customNumericColors = []
            legend.config.customColorsActive = true
        }

        while (legend.config.customNumericColors.length < legend.numBins)
            legend.config.customNumericColors.push(undefined)

        legend.config.customNumericColors[index] = color
    }

    @action.bound onMaximumValue(value: number | undefined) {
        const { legend, index } = this.props
        if (value !== undefined) legend.config.colorSchemeValues[index] = value
    }

    @action.bound onLabel(value: string) {
        const { legend, index } = this.props
        while (legend.config.colorSchemeLabels.length < legend.numBins)
            legend.config.colorSchemeLabels.push(undefined)
        legend.config.colorSchemeLabels[index] = value
    }

    @action.bound onRemove() {
        const { legend, index } = this.props
        legend.config.colorSchemeValues.splice(index, 1)
        legend.config.customNumericColors.splice(index, 1)
    }

    @action.bound onAddAfter() {
        const { legend, index } = this.props
        const { colorSchemeValues, customNumericColors } = legend.config
        const currentValue = colorSchemeValues[index]

        if (index === colorSchemeValues.length - 1)
            colorSchemeValues.push(currentValue + legend.binStepSizeDefault)
        else {
            const newValue = (currentValue + colorSchemeValues[index + 1]) / 2
            colorSchemeValues.splice(index + 1, 0, newValue)
            customNumericColors.splice(index + 1, 0, undefined)
        }
    }

    render() {
        const { legend, bin } = this.props

        return (
            <EditableListItem className="numeric">
                <div className="clickable" onClick={this.onAddAfter}>
                    <FontAwesomeIcon icon={faPlus} />
                </div>
                <ColorBox color={bin.color} onColor={this.onColor} />
                <div className="range">
                    <span>
                        {bin.props.isOpenLeft
                            ? "≤"
                            : bin.props.isFirst
                            ? "≥"
                            : ">"}
                        {bin.min} ⁠–⁠ {"≤"}
                    </span>
                    <NumberField
                        value={bin.max}
                        onValue={this.onMaximumValue}
                        allowNegative
                        allowDecimal
                    />
                    {bin.props.isOpenRight && <span>and above</span>}
                </div>
                {legend.colorSchemeValues.length > 2 && (
                    <div className="clickable" onClick={this.onRemove}>
                        <FontAwesomeIcon icon={faMinus} />
                    </div>
                )}
            </EditableListItem>
        )
    }
}

@observer
class CategoricalBinView extends React.Component<{
    legend: ColorLegendTransform
    bin: CategoricalBin
}> {
    @action.bound onColor(color: Color | undefined) {
        const { legend, bin } = this.props
        if (!legend.isCustomColors) {
            // Creating a new custom color scheme
            legend.config.customCategoryColors = {}
            legend.config.customNumericColors = []
            legend.config.customColorsActive = true
        }

        const customCategoryColors = clone(legend.config.customCategoryColors)
        if (color === undefined) delete customCategoryColors[bin.value]
        else customCategoryColors[bin.value] = color
        legend.config.customCategoryColors = customCategoryColors
    }

    @action.bound onLabel(value: string) {
        const { legend, bin } = this.props
        const customCategoryLabels = clone(legend.config.customCategoryLabels)
        customCategoryLabels[bin.value] = value
        legend.config.customCategoryLabels = customCategoryLabels
    }

    @action.bound onToggleHidden() {
        const { legend, bin } = this.props

        const customHiddenCategories = clone(
            legend.config.customHiddenCategories
        )
        if (bin.isHidden) delete customHiddenCategories[bin.value]
        else customHiddenCategories[bin.value] = true
        legend.config.customHiddenCategories = customHiddenCategories
    }

    render() {
        const { bin } = this.props

        return (
            <EditableListItem className="categorical">
                <ColorBox color={bin.color} onColor={this.onColor} />
                <TextField value={bin.value} disabled={true} onValue={noop} />
                <Toggle
                    label="Hide"
                    value={bin.isHidden}
                    onValue={this.onToggleHidden}
                />
            </EditableListItem>
        )
    }
}
