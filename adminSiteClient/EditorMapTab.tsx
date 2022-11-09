import {
    ChartDimension,
    ChartTypeName,
    MapChart,
    MapConfig,
    MapProjectionLabels,
    MapProjectionName,
} from "@ourworldindata/grapher"
import { isEmpty, OwidVariableId } from "@ourworldindata/utils"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import {
    NumberField,
    NumericSelectField,
    Section,
    SelectField,
    Toggle,
} from "./Forms.js"

@observer
class VariableSection extends React.Component<{
    mapConfig: MapConfig
    filledDimensions: ChartDimension[]
}> {
    @action.bound onVariableId(variableId: OwidVariableId) {
        this.props.mapConfig.columnSlug = variableId.toString()
    }

    @action.bound onProjection(projection: string | undefined) {
        this.props.mapConfig.projection = projection as MapProjectionName
    }

    render() {
        const { mapConfig, filledDimensions } = this.props

        if (isEmpty(filledDimensions))
            return (
                <section>
                    <h2>Add some variables on data tab first</h2>
                </section>
            )

        // const projections = Object.keys(MapProjectionLabels)
        // const labels = Object.values(MapProjectionLabels)

        return (
            <Section name="Map">
                <NumericSelectField
                    label="Variable"
                    value={
                        mapConfig.columnSlug
                            ? parseInt(mapConfig.columnSlug)
                            : undefined
                    }
                    options={filledDimensions.map((d) => ({
                        value: d.variableId,
                        label: d.column.displayName,
                    }))}
                    onValue={this.onVariableId}
                />
                <SelectField
                    label="Region"
                    value={mapConfig.projection}
                    options={Object.entries(MapProjectionLabels).map(
                        ([key, val]) => ({ value: key, label: val })
                    )}
                    onValue={this.onProjection}
                />
            </Section>
        )
    }
}

@observer
class TimelineSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapConfig.hideTimeline = value || undefined
    }

    @action.bound setMapTime(time: number | undefined) {
        this.props.mapConfig.time = time
    }

    @action.bound onTolerance(tolerance: number | undefined) {
        this.props.mapConfig.timeTolerance = tolerance
    }

    render() {
        const { mapConfig } = this.props
        return (
            <Section name="Timeline">
                <NumberField
                    label="Target year"
                    value={mapConfig.time}
                    onValue={this.setMapTime}
                    allowNegative
                />
                <Toggle
                    label="Hide timeline"
                    value={!!mapConfig.hideTimeline}
                    onValue={this.onToggleHideTimeline}
                />
                <NumberField
                    label="Tolerance of data"
                    value={mapConfig.timeTolerance}
                    onValue={this.onTolerance}
                    helpText="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."
                />
            </Section>
        )
    }
}

@observer
class TooltipSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onTooltipUseCustomLabels(tooltipUseCustomLabels: boolean) {
        this.props.mapConfig.tooltipUseCustomLabels = tooltipUseCustomLabels
            ? true
            : undefined
    }

    render() {
        const { mapConfig } = this.props
        return (
            <Section name="Tooltip">
                <Toggle
                    label={
                        "Show custom label in the tooltip, instead of the numeric value"
                    }
                    value={!!mapConfig.tooltipUseCustomLabels}
                    onValue={this.onTooltipUseCustomLabels}
                />
            </Section>
        )
    }
}

@observer
export class EditorMapTab extends React.Component<{ editor: ChartEditor }> {
    @computed get grapher() {
        return this.props.editor.grapher
    }

    render() {
        const { grapher } = this
        const mapConfig = grapher.map
        const { mapColumnSlug } = grapher
        const mapChart = new MapChart({ manager: this.grapher })
        const colorScale = mapChart.colorScale

        const isReady = !!mapColumnSlug && grapher.table.has(mapColumnSlug)

        return (
            <div className="EditorMapTab tab-pane">
                <VariableSection
                    mapConfig={mapConfig}
                    filledDimensions={grapher.filledDimensions}
                />
                {isReady && (
                    <React.Fragment>
                        <TimelineSection mapConfig={mapConfig} />
                        <EditorColorScaleSection
                            scale={colorScale}
                            chartType={ChartTypeName.WorldMap}
                            showLineChartColors={false}
                            features={{
                                visualScaling: true,
                                legendDescription: false,
                            }}
                        />
                        <TooltipSection mapConfig={mapConfig} />
                    </React.Fragment>
                )}
            </div>
        )
    }
}
