import {
    GrapherInterface,
    MapRegionName,
    GRAPHER_MAP_TYPE,
} from "@ourworldindata/types"
import {
    ChartDimension,
    MapChart,
    MapConfig,
    MAP_REGION_LABELS,
} from "@ourworldindata/grapher"
import { ColumnSlug, isEmpty, ToleranceStrategy } from "@ourworldindata/utils"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Component, Fragment } from "react"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLink } from "@fortawesome/free-solid-svg-icons"

@observer
class VariableSection extends Component<{
    mapConfig: MapConfig
    filledDimensions: ChartDimension[]
    parentConfig?: GrapherInterface
}> {
    @action.bound onColumnSlug(columnSlug: ColumnSlug) {
        this.props.mapConfig.columnSlug = columnSlug
    }

    @action.bound onBlurColumnSlug() {
        if (this.props.mapConfig.columnSlug === undefined) {
            this.props.mapConfig.columnSlug =
                this.props.parentConfig?.map?.columnSlug
        }
    }

    @action.bound onRegion(region: string | undefined) {
        this.props.mapConfig.region = region as MapRegionName
    }

    render() {
        const { mapConfig, filledDimensions } = this.props

        if (isEmpty(filledDimensions))
            return (
                <section>
                    <h2>Add some indicators on data tab first</h2>
                </section>
            )

        return (
            <Section name="Map">
                <SelectField
                    label="Indicator"
                    value={mapConfig.columnSlug}
                    options={filledDimensions.map((d) => ({
                        value: d.columnSlug,
                        label: d.column.displayName,
                    }))}
                    onValue={this.onColumnSlug}
                    onBlur={this.onBlurColumnSlug}
                />
                <SelectField
                    label="Region"
                    value={mapConfig.region}
                    options={Object.entries(MAP_REGION_LABELS).map(
                        ([key, val]) => ({ value: key, label: val })
                    )}
                    onValue={this.onRegion}
                />
            </Section>
        )
    }
}

@observer
class TimelineSection extends Component<{ mapConfig: MapConfig }> {
    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapConfig.hideTimeline = value || undefined
    }

    @action.bound setMapTime(time: number | undefined) {
        this.props.mapConfig.startTime = time
        this.props.mapConfig.endTime = time
    }

    @action.bound onTolerance(tolerance: number | undefined) {
        this.props.mapConfig.timeTolerance = tolerance
    }

    get toleranceStrategyOptions(): {
        value: ToleranceStrategy
        label: string
    }[] {
        const toleranceStrategyLabels = {
            [ToleranceStrategy.closest]:
                "Closest: Consider data points in the past and future",
            [ToleranceStrategy.backwards]:
                "Backwards: Only consider data points in the past",
            [ToleranceStrategy.forwards]:
                "Forwards: Only consider data points in the future",
        }

        return Object.values(ToleranceStrategy).map(
            (val: ToleranceStrategy) => ({
                value: val,
                label: toleranceStrategyLabels[val],
            })
        )
    }

    @action.bound onSelectToleranceStrategy(value: string | undefined) {
        this.props.mapConfig.toleranceStrategy = value as ToleranceStrategy
    }

    render() {
        const { mapConfig } = this.props
        return (
            <Section name="Timeline">
                <NumberField
                    label="Target year"
                    value={
                        mapConfig.startTime === mapConfig.endTime
                            ? mapConfig.endTime
                            : undefined
                    }
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
                    helpText={`Specify a range of years from which to pull data.
                        For example, if the map shows 1990 and tolerance is set
                        to 1, then data from 1989 or 1991 will be shown if no
                        data is available for 1990. This tolerance setting only
                        affects the map and overrides the indicator's tolerance
                        defined in the Basic tab.`}
                />
                {(mapConfig.timeTolerance || 0) > 0 && (
                    <SelectField
                        label="Tolerance strategy"
                        value={mapConfig.toleranceStrategy}
                        options={this.toleranceStrategyOptions}
                        onValue={this.onSelectToleranceStrategy}
                    />
                )}
            </Section>
        )
    }
}

@observer
class TooltipSection extends Component<{ mapConfig: MapConfig }> {
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
class InheritanceSection<Editor extends AbstractChartEditor> extends Component<{
    editor: Editor
}> {
    @computed private get editor() {
        return this.props.editor
    }

    @action.bound resetToParent() {
        const { grapher, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.map) return

        grapher.map = new MapConfig()
        grapher.map.updateFromObject(activeParentConfig.map)
    }

    render() {
        const canMapSettingsBeInherited =
            this.editor.canPropertyBeInherited("map")
        const areMapSettingsInherited = this.editor.isPropertyInherited("map")

        if (!canMapSettingsBeInherited) return null

        return (
            <Section name="Inheritance">
                {areMapSettingsInherited
                    ? "All map settings are currently inherited."
                    : "Some map settings overwrite the automatic defaults."}

                {!areMapSettingsInherited && (
                    <div className="mt-2">
                        <button
                            className="btn btn-outline-secondary"
                            type="button"
                            onClick={this.resetToParent}
                        >
                            <FontAwesomeIcon icon={faLink} className="mr-2" />
                            Reset all map settings
                        </button>
                    </div>
                )}
            </Section>
        )
    }
}

@observer
export class EditorMapTab<
    Editor extends AbstractChartEditor,
> extends Component<{ editor: Editor }> {
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
                    parentConfig={this.props.editor.activeParentConfig}
                />
                {isReady && (
                    <Fragment>
                        <TimelineSection mapConfig={mapConfig} />
                        <EditorColorScaleSection
                            scale={colorScale}
                            chartType={GRAPHER_MAP_TYPE}
                            showLineChartColors={false}
                            features={{
                                legendDescription: false,
                            }}
                        />
                        <TooltipSection mapConfig={mapConfig} />
                    </Fragment>
                )}
                <InheritanceSection editor={this.props.editor} />
            </div>
        )
    }
}
