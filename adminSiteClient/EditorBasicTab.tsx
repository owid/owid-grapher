import * as React from "react"
import {
    observable,
    action,
    reaction,
    IReactionDisposer,
    when,
    computed,
} from "mobx"
import { observer } from "mobx-react"
import {
    EntitySelectionMode,
    StackMode,
    ALL_GRAPHER_CHART_TYPES,
    GrapherChartType,
    GRAPHER_CHART_TYPES,
    DbChartTagJoin,
    TaggableType,
} from "@ourworldindata/types"
import {
    DimensionSlot,
    WorldEntityName,
    CONTINENTS_INDICATOR_ID,
    POPULATION_INDICATOR_ID_USED_IN_ADMIN,
} from "@ourworldindata/grapher"
import {
    DimensionProperty,
    moveArrayItemToIndex,
    OwidVariableId,
    sample,
    sampleSize,
    startCase,
    OwidChartDimensionInterface,
    copyToClipboard,
} from "@ourworldindata/utils"
import { FieldsRow, Section, SelectField, Toggle } from "./Forms.js"
import { VariableSelector } from "./VariableSelector.js"
import { DimensionCard } from "./DimensionCard.js"
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "react-beautiful-dnd"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { EditorDatabase } from "./ChartEditorView.js"
import { isChartEditorInstance } from "./ChartEditor.js"
import { ErrorMessagesForDimensions } from "./ChartEditorTypes.js"
import {
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import { EditableTags } from "./EditableTags.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    ChartViewEditor,
    isChartViewEditorInstance,
} from "./ChartViewEditor.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy } from "@fortawesome/free-solid-svg-icons"
import { Button } from "antd"

@observer
class DimensionSlotView<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    slot: DimensionSlot
    editor: Editor
    database: EditorDatabase
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    disposers: IReactionDisposer[] = []

    @observable.ref isSelectingVariables: boolean = false

    private get editor() {
        return this.props.editor
    }

    private get grapher() {
        return this.props.editor.grapher
    }

    @computed
    get errorMessages() {
        return this.props.errorMessagesForDimensions
    }

    @action.bound private onAddVariables(variableIds: OwidVariableId[]) {
        const { slot } = this.props

        const dimensionConfigs = variableIds.map((id) => {
            const existingDimension = slot.dimensions.find(
                (d) => d.variableId === id
            )
            return (
                existingDimension || {
                    property: slot.property,
                    variableId: id,
                }
            )
        })

        this.isSelectingVariables = false

        void this.updateDimensionsAndRebuildTable(dimensionConfigs)
        this.updateParentConfig()
    }

    @action.bound private onRemoveDimension(variableId: OwidVariableId) {
        void this.updateDimensionsAndRebuildTable(
            this.props.slot.dimensions.filter(
                (d) => d.variableId !== variableId
            )
        )
        this.updateParentConfig()
    }

    @action.bound private onChangeDimension() {
        void this.updateDimensionsAndRebuildTable()
        this.updateParentConfig()
    }

    @action.bound private updateDefaultSelection() {
        const { grapher } = this.props.editor
        const { selection } = grapher

        const availableEntityNames = grapher.availableEntityNames
        const availableEntityNameSet = new Set(grapher.availableEntityNames)

        if (grapher.isScatter || grapher.isMarimekko) {
            // chart types that display all entities by default shouldn't select any by default
            selection.clearSelection()
        } else if (
            grapher.yColumnsFromDimensions.length > 1 &&
            !grapher.isStackedArea &&
            !grapher.isStackedBar &&
            !grapher.isStackedDiscreteBar
        ) {
            // non-stacked charts with multiple y-dimensions should select a single entity by default.
            // if possible, the currently selected entity is persisted, otherwise "World" is preferred
            if (selection.numSelectedEntities !== 1) {
                const entity = availableEntityNameSet.has(WorldEntityName)
                    ? WorldEntityName
                    : sample(availableEntityNames)
                if (entity) selection.setSelectedEntities([entity])
            }
            grapher.addCountryMode = EntitySelectionMode.SingleEntity
        } else {
            // stacked charts or charts with a single y-dimension should select multiple entities by default.
            // if possible, the currently selected entities are persisted, otherwise a random sample is selected
            if (selection.numSelectedEntities === 0) {
                selection.setSelectedEntities(
                    availableEntityNames.length > 10
                        ? sampleSize(availableEntityNames, 4)
                        : availableEntityNames
                )
            }
            grapher.addCountryMode = EntitySelectionMode.MultipleEntities
        }
    }

    componentDidMount() {
        // We want to add the reaction only after the grapher is loaded,
        // so we don't update the initial chart (as configured) by accident.
        when(
            () => this.grapher.isReady,
            () => {
                this.disposers.push(
                    reaction(
                        () => this.grapher.validChartTypes,
                        () => {
                            this.updateDefaultSelection()
                            this.editor.removeInvalidFocusedSeriesNames()
                        }
                    ),
                    reaction(
                        () => this.grapher.yColumnsFromDimensions.length,
                        () => {
                            this.updateDefaultSelection()
                            this.editor.removeInvalidFocusedSeriesNames()
                        }
                    )
                )
            }
        )
    }

    componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }

    @action.bound private async updateDimensionsAndRebuildTable(
        updatedDimensions?: OwidChartDimensionInterface[]
    ) {
        const { grapher } = this.props.editor

        if (updatedDimensions) {
            grapher.setDimensionsForProperty(
                this.props.slot.property,
                updatedDimensions
            )
        }

        this.grapher.updateAuthoredVersion({
            dimensions: grapher.dimensions.map((dim) => dim.toObject()),
        })
        grapher.seriesColorMap?.clear()

        await grapher.downloadLegacyDataFromOwidVariableIds()
        grapher.rebuildInputOwidTable()
    }

    @action.bound private updateParentConfig() {
        const { editor } = this.props
        if (isChartEditorInstance(editor)) {
            void editor.updateParentConfig()
        }
    }

    @action.bound private onDragEnd(result: DropResult) {
        const { source, destination } = result
        if (!destination) return

        const dimensions = moveArrayItemToIndex(
            this.props.slot.dimensions,
            source.index,
            destination.index
        )

        void this.updateDimensionsAndRebuildTable(dimensions)
        this.updateParentConfig()
    }

    @computed get isDndEnabled() {
        // we cannot move variables between slots, so only enable drag and drop if there's more than
        // one variable in the slot
        return this.props.slot.dimensions.length > 1
    }

    render() {
        const { isSelectingVariables } = this
        const { slot, editor } = this.props
        const dimensions = slot.dimensions
        const canAddMore = slot.allowMultiple || slot.dimensions.length === 0

        return (
            <div>
                <h5>{slot.name}</h5>
                <DragDropContext onDragEnd={this.onDragEnd}>
                    <Droppable droppableId="droppable">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                            >
                                {dimensions.map((dim, index) => (
                                    <Draggable
                                        key={dim.variableId}
                                        index={index}
                                        draggableId={`${dim.variableId}`}
                                        isDragDisabled={!this.isDndEnabled}
                                    >
                                        {(provided) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                {...provided.dragHandleProps}
                                            >
                                                <DimensionCard
                                                    dimension={dim}
                                                    editor={editor}
                                                    onChange={
                                                        this.onChangeDimension
                                                    }
                                                    onEdit={
                                                        slot.allowMultiple
                                                            ? undefined
                                                            : action(
                                                                  () =>
                                                                      (this.isSelectingVariables =
                                                                          true)
                                                              )
                                                    }
                                                    onRemove={
                                                        slot.isOptional
                                                            ? () =>
                                                                  this.onRemoveDimension(
                                                                      dim.variableId
                                                                  )
                                                            : undefined
                                                    }
                                                    isDndEnabled={
                                                        this.isDndEnabled
                                                    }
                                                    errorMessage={
                                                        this.errorMessages[
                                                            slot.property
                                                        ][index]
                                                    }
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                {canAddMore && (
                    <div
                        className="dimensionSlot"
                        onClick={action(
                            () => (this.isSelectingVariables = true)
                        )}
                    >
                        Add indicator{slot.allowMultiple && "s"}
                    </div>
                )}
                {isSelectingVariables && (
                    <VariableSelector
                        editor={editor}
                        database={this.props.database}
                        slot={slot}
                        onDismiss={action(
                            () => (this.isSelectingVariables = false)
                        )}
                        onComplete={this.onAddVariables}
                    />
                )}
            </div>
        )
    }
}

@observer
class VariablesSection<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
    database: EditorDatabase
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref isAddingVariable: boolean = false

    render() {
        const { props } = this
        const { dimensionSlots } = props.editor.grapher

        return (
            <Section name="Add indicators">
                <div className="VariableSlots">
                    {dimensionSlots.map((slot) => (
                        <DimensionSlotView
                            key={slot.name}
                            slot={slot}
                            editor={props.editor}
                            database={props.database}
                            errorMessagesForDimensions={
                                props.errorMessagesForDimensions
                            }
                        />
                    ))}
                </div>
            </Section>
        )
    }
}

// eslint-disable-next-line react-refresh/only-export-components
const TagsSection = (props: {
    chartId: number | undefined
    tags: DbChartTagJoin[] | undefined
    availableTags: DbChartTagJoin[] | undefined
    onSaveTags: (tags: DbChartTagJoin[]) => void
}) => {
    const { chartId, tags, availableTags } = props
    const canTag = !!chartId && tags && availableTags
    return (
        <Section name="Tags">
            {canTag ? (
                <>
                    <EditableTags
                        onSave={props.onSaveTags}
                        tags={tags}
                        suggestions={availableTags}
                        hasKeyChartSupport
                        hasSuggestionsSupport
                        taggable={{
                            type: TaggableType.Charts,
                            id: props.chartId,
                        }}
                    />
                    <small className="form-text text-muted">
                        Changes to tags will be applied instantly, without the
                        need to save the chart.
                    </small>
                </>
            ) : (
                <p>
                    Can't tag this chart
                    {!chartId && <>, because it hasn't been saved yet</>}.
                </p>
            )}
        </Section>
    )
}

@observer
export class EditorBasicTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
    database: EditorDatabase
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    private chartTypeOptionNone = "None"

    @action.bound private updateParentConfig() {
        const { editor } = this.props
        if (isChartEditorInstance(editor)) {
            void editor.updateParentConfig()
        }
    }

    @action.bound onChartTypeChange(value: string) {
        const { grapher } = this.props.editor

        grapher.chartTypes =
            value === this.chartTypeOptionNone
                ? []
                : [value as GrapherChartType]

        if (grapher.isMarimekko) {
            grapher.hideRelativeToggle = false
            grapher.stackMode = StackMode.relative
        }

        // Give scatterplots a default color and size dimensions
        if (grapher.isScatter) {
            const hasColor = grapher.dimensions.find(
                (d) => d.property === DimensionProperty.color
            )
            if (!hasColor)
                grapher.addDimension({
                    variableId: CONTINENTS_INDICATOR_ID,
                    property: DimensionProperty.color,
                })

            const hasSize = grapher.dimensions.find(
                (d) => d.property === DimensionProperty.size
            )
            if (!hasSize)
                grapher.addDimension({
                    variableId: POPULATION_INDICATOR_ID_USED_IN_ADMIN,
                    property: DimensionProperty.size,
                })
        }

        // since the parent config depends on the chart type
        // (scatters don't have a parent), we might need to update
        // the parent config when the type changes
        this.updateParentConfig()
    }

    @computed private get chartTypeOptions(): {
        value: string
        label: string
    }[] {
        const chartTypeOptions = ALL_GRAPHER_CHART_TYPES.map((key) => ({
            value: key,
            label: startCase(key),
        }))

        return [
            ...chartTypeOptions,
            { value: this.chartTypeOptionNone, label: "No chart tab" },
        ]
    }

    private addSlopeChart(): void {
        const { grapher } = this.props.editor
        if (grapher.hasSlopeChart) return
        grapher.chartTypes = [
            ...grapher.chartTypes,
            GRAPHER_CHART_TYPES.SlopeChart,
        ]
    }

    private removeSlopeChart(): void {
        const { grapher } = this.props.editor
        grapher.chartTypes = grapher.chartTypes.filter(
            (type) => type !== GRAPHER_CHART_TYPES.SlopeChart
        )
    }

    @action.bound toggleSecondarySlopeChart(
        shouldHaveSlopeChart: boolean
    ): void {
        if (shouldHaveSlopeChart) {
            this.addSlopeChart()
        } else {
            this.removeSlopeChart()
        }
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        void this.saveTags(tags)
    }

    async saveTags(tags: DbChartTagJoin[]) {
        const { editor } = this.props
        const { grapher } = editor
        await this.context.admin.requestJSON(
            `/api/charts/${grapher.id}/setTags`,
            { tags },
            "POST"
        )
    }

    render() {
        const { editor } = this.props
        const { grapher } = editor
        const isIndicatorChart = isIndicatorChartEditorInstance(editor)
        const isChartView = isChartViewEditorInstance(editor)

        return (
            <div className="EditorBasicTab">
                {isIndicatorChart && <IndicatorChartInfo editor={editor} />}
                {isChartView && <ChartViewInfo editor={editor} />}

                <Section name="Tabs">
                    <SelectField
                        label="Type of chart"
                        value={grapher.chartType ?? this.chartTypeOptionNone}
                        onValue={this.onChartTypeChange}
                        options={this.chartTypeOptions}
                    />
                    <FieldsRow>
                        <Toggle
                            label="Map tab"
                            value={grapher.hasMapTab}
                            onValue={(shouldHaveMapTab) =>
                                (grapher.hasMapTab = shouldHaveMapTab)
                            }
                        />
                        {grapher.isLineChart && (
                            <Toggle
                                label="Slope chart"
                                value={grapher.hasSlopeChart}
                                onValue={this.toggleSecondarySlopeChart}
                            />
                        )}
                    </FieldsRow>
                </Section>
                {!isIndicatorChart && (
                    <VariablesSection
                        editor={editor}
                        database={this.props.database}
                        errorMessagesForDimensions={
                            this.props.errorMessagesForDimensions
                        }
                    />
                )}

                {isChartEditorInstance(editor) && (
                    <TagsSection
                        chartId={grapher.id}
                        tags={editor.tags}
                        availableTags={editor.availableTags}
                        onSaveTags={this.onSaveTags}
                    />
                )}
            </div>
        )
    }
}

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function IndicatorChartInfo(props: { editor: IndicatorChartEditor }) {
    const { variableId, grapher } = props.editor

    const column = grapher.inputTable.get(variableId?.toString())
    const variableLink = (
        <a
            href={`/admin/variables/${variableId}`}
            target="_blank"
            rel="noopener"
        >
            {column?.name ?? variableId}
        </a>
    )

    return (
        <Section name="Indicator chart">
            <p>Your are editing the config of the {variableLink} indicator.</p>
        </Section>
    )
}

// The rule doesn't support class components in the same file.
// eslint-disable-next-line react-refresh/only-export-components
function ChartViewInfo(props: { editor: ChartViewEditor }) {
    const { name = "" } = props.editor.manager.idsAndName ?? {}

    return (
        <Section name="Narrative chart">
            <p>
                Your are editing the config of a narrative chart named{" "}
                <i>{name}</i>.
            </p>
            <Button
                size="small"
                color="default"
                variant="filled"
                icon={<FontAwesomeIcon icon={faCopy} size="sm" />}
                onClick={() => copyToClipboard(name)}
            >
                Copy name
            </Button>
        </Section>
    )
}
