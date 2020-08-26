import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"

import { isEmpty } from "charts/utils/Util"
import { MapConfig } from "charts/mapCharts/MapConfig"
import { MapProjection } from "charts/mapCharts/MapProjections"

import { ChartEditor } from "./ChartEditor"
import {
    NumericSelectField,
    NumberField,
    SelectField,
    Toggle,
    Section
} from "./Forms"
import { EditorColorScaleSection } from "./EditorColorScaleSection"
import { owidVariableId } from "owidTable/OwidTable"

@observer
class VariableSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onVariableId(variableId: owidVariableId) {
        this.props.mapConfig.props.variableId = variableId
    }

    @action.bound onProjection(projection: string | undefined) {
        this.props.mapConfig.props.projection = projection as MapProjection
    }

    render() {
        const { mapConfig } = this.props
        const { filledDimensions } = mapConfig.chart

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
class TooltipSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onTooltipUseCustomLabels(tooltipUseCustomLabels: boolean) {
        this.props.mapConfig.props.tooltipUseCustomLabels = tooltipUseCustomLabels
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
                    value={!!mapConfig.props.tooltipUseCustomLabels}
                    onValue={this.onTooltipUseCustomLabels}
                />
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
                        <EditorColorScaleSection
                            scale={mapConfig.data.colorScale}
                            features={{
                                visualScaling: true,
                                legendDescription: false
                            }}
                        />
                        <TooltipSection mapConfig={mapConfig} />
                    </React.Fragment>
                )}
            </div>
        )
    }
}
