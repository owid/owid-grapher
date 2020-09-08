import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"

import { isEmpty } from "grapher/utils/Util"
import { MapTransform } from "grapher/mapCharts/MapTransform"
import { MapProjection } from "grapher/mapCharts/MapProjections"

import { ChartEditor } from "./ChartEditor"
import {
    NumericSelectField,
    NumberField,
    SelectField,
    Toggle,
    Section,
} from "./Forms"
import { EditorColorScaleSection } from "./EditorColorScaleSection"
import { OwidVariableId } from "owidTable/OwidTable"

@observer
class VariableSection extends React.Component<{ mapTransform: MapTransform }> {
    @action.bound onVariableId(variableId: OwidVariableId) {
        this.props.mapTransform.props.columnSlug = variableId.toString()
    }

    @action.bound onProjection(projection: string | undefined) {
        this.props.mapTransform.props.projection = projection as MapProjection
    }

    render() {
        const { mapTransform } = this.props
        const { filledDimensions } = mapTransform.grapher

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
            "Oceania",
        ]
        const labels = [
            "World",
            "Africa",
            "North America",
            "South America",
            "Asia",
            "Europe",
            "Oceania",
        ]

        return (
            <Section name="Map">
                <NumericSelectField
                    label="Variable"
                    value={
                        mapTransform.columnSlug
                            ? parseInt(mapTransform.columnSlug)
                            : undefined
                    }
                    options={filledDimensions.map((d) => d.variableId)}
                    optionLabels={filledDimensions.map((d) => d.displayName)}
                    onValue={this.onVariableId}
                />
                <SelectField
                    label="Region"
                    value={mapTransform.props.projection}
                    options={projections}
                    optionLabels={labels}
                    onValue={this.onProjection}
                />
            </Section>
        )
    }
}

@observer
class TimelineSection extends React.Component<{ mapTransform: MapTransform }> {
    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapTransform.props.hideTimeline = value || undefined
    }

    @action.bound onTargetYear(targetYear: number | undefined) {
        this.props.mapTransform.props.targetYear = targetYear
    }

    @action.bound onTolerance(tolerance: number | undefined) {
        this.props.mapTransform.props.timeTolerance = tolerance
    }

    render() {
        const { mapTransform } = this.props
        return (
            <Section name="Timeline">
                <NumberField
                    label="Target year"
                    value={mapTransform.props.targetYear}
                    onValue={this.onTargetYear}
                    allowNegative
                />
                <Toggle
                    label="Hide timeline"
                    value={!!mapTransform.props.hideTimeline}
                    onValue={this.onToggleHideTimeline}
                />
                <NumberField
                    label="Tolerance of data"
                    value={mapTransform.props.timeTolerance}
                    onValue={this.onTolerance}
                    helpText="Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990."
                />
            </Section>
        )
    }
}

@observer
class TooltipSection extends React.Component<{ mapTransform: MapTransform }> {
    @action.bound onTooltipUseCustomLabels(tooltipUseCustomLabels: boolean) {
        this.props.mapTransform.props.tooltipUseCustomLabels = tooltipUseCustomLabels
            ? true
            : undefined
    }

    render() {
        const { mapTransform } = this.props
        return (
            <Section name="Tooltip">
                <Toggle
                    label={
                        "Show custom label in the tooltip, instead of the numeric value"
                    }
                    value={!!mapTransform.props.tooltipUseCustomLabels}
                    onValue={this.onTooltipUseCustomLabels}
                />
            </Section>
        )
    }
}

@observer
export class EditorMapTab extends React.Component<{ editor: ChartEditor }> {
    @computed get chart() {
        return this.props.editor.grapher
    }
    @computed get mapTransform() {
        return this.chart.mapTransform
    }

    render() {
        const { mapTransform } = this

        return (
            <div className="EditorMapTab tab-pane">
                <VariableSection mapTransform={mapTransform} />
                {mapTransform.isReady && (
                    <React.Fragment>
                        <TimelineSection mapTransform={mapTransform} />
                        <EditorColorScaleSection
                            scale={mapTransform.colorScale}
                            features={{
                                visualScaling: true,
                                legendDescription: false,
                            }}
                        />
                        <TooltipSection mapTransform={mapTransform} />
                    </React.Fragment>
                )}
            </div>
        )
    }
}
