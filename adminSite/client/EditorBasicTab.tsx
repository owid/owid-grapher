import * as React from "react"
import { observable, action, reaction, IReactionDisposer } from "mobx"
import { observer } from "mobx-react"
import { sample, sampleSize, startCase } from "grapher/utils/Util"
import {
    EntitySelectionMode,
    ChartTypeName,
    DimensionProperty,
    WorldEntityName,
} from "grapher/core/GrapherConstants"
import { Toggle, SelectField, EditableList, FieldsRow, Section } from "./Forms"
import { ChartEditor } from "./ChartEditor"
import { VariableSelector } from "./VariableSelector"
import { DimensionCard } from "./DimensionCard"
import { DimensionSlot } from "grapher/chart/DimensionSlot"
import { LegacyVariableId } from "coreTable/LegacyVariableCode"

@observer
class DimensionSlotView extends React.Component<{
    slot: DimensionSlot
    editor: ChartEditor
}> {
    dispose!: IReactionDisposer

    @observable.ref isSelectingVariables: boolean = false

    @action.bound private onAddVariables(variableIds: LegacyVariableId[]) {
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

        this.props.editor.grapher.setDimensionsForProperty(
            slot.property,
            dimensionConfigs
        )

        this.isSelectingVariables = false
        this.updateDefaults()
    }

    @action.bound private onRemoveDimension(variableId: LegacyVariableId) {
        const { slot } = this.props

        this.props.editor.grapher.setDimensionsForProperty(
            slot.property,
            this.props.slot.dimensions.filter(
                (d) => d.variableId !== variableId
            )
        )

        this.updateDefaults()
    }

    private updateDefaults() {
        const { grapher } = this.props.editor
        const { table } = grapher
        const { availableEntityNames, availableEntityNameSet } = table

        if (this.dispose) this.dispose()
        this.dispose = reaction(
            () => grapher.type && grapher.yColumns,
            () => {
                if (grapher.isScatter || grapher.isSlopeChart) {
                    table.clearSelection()
                } else if (grapher.yColumns.length > 1) {
                    const entity = availableEntityNameSet.has(WorldEntityName)
                        ? WorldEntityName
                        : sample(availableEntityNames)
                    table.selectEntity(entity!)
                    grapher.addCountryMode = EntitySelectionMode.SingleEntity
                } else {
                    table.setSelectedEntities(
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

    render() {
        const { isSelectingVariables } = this
        const { slot, editor } = this.props
        const canAddMore = slot.allowMultiple || slot.dimensions.length === 0
        const dimensions = editor.grapher.dimensions

        return (
            <div>
                <h5>{slot.name}</h5>
                <EditableList>
                    {slot.dimensionsWithData.map((dim) => {
                        return (
                            dim.property === slot.property && (
                                <DimensionCard
                                    key={dimensions.indexOf(dim)}
                                    dimension={dim}
                                    editor={editor}
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
                        options={chartTypes}
                        optionLabels={chartTypes.map((key) => startCase(key))}
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
