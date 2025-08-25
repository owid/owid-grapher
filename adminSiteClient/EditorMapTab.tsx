import * as _ from "lodash-es"
import {
    GrapherInterface,
    MapRegionName,
    GRAPHER_MAP_TYPE,
} from "@ourworldindata/types"
import {
    ChartDimension,
    MapChartState,
    MapConfig,
    MAP_REGION_LABELS,
} from "@ourworldindata/grapher"
import { ColumnSlug, ToleranceStrategy } from "@ourworldindata/utils"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component, Fragment } from "react"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLink } from "@fortawesome/free-solid-svg-icons"
import { ErrorMessages } from "./ChartEditorTypes.js"

interface VariableSectionProps {
    mapConfig: MapConfig
    filledDimensions: ChartDimension[]
    parentConfig?: GrapherInterface
}

@observer
class VariableSection extends Component<VariableSectionProps> {
    constructor(props: VariableSectionProps) {
        super(props)
        makeObservable(this)
    }

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

    override render() {
        const { mapConfig, filledDimensions } = this.props

        if (_.isEmpty(filledDimensions))
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
    constructor(props: { mapConfig: MapConfig }) {
        super(props)
        makeObservable(this)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapConfig.hideTimeline = value || undefined
    }

    @action.bound setMapTime(time: number | undefined) {
        this.props.mapConfig.time = time
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

    override render() {
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
    constructor(props: { mapConfig: MapConfig }) {
        super(props)
        makeObservable(this)
    }

    @action.bound onTooltipUseCustomLabels(tooltipUseCustomLabels: boolean) {
        this.props.mapConfig.tooltipUseCustomLabels = tooltipUseCustomLabels
            ? true
            : undefined
    }

    override render() {
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
    constructor(props: { editor: Editor }) {
        super(props)
        makeObservable(this)
    }

    @computed private get editor() {
        return this.props.editor
    }

    @action.bound resetToParent() {
        const { grapherState, activeParentConfig } = this.editor
        if (!activeParentConfig || !activeParentConfig.map) return

        grapherState.map = new MapConfig()
        grapherState.map.updateFromObject(activeParentConfig.map)
    }

    override render() {
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

interface EditorMapTabProps<Editor> {
    editor: Editor
    errorMessages: ErrorMessages
}

@observer
export class EditorMapTab<Editor extends AbstractChartEditor> extends Component<
    EditorMapTabProps<Editor>
> {
    constructor(props: EditorMapTabProps<Editor>) {
        super(props)
        makeObservable(this)
    }

    @computed get grapherState() {
        return this.props.editor.grapherState
    }

    override render() {
        const { grapherState } = this
        const mapConfig = grapherState.map
        const { mapColumnSlug } = grapherState
        const mapChartState = new MapChartState({ manager: this.grapherState })
        const colorScale = mapChartState.colorScale

        const isReady = !!mapColumnSlug && grapherState.table.has(mapColumnSlug)

        return (
            <div className="EditorMapTab tab-pane">
                <VariableSection
                    mapConfig={mapConfig}
                    filledDimensions={grapherState.filledDimensions}
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
                            errorMessages={this.props.errorMessages}
                            errorMessagesKey={"map.colorScale"}
                        />
                        <TooltipSection mapConfig={mapConfig} />
                    </Fragment>
                )}
                <InheritanceSection editor={this.props.editor} />
            </div>
        )
    }
}
