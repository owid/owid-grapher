import React from "react"
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
    ChartTypeName,
    EntitySelectionMode,
    StackMode,
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

        this.updateDimensionsAndRebuildTable(dimensionConfigs)
        this.updateParentConfig()
    }

    @action.bound private onRemoveDimension(variableId: OwidVariableId) {
        this.updateDimensionsAndRebuildTable(
            this.props.slot.dimensions.filter(
                (d) => d.variableId !== variableId
            )
        )
        this.updateParentConfig()
    }

    @action.bound private onChangeDimension() {
        this.updateDimensionsAndRebuildTable()
        this.updateParentConfig()
    }

    @action.bound private updateDefaults() {
        const { grapher } = this.props.editor
        const { selection } = grapher
        const { availableEntityNames, availableEntityNameSet } = selection

        if (grapher.isScatter || grapher.isSlopeChart || grapher.isMarimekko) {
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
                    reaction(() => this.grapher.type, this.updateDefaults),
                    reaction(
                        () => this.grapher.yColumnsFromDimensions.length,
                        this.updateDefaults
                    )
                )
            }
        )
    }

    componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }

    @action.bound private updateDimensionsAndRebuildTable(
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
        this.grapher.rebuildInputOwidTable()
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

        this.updateDimensionsAndRebuildTable(dimensions)
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

@observer
export class EditorBasicTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
    database: EditorDatabase
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onChartTypeChange(value: string) {
        const { grapher } = this.props.editor
        grapher.type = value as ChartTypeName

        if (grapher.isMarimekko) {
            grapher.hideRelativeToggle = false
            grapher.stackMode = StackMode.relative
        }

        // Give scatterplots and slope charts a default color dimension if they don't have one
        if (grapher.isScatter || grapher.isSlopeChart) {
            const hasColor = grapher.dimensions.find(
                (d) => d.property === DimensionProperty.color
            )
            if (!hasColor)
                grapher.addDimension({
                    variableId: CONTINENTS_INDICATOR_ID,
                    property: DimensionProperty.color,
                })
        }

        // Give scatterplots a default size dimension if they don't have one
        if (grapher.isScatter) {
            const hasSize = grapher.dimensions.find(
                (d) => d.property === DimensionProperty.size
            )
            if (!hasSize)
                grapher.addDimension({
                    variableId: POPULATION_INDICATOR_ID_USED_IN_ADMIN,
                    property: DimensionProperty.size,
                })
        }
    }

    render() {
        const { editor } = this.props
        const { grapher } = editor
        const chartTypes = Object.keys(ChartTypeName).filter(
            (chartType) => chartType !== ChartTypeName.WorldMap
        )

        return (
            <div className="EditorBasicTab">
                <Section name="Type of chart">
                    <SelectField
                        value={grapher.type}
                        onValue={this.onChartTypeChange}
                        options={chartTypes.map((key) => ({
                            value: key,
                            label: startCase(key),
                        }))}
                    />
                    <FieldsRow>
                        <Toggle
                            label="Chart tab"
                            value={grapher.hasChartTab}
                            onValue={(value) => (grapher.hasChartTab = value)}
                        />
                        <Toggle
                            label="Map tab"
                            value={grapher.hasMapTab}
                            onValue={(value) => (grapher.hasMapTab = value)}
                        />
                    </FieldsRow>
                </Section>
                <VariablesSection
                    editor={editor}
                    database={this.props.database}
                    errorMessagesForDimensions={
                        this.props.errorMessagesForDimensions
                    }
                />
            </div>
        )
    }
}
