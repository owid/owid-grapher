import React from "react"
import { action, computed, runInAction } from "mobx"
import { observer } from "mobx-react"
import Select from "react-select"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { ColorScale } from "@ourworldindata/grapher"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "@ourworldindata/grapher"
import { clone, noop, last } from "@ourworldindata/utils"
import { Color } from "@ourworldindata/core-table"
import {
    Section,
    Toggle,
    EditableList,
    EditableListItem,
    FieldsRow,
    NumberField,
    TextField,
    ColorBox,
    BindAutoFloat,
    BindString,
} from "./Forms.js"
import {
    ColorSchemeOption,
    ColorSchemeDropdown,
} from "./ColorSchemeDropdown.js"
import { binningStrategyLabels } from "@ourworldindata/grapher"
import { ColorSchemeName } from "@ourworldindata/grapher"
import { BinningStrategy } from "@ourworldindata/grapher"
import { ChartTypeName } from "@ourworldindata/grapher"

interface EditorColorScaleSectionFeatures {
    visualScaling: boolean
    legendDescription: boolean
}

@observer
export class EditorColorScaleSection extends React.Component<{
    scale: ColorScale
    chartType: ChartTypeName
    features: EditorColorScaleSectionFeatures
    showLineChartColors: boolean
    onChange?: () => void
}> {
    render() {
        return (
            <React.Fragment>
                <ColorsSection
                    scale={this.props.scale}
                    onChange={this.props.onChange}
                    chartType={this.props.chartType}
                    showLineChartColors={this.props.showLineChartColors}
                />
                <ColorLegendSection
                    scale={this.props.scale}
                    features={this.props.features}
                    onChange={this.props.onChange}
                />
            </React.Fragment>
        )
    }
}

@observer
class ColorLegendSection extends React.Component<{
    scale: ColorScale
    features: EditorColorScaleSectionFeatures
    onChange?: () => void
}> {
    @action.bound onEqualSizeBins(isEqual: boolean) {
        this.props.scale.config.equalSizeBins = isEqual
        this.props.onChange?.()
    }

    @action.bound onManualBins() {
        populateManualBinValuesIfAutomatic(this.props.scale)
        this.props.onChange?.()
    }

    render() {
        const { scale, features } = this.props
        return (
            <Section name="Color legend">
                {features.visualScaling && (
                    <FieldsRow>
                        <Toggle
                            label="Disable visual scaling of legend bins"
                            value={!!scale.config.equalSizeBins}
                            onValue={this.onEqualSizeBins}
                        />
                    </FieldsRow>
                )}
                {features.legendDescription && (
                    <FieldsRow>
                        <BindString
                            label="Legend title"
                            field="legendDescription"
                            store={scale.config}
                        />
                    </FieldsRow>
                )}
                {scale.isManualBuckets ? (
                    <EditableList>
                        {scale.legendBins.map((bin, index) => (
                            <BinLabelView
                                key={index}
                                scale={scale}
                                bin={bin}
                                index={index}
                            />
                        ))}
                    </EditableList>
                ) : (
                    <button
                        className="btn btn-primary"
                        onClick={this.onManualBins}
                    >
                        Assign custom labels
                    </button>
                )}
            </Section>
        )
    }
}

@observer
class ColorsSection extends React.Component<{
    scale: ColorScale
    chartType: ChartTypeName
    showLineChartColors: boolean
    onChange?: () => void
}> {
    @action.bound onColorScheme(selected: ColorSchemeOption) {
        const { config } = this

        if (selected.value === "custom") config.customNumericColorsActive = true
        else {
            config.baseColorScheme = selected.value as ColorSchemeName
            config.customNumericColorsActive = undefined
        }
        this.props.onChange?.()
    }

    @action.bound onInvert(invert: boolean) {
        this.config.colorSchemeInvert = invert || undefined
        this.props.onChange?.()
    }

    @computed get scale() {
        return this.props.scale
    }

    @computed get config() {
        return this.scale.config
    }

    @action.bound onBinningStrategy(
        binningStrategy: {
            label: string
            value: BinningStrategy
        } | null
    ) {
        if (binningStrategy) this.config.binningStrategy = binningStrategy.value
        this.props.onChange?.()
    }

    @computed get currentColorScheme() {
        const { scale } = this
        return scale.customNumericColorsActive
            ? "custom"
            : scale.baseColorScheme
    }

    @computed get binningStrategyOptions() {
        const options = Object.entries(binningStrategyLabels).map(
            ([value, label]) => ({
                label: label,
                value: value as BinningStrategy,
            })
        )
        // Remove the manual binning strategy from the options if
        // no custom bin values are specified in the config.
        // Authors can still get into manual mode by selecting an
        // automatic binning strategy and editing the bins.
        if (!this.config.customNumericValues.length) {
            return options.filter(
                ({ value }) => value !== BinningStrategy.manual
            )
        }
        return options
    }

    @computed get currentBinningStrategyOption() {
        return this.binningStrategyOptions.find(
            (option) => option.value === this.config.binningStrategy
        )
    }

    render() {
        const { scale, config } = this

        return (
            <Section name="Color scale">
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={this.currentColorScheme}
                            onChange={this.onColorScheme}
                            invertedColorScheme={!!config.colorSchemeInvert}
                            chartType={this.props.chartType}
                            additionalOptions={[
                                {
                                    colorScheme: undefined,
                                    gradient: undefined,
                                    label: "Custom",
                                    value: "custom",
                                },
                            ]}
                        />
                    </div>
                </FieldsRow>
                <FieldsRow>
                    <Toggle
                        label="Invert colors"
                        value={config.colorSchemeInvert || false}
                        onValue={this.onInvert}
                    />
                </FieldsRow>
                <FieldsRow>
                    <div className="form-group">
                        <label>Binning strategy</label>
                        <Select
                            options={this.binningStrategyOptions}
                            onChange={this.onBinningStrategy}
                            value={this.currentBinningStrategyOption}
                            components={{
                                IndicatorSeparator: null,
                            }}
                            menuPlacement="auto"
                            isSearchable={false}
                        />
                    </div>
                </FieldsRow>
                <FieldsRow>
                    <BindAutoFloat
                        field="customNumericMinValue"
                        store={config}
                        label="Minimum value"
                        auto={scale.autoMinBinValue}
                    />
                    {!scale.isManualBuckets && (
                        <BindAutoFloat
                            field="binningStrategyBinCount"
                            store={config}
                            label="Target number of bins"
                            auto={scale.numAutoBins}
                        />
                    )}
                </FieldsRow>
                <ColorSchemeEditor
                    scale={scale}
                    onChange={this.props.onChange}
                    showLineChartColors={this.props.showLineChartColors}
                />
            </Section>
        )
    }
}

@observer
class ColorSchemeEditor extends React.Component<{
    scale: ColorScale
    showLineChartColors: boolean
    onChange?: () => void
}> {
    render() {
        const { scale } = this.props
        return (
            <div>
                <EditableList className="ColorSchemeEditor">
                    {scale.legendBins.map((bin, index) => {
                        if (bin instanceof NumericBin)
                            return (
                                <NumericBinView
                                    key={index}
                                    scale={scale}
                                    bin={bin}
                                    index={index}
                                    showLineChartColors={
                                        this.props.showLineChartColors
                                    }
                                    onChange={this.props.onChange}
                                />
                            )

                        return (
                            <CategoricalBinView
                                key={index}
                                scale={scale}
                                bin={bin}
                                showLineChartColors={
                                    this.props.showLineChartColors
                                }
                                onChange={this.props.onChange}
                            />
                        )
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
    onChange?: () => void
}> {
    @action.bound onLabel(value: string) {
        if (this.props.bin instanceof NumericBin) {
            const { scale, index } = this.props
            while (scale.config.customNumericLabels.length < scale.numBins)
                scale.config.customNumericLabels.push(undefined)
            scale.config.customNumericLabels[index] = value
        } else {
            const { scale, bin } = this.props
            const customCategoryLabels = clone(
                scale.config.customCategoryLabels
            )
            customCategoryLabels[bin.value] = value
            scale.config.customCategoryLabels = customCategoryLabels
        }
        this.props.onChange?.()
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

function populateManualBinValuesIfAutomatic(scale: ColorScale) {
    runInAction(() => {
        if (scale.config.binningStrategy !== BinningStrategy.manual) {
            scale.config.customNumericValues = scale.autoBinMaximums
            scale.config.customNumericLabels = []
            scale.config.binningStrategy = BinningStrategy.manual
        }
    })
}

@observer
class NumericBinView extends React.Component<{
    scale: ColorScale
    bin: NumericBin
    index: number
    showLineChartColors: boolean
    onChange?: () => void
}> {
    @action.bound onColor(color: Color | undefined) {
        const { scale, index } = this.props

        if (!scale.customNumericColorsActive) {
            // Creating a new custom color scheme
            scale.config.customCategoryColors = {}
            scale.config.customNumericColors = []
            scale.config.customNumericColorsActive = true
        }

        while (scale.config.customNumericColors.length < scale.numBins)
            scale.config.customNumericColors.push(undefined)

        scale.config.customNumericColors[index] = color
        this.props.onChange?.()
    }

    @action.bound onMaximumValue(value: number | undefined) {
        const { scale, index } = this.props
        populateManualBinValuesIfAutomatic(scale)
        if (value !== undefined) scale.config.customNumericValues[index] = value
        this.props.onChange?.()
    }

    @action.bound onLabel(value: string) {
        const { scale, index } = this.props
        while (scale.config.customNumericLabels.length < scale.numBins)
            scale.config.customNumericLabels.push(undefined)
        scale.config.customNumericLabels[index] = value
        this.props.onChange?.()
    }

    @action.bound onRemove() {
        const { scale, index } = this.props
        populateManualBinValuesIfAutomatic(scale)
        scale.config.customNumericValues.splice(index, 1)
        scale.config.customNumericColors.splice(index, 1)
        this.props.onChange?.()
    }

    @action.bound onAddAfter() {
        const { scale, index } = this.props
        const { customNumericValues, customNumericColors } = scale.config
        const currentValue = customNumericValues[index]

        populateManualBinValuesIfAutomatic(scale)

        if (index === customNumericValues.length - 1)
            customNumericValues.push(
                last(scale.sortedNumericValues) ?? currentValue
            )
        else {
            const newValue = (currentValue + customNumericValues[index + 1]) / 2
            customNumericValues.splice(index + 1, 0, newValue)
            customNumericColors.splice(index + 1, 0, undefined)
        }
        this.props.onChange?.()
    }

    render() {
        const { scale, bin } = this.props

        return (
            <EditableListItem className="numeric">
                <div className="clickable" onClick={this.onAddAfter}>
                    <FontAwesomeIcon icon={faPlus} />
                </div>
                <ColorBox
                    color={bin.color}
                    onColor={this.onColor}
                    showLineChartColors={this.props.showLineChartColors}
                />
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
                {scale.customNumericValues.length > 2 && (
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
    showLineChartColors: boolean
    onChange?: () => void
}> {
    @action.bound onColor(color: Color | undefined) {
        const { scale, bin } = this.props
        if (!scale.customNumericColorsActive) {
            // Creating a new custom color scheme
            scale.config.customCategoryColors = {}
            scale.config.customNumericColors = []
            scale.config.customNumericColorsActive = true
        }

        const customCategoryColors = clone(scale.config.customCategoryColors)
        if (color === undefined) delete customCategoryColors[bin.value]
        else customCategoryColors[bin.value] = color
        scale.config.customCategoryColors = customCategoryColors
        this.props.onChange?.()
    }

    @action.bound onLabel(value: string) {
        const { scale, bin } = this.props
        const customCategoryLabels = clone(scale.config.customCategoryLabels)
        customCategoryLabels[bin.value] = value
        scale.config.customCategoryLabels = customCategoryLabels
        this.props.onChange?.()
    }

    @action.bound onToggleHidden() {
        const { scale, bin } = this.props

        const customHiddenCategories = clone(
            scale.config.customHiddenCategories
        )
        if (bin.isHidden) delete customHiddenCategories[bin.value]
        else customHiddenCategories[bin.value] = true
        scale.config.customHiddenCategories = customHiddenCategories
        this.props.onChange?.()
    }

    render() {
        const { bin } = this.props

        return (
            <EditableListItem className="categorical">
                <ColorBox
                    color={bin.color}
                    onColor={this.onColor}
                    showLineChartColors={this.props.showLineChartColors}
                />
                <TextField value={bin.value} disabled={true} onValue={noop} />
                <Toggle
                    label="Hide"
                    value={!!bin.isHidden}
                    onValue={this.onToggleHidden}
                />
            </EditableListItem>
        )
    }
}
