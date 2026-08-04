import * as _ from "lodash-es"
import {
    GrapherInterface,
    MapRegionName,
    GRAPHER_MAP_TYPE,
} from "@ourworldindata/types"
import {
    ChartDimension,
    DimensionSlot,
    MapChartState,
    MapConfig,
    MAP_REGION_LABELS,
} from "@ourworldindata/grapher"
import {
    ColumnSlug,
    DimensionProperty,
    OwidChartDimensionInterface,
    OwidVariableId,
    ToleranceStrategy,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { Component, Fragment } from "react"
import { EditorColorScaleSection } from "./EditorColorScaleSection.js"
import { NumberField, Section, SelectField, Timeago, Toggle } from "./Forms.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { isChartEditorInstance, Log } from "./ChartEditor.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faLink } from "@fortawesome/free-solid-svg-icons"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "./ChartEditorTypes.js"
import { VariableSelector } from "./VariableSelector.js"
import { EditorDatabase } from "./ChartEditorView.js"
import { DimensionCard } from "./DimensionCard.js"

// Sentinel dropdown value that opens the variable selector
const BROWSE_ALL_INDICATORS = "__browseAllIndicators__"

interface VariableSectionProps<Editor> {
    editor: Editor
    database: EditorDatabase
    errorMessagesForDimensions: ErrorMessagesForDimensions
    parentConfig?: GrapherInterface
}

@observer
class VariableSection<Editor extends AbstractChartEditor> extends Component<
    VariableSectionProps<Editor>
> {
    isSelectingVariables: boolean = false

    constructor(props: VariableSectionProps<Editor>) {
        super(props)
        makeObservable(this, { isSelectingVariables: observable.ref })
    }

    @computed private get grapherState() {
        return this.props.editor.grapherState
    }

    @computed private get mapConfig(): MapConfig {
        return this.grapherState.map
    }

    @computed private get mapSlot(): DimensionSlot | undefined {
        return this.grapherState.dimensionSlots.find(
            (slot) => slot.property === DimensionProperty.map
        )
    }

    @computed private get mapDimension(): ChartDimension | undefined {
        return this.grapherState.dimensions.find(
            (dim) => dim.property === DimensionProperty.map
        )
    }

    @computed private get indicatorOptions(): {
        value: string
        label: string
    }[] {
        return [
            ...this.grapherState.loadedDimensions.map((d) => ({
                value: d.columnSlug,
                label: d.column.displayName,
            })),
            {
                value: BROWSE_ALL_INDICATORS,
                label: "Browse all indicators…",
            },
        ]
    }

    @action.bound onColumnSlug(columnSlug: ColumnSlug) {
        if (columnSlug === BROWSE_ALL_INDICATORS) {
            // Native selects fire a click event right after this change
            // event. The variable selector dismisses itself on any click
            // outside the modal, so that trailing click would close it
            // immediately — swallow it before it reaches the modal's
            // dismiss listener
            document.addEventListener(
                "click",
                (event) => {
                    if (event.target instanceof HTMLSelectElement)
                        event.stopImmediatePropagation()
                },
                { capture: true, once: true }
            )
            this.isSelectingVariables = true
            return
        }
        this.mapConfig.columnSlug = columnSlug
        // The dedicated map dimension takes precedence over map.columnSlug,
        // so selecting another indicator removes it
        if (this.mapDimension && this.mapDimension.columnSlug !== columnSlug)
            void this.removeMapDimension()
    }

    @action.bound private async onSelectMapVariable(
        variableIds: OwidVariableId[]
    ) {
        this.isSelectingVariables = false

        const variableId = variableIds[0]
        if (variableId === undefined) return

        // An indicator that's already plotted on the chart is selected via
        // map.columnSlug; a dedicated map dimension would be redundant
        const plottedDimension = this.grapherState.dimensions.find(
            (dim) =>
                dim.variableId === variableId &&
                dim.property !== DimensionProperty.map
        )
        if (plottedDimension) {
            this.onColumnSlug(plottedDimension.columnSlug)
            return
        }

        if (this.mapDimension?.variableId === variableId) return

        await this.commitMapDimensions([
            { property: DimensionProperty.map, variableId },
        ])
    }

    @action.bound private onChangeMapDimension() {
        void this.commitMapDimensions(this.mapSlot?.dimensions ?? [])
    }

    @action.bound private onRemoveMapDimension() {
        void this.removeMapDimension()
    }

    private async removeMapDimension(): Promise<void> {
        await this.commitMapDimensions([])
    }

    private async commitMapDimensions(
        dimensions: OwidChartDimensionInterface[]
    ): Promise<void> {
        const { editor } = this.props
        this.grapherState.setDimensionsForProperty(
            DimensionProperty.map,
            dimensions
        )
        await editor.commitDimensionsAndReloadData()
        if (isChartEditorInstance(editor)) void editor.updateParentConfig()
    }

    @action.bound onBlurColumnSlug() {
        if (this.mapConfig.columnSlug === undefined) {
            this.mapConfig.columnSlug = this.props.parentConfig?.map?.columnSlug
        }
    }

    @action.bound onRegion(region: string | undefined) {
        this.mapConfig.region = region as MapRegionName
    }

    override render() {
        const { mapConfig, mapDimension } = this
        const { editor, database, errorMessagesForDimensions } = this.props
        const { loadedDimensions } = this.grapherState

        if (_.isEmpty(loadedDimensions))
            return (
                <section>
                    <h2>Add some indicators on data tab first</h2>
                </section>
            )

        return (
            <Section name="Map">
                <SelectField
                    label="Indicator"
                    value={this.grapherState.mapColumnSlug}
                    options={this.indicatorOptions}
                    onValue={this.onColumnSlug}
                    onBlur={this.onBlurColumnSlug}
                />
                {mapDimension && (
                    <DimensionCard
                        dimension={mapDimension}
                        editor={editor}
                        onChange={this.onChangeMapDimension}
                        onRemove={this.onRemoveMapDimension}
                        errorMessage={
                            errorMessagesForDimensions[DimensionProperty.map][0]
                        }
                    />
                )}
                <SelectField
                    label="Region"
                    value={mapConfig.region}
                    options={Object.entries(MAP_REGION_LABELS).map(
                        ([key, val]) => ({ value: key, label: val })
                    )}
                    onValue={this.onRegion}
                />
                {this.isSelectingVariables && this.mapSlot && (
                    <VariableSelector
                        editor={editor}
                        database={database}
                        slot={this.mapSlot}
                        onDismiss={action(
                            () => (this.isSelectingVariables = false)
                        )}
                        onComplete={this.onSelectMapVariable}
                    />
                )}
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
    database: EditorDatabase
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
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

    @computed get lastColorScaleEdit(): MapColorScaleEdit | undefined {
        const { editor } = this.props
        if (!isChartEditorInstance(editor)) return undefined
        return findLastMapColorScaleEdit(editor.logs ?? [])
    }

    @computed get lastColorScaleEditNote(): React.ReactNode | undefined {
        const edit = this.lastColorScaleEdit
        if (!edit) return undefined
        return (
            <>
                Last edited <Timeago time={edit.createdAt} by={edit.userName} />
            </>
        )
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
                    editor={this.props.editor}
                    database={this.props.database}
                    errorMessagesForDimensions={
                        this.props.errorMessagesForDimensions
                    }
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
                            lastEditedNote={this.lastColorScaleEditNote}
                        />
                        <TooltipSection mapConfig={mapConfig} />
                    </Fragment>
                )}
                <InheritanceSection editor={this.props.editor} />
            </div>
        )
    }
}

interface MapColorScaleEdit {
    userName: string
    createdAt: string
}

function findLastMapColorScaleEdit(logs: Log[]): MapColorScaleEdit | undefined {
    // Assumes logs are ordered from newest to oldest
    for (let i = 0; i < logs.length - 1; i++) {
        const current = logs[i].config?.map?.colorScale
        const previous = logs[i + 1].config?.map?.colorScale

        if (!_.isEqual(current, previous)) {
            return { userName: logs[i].userName, createdAt: logs[i].createdAt }
        }
    }

    // The map color scale has never been edited or the logs are empty
    return undefined
}
