import * as React from "react"
import { action, IReactionDisposer, reaction, computed } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"

import { ColorScale } from "charts/ColorScale"
import { ColorScaleBin, NumericBin, CategoricalBin } from "charts/ColorScaleBin"
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
export class EditorColorScaleSection extends React.Component<{
    scale: ColorScale
}> {
    render() {
        return (
            <React.Fragment>
                <ColorsSection scale={this.props.scale} />
                <ColorLegendSection scale={this.props.scale} />
            </React.Fragment>
        )
    }
}

@observer
class ColorLegendSection extends React.Component<{
    scale: ColorScale
}> {
    @action.bound onEqualSizeBins(isEqual: boolean) {
        this.props.scale.config.equalSizeBins = isEqual ? true : undefined
    }

    render() {
        const { scale } = this.props
        return (
            <Section name="Legend">
                <Toggle
                    label="Disable visual scaling of legend bins"
                    value={!!scale.config.equalSizeBins}
                    onValue={this.onEqualSizeBins}
                />
                {scale.config.isManualBuckets && (
                    <EditableList>
                        {scale.legendData.map((bin, index) => (
                            <BinLabelView
                                key={index}
                                scale={scale}
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
    scale: ColorScale
}> {
    disposers: IReactionDisposer[] = []

    componentDidMount() {
        const { scale } = this.props
        this.disposers.push(
            // When the user disables automatic classification,
            // populate with automatic buckets.
            reaction(
                () => scale.config.isManualBuckets,
                () => {
                    const { colorSchemeValues } = scale
                    if (
                        scale.config.isManualBuckets &&
                        colorSchemeValues.length <= 1
                    ) {
                        const { autoBinMaximums } = scale
                        for (let i = 0; i < autoBinMaximums.length; i++) {
                            if (i >= colorSchemeValues.length) {
                                colorSchemeValues.push(autoBinMaximums[i])
                            }
                        }
                        scale.config.colorSchemeValues = colorSchemeValues
                    }
                }
            )
        )
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
    }

    @action.bound onColorScheme(selected: ColorSchemeOption) {
        const { scale } = this.props

        if (selected.value === "custom") {
            scale.config.customColorsActive = true
        } else {
            scale.config.baseColorScheme = selected.value
            scale.config.customColorsActive = undefined
        }
    }

    @action.bound onInvert(invert: boolean) {
        this.props.scale.config.colorSchemeInvert = invert || undefined
    }

    @action.bound onAutomatic(isAutomatic: boolean) {
        this.props.scale.config.isManualBuckets = isAutomatic ? undefined : true
    }

    @computed get currentColorScheme() {
        const { scale } = this.props
        return scale.isCustomColors ? "custom" : scale.baseColorScheme
    }

    render() {
        const { scale } = this.props

        return (
            <Section name="Colors">
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={this.currentColorScheme}
                            onChange={this.onColorScheme}
                            invertedColorScheme={
                                !!scale.config.colorSchemeInvert
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
                        value={scale.config.colorSchemeInvert || false}
                        onValue={this.onInvert}
                    />
                    <Toggle
                        label="Automatic classification"
                        value={!scale.config.isManualBuckets}
                        onValue={this.onAutomatic}
                    />
                </FieldsRow>
                <BindAutoFloat
                    field="colorSchemeMinValue"
                    store={scale.config}
                    label="Minimum value"
                    auto={scale.autoMinBinValue}
                />
                {!scale.config.isManualBuckets && (
                    <BindAutoFloat
                        label="Step size"
                        field="binStepSize"
                        store={scale.config}
                        auto={scale.binStepSizeDefault}
                    />
                )}
                {scale.config.isManualBuckets && (
                    <ColorSchemeEditor scale={scale} />
                )}
            </Section>
        )
    }
}

@observer
export class ColorSchemeEditor extends React.Component<{
    scale: ColorScale
}> {
    render() {
        const { scale } = this.props
        return (
            <div>
                <EditableList className="ColorSchemeEditor">
                    {scale.legendData.map((bin, index) => {
                        if (bin instanceof NumericBin) {
                            return (
                                <NumericBinView
                                    key={index}
                                    scale={scale}
                                    bin={bin}
                                    index={index}
                                />
                            )
                        } else {
                            return (
                                <CategoricalBinView
                                    key={index}
                                    scale={scale}
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
    scale: ColorScale
    bin: ColorScaleBin
    index: number
}> {
    @action.bound onLabel(value: string) {
        if (this.props.bin instanceof NumericBin) {
            const { scale, index } = this.props
            while (scale.config.colorSchemeLabels.length < scale.numBins)
                scale.config.colorSchemeLabels.push(undefined)
            scale.config.colorSchemeLabels[index] = value
        } else {
            const { scale, bin } = this.props
            const customCategoryLabels = clone(
                scale.config.customCategoryLabels
            )
            customCategoryLabels[bin.value] = value
            scale.config.customCategoryLabels = customCategoryLabels
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
    scale: ColorScale
    bin: NumericBin
    index: number
}> {
    @action.bound onColor(color: Color | undefined) {
        const { scale, index } = this.props

        if (!scale.isCustomColors) {
            // Creating a new custom color scheme
            scale.config.customCategoryColors = {}
            scale.config.customNumericColors = []
            scale.config.customColorsActive = true
        }

        while (scale.config.customNumericColors.length < scale.numBins)
            scale.config.customNumericColors.push(undefined)

        scale.config.customNumericColors[index] = color
    }

    @action.bound onMaximumValue(value: number | undefined) {
        const { scale, index } = this.props
        if (value !== undefined) scale.config.colorSchemeValues[index] = value
    }

    @action.bound onLabel(value: string) {
        const { scale, index } = this.props
        while (scale.config.colorSchemeLabels.length < scale.numBins)
            scale.config.colorSchemeLabels.push(undefined)
        scale.config.colorSchemeLabels[index] = value
    }

    @action.bound onRemove() {
        const { scale, index } = this.props
        scale.config.colorSchemeValues.splice(index, 1)
        scale.config.customNumericColors.splice(index, 1)
    }

    @action.bound onAddAfter() {
        const { scale, index } = this.props
        const { colorSchemeValues, customNumericColors } = scale.config
        const currentValue = colorSchemeValues[index]

        if (index === colorSchemeValues.length - 1)
            colorSchemeValues.push(currentValue + scale.binStepSizeDefault)
        else {
            const newValue = (currentValue + colorSchemeValues[index + 1]) / 2
            colorSchemeValues.splice(index + 1, 0, newValue)
            customNumericColors.splice(index + 1, 0, undefined)
        }
    }

    render() {
        const { scale, bin } = this.props

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
                {scale.colorSchemeValues.length > 2 && (
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
    scale: ColorScale
    bin: CategoricalBin
}> {
    @action.bound onColor(color: Color | undefined) {
        const { scale, bin } = this.props
        if (!scale.isCustomColors) {
            // Creating a new custom color scheme
            scale.config.customCategoryColors = {}
            scale.config.customNumericColors = []
            scale.config.customColorsActive = true
        }

        const customCategoryColors = clone(scale.config.customCategoryColors)
        if (color === undefined) delete customCategoryColors[bin.value]
        else customCategoryColors[bin.value] = color
        scale.config.customCategoryColors = customCategoryColors
    }

    @action.bound onLabel(value: string) {
        const { scale, bin } = this.props
        const customCategoryLabels = clone(scale.config.customCategoryLabels)
        customCategoryLabels[bin.value] = value
        scale.config.customCategoryLabels = customCategoryLabels
    }

    @action.bound onToggleHidden() {
        const { scale, bin } = this.props

        const customHiddenCategories = clone(
            scale.config.customHiddenCategories
        )
        if (bin.isHidden) delete customHiddenCategories[bin.value]
        else customHiddenCategories[bin.value] = true
        scale.config.customHiddenCategories = customHiddenCategories
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
