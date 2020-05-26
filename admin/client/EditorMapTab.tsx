import * as React from "react"
import { clone, isEmpty, noop } from "charts/Util"
import { computed, action, IReactionDisposer, reaction } from "mobx"
import { observer } from "mobx-react"
import { ChartEditor } from "./ChartEditor"
import {
    NumericSelectField,
    NumberField,
    SelectField,
    TextField,
    Toggle,
    EditableList,
    EditableListItem,
    ColorBox,
    Section,
    FieldsRow,
    BindAutoFloat
} from "./Forms"
import { MapConfig } from "charts/MapConfig"
import { MapProjection } from "charts/MapProjection"
import { NumericBin, CategoricalBin } from "charts/ColorLegendBin"
import { Color } from "charts/Color"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ColorSchemeDropdown, ColorSchemeOption } from "./ColorSchemeDropdown"

@observer
class VariableSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onVariableId(variableId: number) {
        this.props.mapConfig.props.variableId = variableId
    }

    @action.bound onProjection(projection: string | undefined) {
        this.props.mapConfig.props.projection = projection as MapProjection
    }

    render() {
        const { mapConfig } = this.props
        const { filledDimensions } = mapConfig.chart.data

        if (isEmpty(filledDimensions))
            return (
                <section>
                    <h2>Add some variables on data tab first</h2>
                </section>
            )

        const projections = [
            "World",
            "Africa",
            "NorthAmerica",
            "SouthAmerica",
            "Asia",
            "Europe",
            "Oceania"
        ]
        const labels = [
            "World",
            "Africa",
            "North America",
            "South America",
            "Asia",
            "Europe",
            "Oceania"
        ]

        return (
            <Section name="Map">
                <NumericSelectField
                    label="Variable"
                    value={mapConfig.variableId as number}
                    options={filledDimensions.map(d => d.variableId)}
                    optionLabels={filledDimensions.map(d => d.displayName)}
                    onValue={this.onVariableId}
                />
                <SelectField
                    label="Region"
                    value={mapConfig.props.projection}
                    options={projections}
                    optionLabels={labels}
                    onValue={this.onProjection}
                />
            </Section>
        )
    }
}

@observer
class TimelineSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapConfig.props.hideTimeline = value || undefined
    }

    @action.bound onTargetYear(targetYear: number | undefined) {
        this.props.mapConfig.props.targetYear = targetYear
    }

    @action.bound onTolerance(tolerance: number | undefined) {
        this.props.mapConfig.props.timeTolerance = tolerance
    }

    render() {
        const { mapConfig } = this.props
        return (
            <Section name="Timeline">
                <NumberField
                    label="Target year"
                    value={mapConfig.props.targetYear}
                    onValue={this.onTargetYear}
                    allowNegative
                />
                <Toggle
                    label="Hide timeline"
                    value={!!mapConfig.props.hideTimeline}
                    onValue={this.onToggleHideTimeline}
                />
                <NumberField
                    label="Tolerance of data"
                    value={mapConfig.props.timeTolerance}
                    onValue={this.onTolerance}
                    helpText="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."
                />
            </Section>
        )
    }
}

@observer
class NumericBinView extends React.Component<{
    mapConfig: MapConfig
    bin: NumericBin
    index: number
}> {
    @action.bound onColor(color: Color | undefined) {
        const { mapConfig, index } = this.props

        if (!mapConfig.legend.isCustomColors) {
            // Creating a new custom color scheme
            mapConfig.props.legend.customCategoryColors = {}
            mapConfig.props.legend.customNumericColors = []
            mapConfig.props.legend.customColorsActive = true
        }

        while (
            mapConfig.props.legend.customNumericColors.length <
            mapConfig.legend.numBins
        )
            mapConfig.props.legend.customNumericColors.push(undefined)

        mapConfig.props.legend.customNumericColors[index] = color
    }

    @action.bound onMaximumValue(value: number | undefined) {
        const { mapConfig, index } = this.props
        if (value !== undefined)
            mapConfig.props.legend.colorSchemeValues[index] = value
    }

    @action.bound onLabel(value: string) {
        const { mapConfig, index } = this.props
        while (
            mapConfig.props.legend.colorSchemeLabels.length <
            mapConfig.legend.numBins
        )
            mapConfig.props.legend.colorSchemeLabels.push(undefined)
        mapConfig.props.legend.colorSchemeLabels[index] = value
    }

    @action.bound onRemove() {
        const { mapConfig, index } = this.props
        mapConfig.props.legend.colorSchemeValues.splice(index, 1)
        mapConfig.props.legend.customNumericColors.splice(index, 1)
    }

    @action.bound onAddAfter() {
        const { mapConfig, index } = this.props
        const {
            colorSchemeValues,
            customNumericColors
        } = mapConfig.props.legend
        const currentValue = colorSchemeValues[index]

        if (index === colorSchemeValues.length - 1)
            colorSchemeValues.push(
                currentValue + mapConfig.legend.binStepSizeDefault
            )
        else {
            const newValue = (currentValue + colorSchemeValues[index + 1]) / 2
            colorSchemeValues.splice(index + 1, 0, newValue)
            customNumericColors.splice(index + 1, 0, undefined)
        }
    }

    render() {
        const { mapConfig, bin } = this.props

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
                {mapConfig.legend.colorSchemeValues.length > 2 && (
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
    mapConfig: MapConfig
    bin: CategoricalBin
}> {
    @action.bound onColor(color: Color | undefined) {
        const { mapConfig, bin } = this.props
        if (!mapConfig.legend.isCustomColors) {
            // Creating a new custom color scheme
            mapConfig.props.legend.customCategoryColors = {}
            mapConfig.props.legend.customNumericColors = []
            mapConfig.props.legend.customColorsActive = true
        }

        const customCategoryColors = clone(
            mapConfig.props.legend.customCategoryColors
        )
        if (color === undefined) delete customCategoryColors[bin.value]
        else customCategoryColors[bin.value] = color
        mapConfig.props.legend.customCategoryColors = customCategoryColors
    }

    @action.bound onLabel(value: string) {
        const { mapConfig, bin } = this.props
        const customCategoryLabels = clone(
            mapConfig.props.legend.customCategoryLabels
        )
        customCategoryLabels[bin.value] = value
        mapConfig.props.legend.customCategoryLabels = customCategoryLabels
    }

    @action.bound onToggleHidden() {
        const { mapConfig, bin } = this.props

        const customHiddenCategories = clone(
            mapConfig.props.legend.customHiddenCategories
        )
        if (bin.isHidden) delete customHiddenCategories[bin.value]
        else customHiddenCategories[bin.value] = true
        mapConfig.props.legend.customHiddenCategories = customHiddenCategories
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

@observer
class ColorSchemeEditor extends React.Component<{ map: MapConfig }> {
    render() {
        const mapConfig = this.props.map
        const { dimension } = mapConfig.data
        if (!dimension) return null

        return (
            <div>
                <EditableList className="ColorSchemeEditor">
                    {mapConfig.data.legendData.map((bin, index) => {
                        if (bin instanceof NumericBin) {
                            return (
                                <NumericBinView
                                    key={index}
                                    mapConfig={mapConfig}
                                    bin={bin}
                                    index={index}
                                />
                            )
                        } else {
                            return (
                                <CategoricalBinView
                                    key={index}
                                    mapConfig={mapConfig}
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
class ColorsSection extends React.Component<{ mapConfig: MapConfig }> {
    disposers: IReactionDisposer[] = []

    componentDidMount() {
        const { mapConfig } = this.props
        this.disposers.push(
            // When the user disables automatic classification,
            // populate with automatic buckets.
            reaction(
                () => mapConfig.props.legend.isManualBuckets,
                () => {
                    const { colorSchemeValues } = mapConfig.legend
                    if (
                        mapConfig.props.legend.isManualBuckets &&
                        colorSchemeValues.length <= 1
                    ) {
                        const { autoBinMaximums } = mapConfig.legend
                        for (let i = 0; i < autoBinMaximums.length; i++) {
                            if (i >= colorSchemeValues.length) {
                                colorSchemeValues.push(autoBinMaximums[i])
                            }
                        }
                        mapConfig.props.legend.colorSchemeValues = colorSchemeValues
                    }
                }
            )
        )
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
    }

    @action.bound onColorScheme(selected: ColorSchemeOption) {
        const { mapConfig } = this.props

        if (selected.value === "custom") {
            mapConfig.props.legend.customColorsActive = true
        } else {
            mapConfig.props.legend.baseColorScheme = selected.value
            mapConfig.props.legend.customColorsActive = undefined
        }
    }

    @action.bound onInvert(invert: boolean) {
        this.props.mapConfig.props.legend.colorSchemeInvert =
            invert || undefined
    }

    @action.bound onAutomatic(isAutomatic: boolean) {
        this.props.mapConfig.props.legend.isManualBuckets = isAutomatic
            ? undefined
            : true
    }

    @computed get currentColorScheme() {
        const { mapConfig } = this.props

        return mapConfig.legend.isCustomColors
            ? "custom"
            : mapConfig.legend.baseColorScheme
    }

    render() {
        const { mapConfig } = this.props

        return (
            <Section name="Colors">
                <FieldsRow>
                    <div className="form-group">
                        <label>Color scheme</label>
                        <ColorSchemeDropdown
                            value={this.currentColorScheme}
                            onChange={this.onColorScheme}
                            invertedColorScheme={
                                !!mapConfig.props.legend.colorSchemeInvert
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
                        value={
                            mapConfig.props.legend.colorSchemeInvert || false
                        }
                        onValue={this.onInvert}
                    />
                    <Toggle
                        label="Automatic classification"
                        value={!mapConfig.props.legend.isManualBuckets}
                        onValue={this.onAutomatic}
                    />
                </FieldsRow>
                <BindAutoFloat
                    field="colorSchemeMinValue"
                    store={mapConfig.props.legend}
                    label="Minimum value"
                    auto={mapConfig.legend.autoMinBinValue}
                />
                {!mapConfig.props.legend.isManualBuckets && (
                    <BindAutoFloat
                        label="Step size"
                        field="binStepSize"
                        store={mapConfig.props.legend}
                        auto={mapConfig.legend.binStepSizeDefault}
                    />
                )}
                {mapConfig.props.legend.isManualBuckets && (
                    <ColorSchemeEditor map={mapConfig} />
                )}
            </Section>
        )
    }
}

@observer
class BinLabelView extends React.Component<{
    mapConfig: MapConfig
    bin: NumericBin | CategoricalBin
    index: number
}> {
    @action.bound onLabel(value: string) {
        if (this.props.bin instanceof NumericBin) {
            const { mapConfig, index } = this.props
            while (
                mapConfig.props.legend.colorSchemeLabels.length <
                mapConfig.legend.numBins
            )
                mapConfig.props.legend.colorSchemeLabels.push(undefined)
            mapConfig.props.legend.colorSchemeLabels[index] = value
        } else {
            const { mapConfig, bin } = this.props
            const customCategoryLabels = clone(
                mapConfig.props.legend.customCategoryLabels
            )
            customCategoryLabels[bin.value] = value
            mapConfig.props.legend.customCategoryLabels = customCategoryLabels
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
class ColorLegendSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onEqualSizeBins(isEqual: boolean) {
        this.props.mapConfig.props.legend.equalSizeBins = isEqual
            ? true
            : undefined
    }

    // NOTE this should be extracted out
    @action.bound onTooltipUseCustomLabels(tooltipUseCustomLabels: boolean) {
        this.props.mapConfig.props.tooltipUseCustomLabels = tooltipUseCustomLabels
            ? true
            : undefined
    }

    render() {
        const { mapConfig } = this.props
        return (
            <Section name="Legend">
                <Toggle
                    label="Disable visual scaling of legend bins"
                    value={!!mapConfig.props.legend.equalSizeBins}
                    onValue={this.onEqualSizeBins}
                />
                <Toggle
                    label={
                        "Show custom label in the tooltip, instead of the numeric value"
                    }
                    value={!!mapConfig.props.tooltipUseCustomLabels}
                    onValue={this.onTooltipUseCustomLabels}
                />
                {mapConfig.props.legend.isManualBuckets && (
                    <EditableList>
                        {mapConfig.data.legendData.map((bin, index) => (
                            <BinLabelView
                                key={index}
                                mapConfig={mapConfig}
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
export class EditorMapTab extends React.Component<{ editor: ChartEditor }> {
    @computed get chart() {
        return this.props.editor.chart
    }
    @computed get mapConfig() {
        return this.chart.map as MapConfig
    }

    render() {
        const { mapConfig } = this

        return (
            <div className="EditorMapTab tab-pane">
                <VariableSection mapConfig={mapConfig} />
                {mapConfig.data.isReady && (
                    <React.Fragment>
                        <TimelineSection mapConfig={mapConfig} />
                        <ColorsSection mapConfig={mapConfig} />
                        <ColorLegendSection mapConfig={mapConfig} />
                    </React.Fragment>
                )}
            </div>
        )
    }
}
