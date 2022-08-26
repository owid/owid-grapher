import React from "react"
import { observable, action, reaction, IReactionDisposer, computed } from "mobx"
import { observer } from "mobx-react"
import { sample, sampleSize, startCase } from "../clientUtils/Util.js"
import {
    EntitySelectionMode,
    ChartTypeName,
    WorldEntityName,
    StackMode,
} from "../grapher/core/GrapherConstants.js"
import {
    Toggle,
    SelectField,
    EditableList,
    FieldsRow,
    Section,
} from "./Forms.js"
import { ChartEditor } from "./ChartEditor.js"
import { VariableSelector } from "./VariableSelector.js"
import { DimensionCard } from "./DimensionCard.js"
import { DimensionSlot } from "../grapher/chart/DimensionSlot.js"
import {
    ColumnSlug,
    DimensionProperty,
    OwidVariableId,
} from "../clientUtils/owidTypes.js"

@observer
class DimensionSlotView extends React.Component<{
    slot: DimensionSlot
    editor: ChartEditor
}> {
    dispose!: IReactionDisposer

    @observable.ref isSelectingVariables: boolean = false

    private get grapher() {
        return this.props.editor.grapher
    }

    @action.bound private onAddVariables(variableIds: OwidVariableId[]) {
        const { slot } = this.props
        const { grapher } = this.props.editor

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

        grapher.setDimensionsForProperty(slot.property, dimensionConfigs)

        grapher.updateAuthoredVersion({
            dimensions: grapher.dimensions.map((dim) => dim.toObject()),
        })

        this.isSelectingVariables = false
        this.updateDefaults()
    }

    @action.bound private onRemoveDimension(variableId: OwidVariableId) {
        const { slot } = this.props
        const { grapher } = this.props.editor

        this.grapher.setDimensionsForProperty(
            slot.property,
            this.props.slot.dimensions.filter(
                (d) => d.variableId !== variableId
            )
        )

        grapher.updateAuthoredVersion({
            dimensions: grapher.dimensions.map((dim) => dim.toObject()),
        })
        grapher.rebuildInputOwidTable()

        this.updateDefaults()
    }

    private updateDefaults() {
        const { grapher } = this.props.editor
        const { selection } = grapher
        const { availableEntityNames, availableEntityNameSet } = selection

        if (this.dispose) this.dispose()
        this.dispose = reaction(
            () => grapher.type && grapher.yColumnsFromDimensions,
            () => {
                if (
                    grapher.isScatter ||
                    grapher.isSlopeChart ||
                    grapher.isMarimekko
                ) {
                    selection.clearSelection()
                } else if (grapher.yColumnsFromDimensions.length > 1) {
                    const entity = availableEntityNameSet.has(WorldEntityName)
                        ? WorldEntityName
                        : sample(availableEntityNames)
                    if (entity) selection.setSelectedEntities([entity])
                    grapher.addCountryMode = EntitySelectionMode.SingleEntity
                } else {
                    selection.setSelectedEntities(
                        availableEntityNames.length > 10
                            ? sampleSize(availableEntityNames, 3)
                            : availableEntityNames
                    )
                    grapher.addCountryMode =
                        EntitySelectionMode.MultipleEntities
                }
            }
        )
    }

    componentWillUnmount() {
        if (this.dispose) this.dispose()
    }

    @observable private draggingColumnSlug?: ColumnSlug

    @action.bound private updateLegacySelectionAndRebuildTable() {
        const { grapher } = this.props.editor

        grapher.setDimensionsForProperty(
            this.props.slot.property,
            this.dimensionsInSelectionOrder
        )
        this.grapher.updateAuthoredVersion({
            dimensions: grapher.dimensions.map((dim) => dim.toObject()),
        })
        this.grapher.rebuildInputOwidTable()
    }

    @action.bound private onMouseUp() {
        this.draggingColumnSlug = undefined
        window.removeEventListener("mouseup", this.onMouseUp)

        this.updateLegacySelectionAndRebuildTable()
    }

    @action.bound private onStartDrag(targetSlug: ColumnSlug) {
        this.draggingColumnSlug = targetSlug

        window.addEventListener("mouseup", this.onMouseUp)
    }

    @action.bound private onMouseEnter(targetSlug: ColumnSlug) {
        if (!this.draggingColumnSlug || targetSlug === this.draggingColumnSlug)
            return

        const dimensions = this.props.slot.dimensions

        const dragIndex = dimensions.findIndex(
            (dim) => dim.slug === this.draggingColumnSlug
        )
        const targetIndex = dimensions.findIndex(
            (dim) => dim.slug === targetSlug
        )

        const [draggedDimension] = dimensions.splice(dragIndex, 1)
        dimensions.splice(targetIndex, 0, draggedDimension)
    }

    @computed private get dimensionsInSelectionOrder() {
        return this.props.slot.dimensions
    }

    render() {
        const { isSelectingVariables } = this
        const { slot, editor } = this.props
        const canAddMore = slot.allowMultiple || slot.dimensions.length === 0

        return (
            <div>
                <h5>{slot.name}</h5>
                <EditableList>
                    {this.dimensionsInSelectionOrder.map((dim) => {
                        return (
                            dim.property === slot.property && (
                                <DimensionCard
                                    key={dim.columnSlug}
                                    dimension={dim}
                                    editor={editor}
                                    onEdit={
                                        slot.allowMultiple
                                            ? undefined
                                            : action(
                                                  () =>
                                                      (this.isSelectingVariables =
                                                          true)
                                              )
                                    }
                                    onMouseDown={() =>
                                        dim.property === "y" &&
                                        this.onStartDrag(dim.columnSlug)
                                    }
                                    onMouseEnter={() =>
                                        dim.property === "y" &&
                                        this.onMouseEnter(dim.columnSlug)
                                    }
                                    onRemove={
                                        slot.isOptional
                                            ? () =>
                                                  this.onRemoveDimension(
                                                      dim.variableId
                                                  )
                                            : undefined
                                    }
                                />
                            )
                        )
                    })}
                </EditableList>
                {canAddMore && (
                    <div
                        className="dimensionSlot"
                        onClick={action(
                            () => (this.isSelectingVariables = true)
                        )}
                    >
                        Add variable{slot.allowMultiple && "s"}
                    </div>
                )}
                {isSelectingVariables && (
                    <VariableSelector
                        editor={editor}
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
class VariablesSection extends React.Component<{ editor: ChartEditor }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref isAddingVariable: boolean = false

    render() {
        const { props } = this
        const { dimensionSlots } = props.editor.grapher

        return (
            <Section name="Add variables">
                {dimensionSlots.map((slot) => (
                    <DimensionSlotView
                        key={slot.name}
                        slot={slot}
                        editor={props.editor}
                    />
                ))}
            </Section>
        )
    }
}

@observer
export class EditorBasicTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onChartTypeChange(value: string) {
        const { grapher } = this.props.editor
        grapher.type = value as ChartTypeName

        if (grapher.isMarimekko) {
            grapher.hideRelativeToggle = false
            grapher.stackMode = StackMode.relative
        }

        if (!grapher.isScatter && !grapher.isSlopeChart) return

        // Give scatterplots and slope charts a default color and size dimension if they don't have one
        const hasColor = grapher.dimensions.find(
            (d) => d.property === DimensionProperty.color
        )
        const hasSize = grapher.dimensions.find(
            (d) => d.property === DimensionProperty.size
        )

        if (!hasColor)
            grapher.addDimension({
                variableId: 123,
                property: DimensionProperty.color,
            })

        if (!hasSize)
            grapher.addDimension({
                variableId: 72,
                property: DimensionProperty.size,
            })
    }

    render() {
        const { editor } = this.props
        const { grapher } = editor
        const chartTypes = Object.keys(ChartTypeName)

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
                <VariablesSection editor={editor} />
            </div>
        )
    }
}
