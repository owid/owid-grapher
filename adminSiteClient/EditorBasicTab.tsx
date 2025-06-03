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
    DbChartTagJoin,
    TaggableType,
} from "@ourworldindata/types"
import {
    DimensionSlot,
    WORLD_ENTITY_NAME,
    CONTINENTS_INDICATOR_ID,
    POPULATION_INDICATOR_ID_USED_IN_ADMIN,
    findPotentialChartTypeSiblings,
} from "@ourworldindata/grapher"
import {
    DimensionProperty,
    moveArrayItemToIndex,
    OwidVariableId,
    startCase,
    OwidChartDimensionInterface,
    copyToClipboard,
} from "@ourworldindata/utils"
import { FieldsRow, Section, SelectField, TextField, Toggle } from "./Forms.js"
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
    NarrativeChartEditor,
    isNarrativeChartEditorInstance,
} from "./NarrativeChartEditor.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy } from "@fortawesome/free-solid-svg-icons"
import { Button } from "antd"
import * as R from "remeda"

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

    private get grapherState() {
        return this.props.editor.grapherState
    }

    @computed
    get errorMessages() {
        return this.props.errorMessagesForDimensions
    }

    @action.bound private async onAddVariables(variableIds: OwidVariableId[]) {
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
        // This used to work without passing in the dimensions but
        // after the grapher state refactor this led to weird issues like
        // the color change of a variable not being reflected visually,
        // even though the value registered correctly in the grapher state instance.
        void this.updateDimensionsAndRebuildTable(this.props.slot.dimensions)
        this.updateParentConfig()
    }

    @action.bound private updateDefaultSelection() {
        const { grapherState } = this.props.editor
        const { selection } = grapherState

        const availableEntityNames = grapherState.availableEntityNames
        const availableEntityNameSet = new Set(
            grapherState.availableEntityNames
        )

        if (grapherState.isScatter || grapherState.isMarimekko) {
            // chart types that display all entities by default shouldn't select any by default
            selection.clearSelection()
        } else if (
            grapherState.yColumnsFromDimensions.length > 1 &&
            !grapherState.isStackedArea &&
            !grapherState.isStackedBar &&
            !grapherState.isStackedDiscreteBar
        ) {
            // non-stacked charts with multiple y-dimensions should select a single entity by default.
            // if possible, the currently selected entity is persisted, otherwise "World" is preferred
            if (selection.numSelectedEntities !== 1) {
                const entities = availableEntityNameSet.has(WORLD_ENTITY_NAME)
                    ? [WORLD_ENTITY_NAME]
                    : R.sample(availableEntityNames, 1)
                if (entities) selection.setSelectedEntities(entities)
            }
            grapherState.addCountryMode = EntitySelectionMode.SingleEntity
        } else {
            // stacked charts or charts with a single y-dimension should select multiple entities by default.
            // if possible, the currently selected entities are persisted, otherwise a random sample is selected
            if (selection.numSelectedEntities === 0) {
                selection.setSelectedEntities(
                    availableEntityNames.length > 10
                        ? R.sample(availableEntityNames, 4)
                        : availableEntityNames
                )
            }
            grapherState.addCountryMode = EntitySelectionMode.MultipleEntities
        }
    }

    componentDidMount() {
        // We want to add the reaction only after the grapherState is loaded,
        // so we don't update the initial chart (as configured) by accident.
        when(
            () => this.grapherState.isReady,
            () => {
                this.disposers.push(
                    reaction(
                        () => this.grapherState.validChartTypes,
                        () => {
                            this.updateDefaultSelection()
                            this.editor.removeInvalidFocusedSeriesNames()
                        }
                    ),
                    reaction(
                        () => this.grapherState.yColumnsFromDimensions.length,
                        () => {
                            this.updateDefaultSelection()
                            this.editor.removeInvalidFocusedSeriesNames()
                        }
                    )
                )
            }
        )
        if (this.grapherState.dimensions.length > 0)
            void this.editor
                .cachingGrapherDataLoader(
                    this.grapherState.dimensions,
                    this.grapherState.selectedEntityColors
                )
                .then((inputTable) => {
                    if (inputTable) this.grapherState.inputTable = inputTable
                })
    }

    componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }

    @action.bound private async updateDimensionsAndRebuildTable(
        updatedDimensions?: OwidChartDimensionInterface[]
    ) {
        const { grapherState } = this.props.editor

        if (updatedDimensions) {
            grapherState.setDimensionsForProperty(
                this.props.slot.property,
                updatedDimensions
            )
        }

        this.grapherState.updateAuthoredVersion({
            dimensions: grapherState.dimensions.map((dim) => dim.toObject()),
        })
        grapherState.seriesColorMap?.clear()
        const inputTable = await this.props.editor.cachingGrapherDataLoader(
            grapherState.dimensions,
            grapherState.selectedEntityColors
        )

        if (inputTable) this.grapherState.inputTable = inputTable
    }

    @action.bound private updateParentConfig() {
        const { editor } = this.props
        if (isChartEditorInstance(editor)) {
            void editor.updateParentConfig()
        }
    }

    @action.bound private async onDragEnd(result: DropResult) {
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
                                                                      (this.isSelectingVariables = true)
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
        const { dimensionSlots } = props.editor.grapherState

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
        const { grapherState } = this.props.editor

        grapherState.chartTypes =
            value === this.chartTypeOptionNone
                ? []
                : [value as GrapherChartType]

        if (grapherState.isMarimekko) {
            grapherState.hideRelativeToggle = false
            grapherState.stackMode = StackMode.relative
        }

        // Give scatterplots a default color and size dimensions
        if (grapherState.isScatter) {
            const hasColor = grapherState.dimensions.find(
                (d) => d.property === DimensionProperty.color
            )
            if (!hasColor)
                grapherState.addDimension({
                    variableId: CONTINENTS_INDICATOR_ID,
                    property: DimensionProperty.color,
                })

            const hasSize = grapherState.dimensions.find(
                (d) => d.property === DimensionProperty.size
            )
            if (!hasSize)
                grapherState.addDimension({
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

    @computed get chartTypeSiblings(): GrapherChartType[] {
        const { grapherState } = this.props.editor

        const siblings =
            findPotentialChartTypeSiblings(grapherState.validChartTypeSet) ?? []

        // exclude the primary chart type
        return siblings.filter(
            (chartType) => chartType !== grapherState.chartType
        )
    }

    @action.bound private addChartType(chartType: GrapherChartType): void {
        const { grapherState } = this.props.editor
        if (grapherState.validChartTypeSet.has(chartType)) return
        grapherState.chartTypes = [...grapherState.chartTypes, chartType]
    }

    @action.bound private removeChartType(chartType: GrapherChartType): void {
        const { grapherState } = this.props.editor
        grapherState.chartTypes = grapherState.chartTypes.filter(
            (type) => type !== chartType
        )
    }

    @action.bound private toggleChartType(
        chartType: GrapherChartType,
        shouldHaveChartType: boolean
    ): void {
        if (shouldHaveChartType) this.addChartType(chartType)
        else this.removeChartType(chartType)
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        void this.saveTags(tags)
    }

    async saveTags(tags: DbChartTagJoin[]) {
        const { editor } = this.props
        const { grapherState } = editor
        await this.context.admin.requestJSON(
            `/api/charts/${grapherState.id}/setTags`,
            { tags },
            "POST"
        )
    }

    render() {
        const { editor } = this.props
        const { grapherState } = editor
        const isIndicatorChart = isIndicatorChartEditorInstance(editor)
        const isNarrativeChart = isNarrativeChartEditorInstance(editor)

        return (
            <div className="EditorBasicTab">
                {isIndicatorChart && <IndicatorChartInfo editor={editor} />}
                {isNarrativeChart &&
                    (editor.isNewGrapher ? (
                        <NarrativeChartForm editor={editor} />
                    ) : (
                        <NarrativeChartInfo editor={editor} />
                    ))}

                <Section name="Tabs">
                    <SelectField
                        label="Type of chart"
                        value={
                            grapherState.chartType ?? this.chartTypeOptionNone
                        }
                        onValue={this.onChartTypeChange}
                        options={this.chartTypeOptions}
                    />
                    <FieldsRow>
                        <Toggle
                            label="Map tab"
                            value={grapherState.hasMapTab}
                            onValue={(shouldHaveMapTab) =>
                                (grapherState.hasMapTab = shouldHaveMapTab)
                            }
                        />
                        {this.chartTypeSiblings.map((chartType) => (
                            <Toggle
                                key={chartType}
                                label={startCase(chartType)}
                                value={grapherState.validChartTypeSet.has(
                                    chartType
                                )}
                                onValue={(value) =>
                                    this.toggleChartType(chartType, value)
                                }
                            />
                        ))}
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
                        chartId={grapherState.id}
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
    const { variableId, grapherState } = props.editor

    const column = grapherState.inputTable.get(variableId?.toString())
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
function NarrativeChartInfo(props: { editor: NarrativeChartEditor }) {
    const { name = "" } = props.editor.manager

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

@observer
class NarrativeChartForm extends React.Component<{
    editor: NarrativeChartEditor
}> {
    render() {
        const { name, nameError, onNameChange } = this.props.editor.manager
        return (
            <Section name="Narrative chart">
                <p>
                    Please enter a programmatic name for the narrative chart.{" "}
                    <i>Note that this name cannot be changed later.</i>
                </p>
                <TextField
                    label="Name"
                    value={name}
                    onValue={onNameChange}
                    errorMessage={nameError}
                    required
                />
            </Section>
        )
    }
}
