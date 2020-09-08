import * as React from "react"
import { observable, action, reaction, IReactionDisposer } from "mobx"
import { observer } from "mobx-react"

import { includes, sample, sampleSize } from "grapher/utils/Util"
import { ChartTypeDefs, ChartTypeName } from "grapher/core/GrapherConstants"
import {
    ChartDimension,
    ChartDimensionSpec,
} from "grapher/chart/ChartDimension"

import { Toggle, SelectField, EditableList, FieldsRow, Section } from "./Forms"
import { ChartEditor } from "./ChartEditor"
import { VariableSelector } from "./VariableSelector"
import { DimensionCard } from "./DimensionCard"
import { DimensionSlot } from "grapher/chart/DimensionSlot"
import { canBeExplorable } from "explorer/indicatorExplorer/IndicatorUtils"

@observer
class DimensionSlotView extends React.Component<{
    slot: DimensionSlot
    editor: ChartEditor
}> {
    dispose!: IReactionDisposer

    @observable.ref isSelectingVariables: boolean = false

    @action.bound onVariables(variableIds: number[]) {
        const { slot } = this.props

        slot.dimensions = variableIds.map((id) => {
            const existingDimension = slot.dimensions.find(
                (d) => d.variableId === id
            )
            return existingDimension || slot.createDimension(id)
        })

        this.isSelectingVariables = false
        this.updateDefaults()
    }

    @action.bound onRemoveDimension(dim: ChartDimension) {
        this.props.slot.dimensions = this.props.slot.dimensions.filter(
            (d) => d.variableId !== dim.variableId
        )
        this.updateDefaults()
    }

    updateDefaults() {
        const { grapher } = this.props.editor

        if (this.dispose) this.dispose()
        this.dispose = reaction(
            () => grapher.type && grapher.primaryDimensions,
            () => {
                if (grapher.isScatter || grapher.isSlopeChart) {
                    grapher.selectedKeys = []
                } else if (grapher.primaryDimensions.length > 1) {
                    const entityName = includes(
                        grapher.availableEntityNames,
                        "World"
                    )
                        ? "World"
                        : sample(grapher.availableEntityNames)
                    grapher.selectedKeys = grapher.availableKeys.filter(
                        (key) =>
                            grapher.lookupKey(key).entityName === entityName
                    )
                    grapher.addCountryMode = "change-country"
                } else {
                    grapher.selectedKeys =
                        grapher.availableKeys.length > 10
                            ? sampleSize(grapher.availableKeys, 3)
                            : grapher.availableKeys
                    grapher.addCountryMode = "add-country"
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

        return (
            <div>
                <h5>{slot.name}</h5>
                <EditableList>
                    {slot.dimensionsWithData.map((dim) => {
                        return (
                            dim.property === slot.property && (
                                <DimensionCard
                                    key={dim.index}
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
                                            ? () => this.onRemoveDimension(dim)
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
                        onComplete={this.onVariables}
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
    @action.bound onChartType(value: string) {
        const { grapher } = this.props.editor
        grapher.type = value as ChartTypeName

        // Give scatterplots and slope charts a default color and size dimension if they don't have one
        if (
            (grapher.isScatter || grapher.isSlopeChart) &&
            !grapher.dimensions.find((d) => d.property === "color")
        ) {
            grapher.dimensions = grapher.dimensions.concat(
                new ChartDimensionSpec({ variableId: 123, property: "color" })
            )
        }

        if (
            (grapher.isScatter || grapher.isSlopeChart) &&
            !grapher.dimensions.find((d) => d.property === "color")
        ) {
            grapher.dimensions = grapher.dimensions.concat(
                new ChartDimensionSpec({ variableId: 72, property: "size" })
            )
        }
    }

    render() {
        const { editor } = this.props
        const { grapher } = editor

        return (
            <div className="EditorBasicTab">
                <Section name="Type of chart">
                    <SelectField
                        value={grapher.type}
                        onValue={this.onChartType}
                        options={ChartTypeDefs.map((def) => def.key)}
                        optionLabels={ChartTypeDefs.map((def) => def.label)}
                    />
                    {editor.features.explorer && (
                        <FieldsRow>
                            <Toggle
                                label="Explorable chart"
                                value={grapher.isExplorableConstrained}
                                onValue={(value) =>
                                    (grapher.isExplorable = value)
                                }
                                disabled={!canBeExplorable(grapher)}
                            />
                        </FieldsRow>
                    )}
                    <FieldsRow>
                        <Toggle
                            label="Chart tab"
                            value={grapher.hasChartTab}
                            onValue={(value) => (grapher.hasChartTab = value)}
                            disabled={grapher.isExplorableConstrained}
                        />
                        <Toggle
                            label="Map tab"
                            value={grapher.hasMapTab}
                            onValue={(value) => (grapher.hasMapTab = value)}
                            disabled={grapher.isExplorableConstrained}
                        />
                    </FieldsRow>
                </Section>
                <VariablesSection editor={editor} />
            </div>
        )
    }
}
