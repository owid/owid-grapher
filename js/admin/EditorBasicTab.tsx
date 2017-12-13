import * as React from 'react'
import { includes, sample, sampleSize } from '../charts/Util'
import { observable, action, reaction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import { DimensionSlot } from '../charts/ChartConfig'
import { ChartTypeDefs, ChartTypeType } from '../charts/ChartType'
import { Toggle, SelectField, EditableList, FieldsRow, Section } from './Forms'
import DimensionWithData from '../charts/DimensionWithData'
import ChartEditor, { Variable } from './ChartEditor'
import VariableSelector from './VariableSelector'
import DimensionCard from './DimensionCard'

@observer
class DimensionSlotView extends React.Component<{ slot: DimensionSlot, editor: ChartEditor }> {
    dispose: IReactionDisposer

    @observable.ref isSelectingVariables: boolean = false

    @action.bound onVariables(variableIds: number[]) {
        const { slot } = this.props

        slot.dimensions = variableIds.map(id => {
            const existingDimension = slot.dimensions.find(d => d.variableId === id)
            return existingDimension || slot.createDimension(id)
        })

        this.isSelectingVariables = false
        this.updateDefaults()
    }

    @action.bound onRemoveDimension(dim: DimensionWithData) {
        this.props.slot.dimensions = this.props.slot.dimensions.filter(d => d.variableId !== dim.variableId)
        this.updateDefaults()
    }

    updateDefaults() {
        const { chart } = this.props.editor

        if (this.dispose) this.dispose()
        this.dispose = reaction(
            () => chart.props.type && chart.data.primaryDimensions,
            () => {
                if (chart.isScatter || chart.isSlopeChart) {
                    chart.data.selectedKeys = []
                } else if (chart.data.primaryDimensions.length > 1) {
                    const entity = includes(chart.data.availableEntities, "World") ? "World" : sample(chart.data.availableEntities)
                    chart.data.selectedKeys = chart.data.availableKeys.filter(key => chart.data.lookupKey(key).entity === entity)
                    chart.props.addCountryMode = 'change-country'
                } else {
                    chart.data.selectedKeys = chart.data.availableKeys.length > 10 ? sampleSize(chart.data.availableKeys, 3) : chart.data.availableKeys
                    chart.props.addCountryMode = 'add-country'
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

        return <div>
            <h5>{slot.name}</h5>
            <EditableList>
                {slot.dimensionsWithData.map(dim => {
                    return dim.property === slot.property && <DimensionCard dimension={dim} editor={editor} onEdit={slot.allowMultiple ? undefined : action(() => this.isSelectingVariables = true)} onRemove={slot.isOptional ? () => this.onRemoveDimension(dim) : undefined} />
                })}
            </EditableList>
            {canAddMore && <div className="dimensionSlot" onClick={action(() => this.isSelectingVariables = true)}>Add variable{slot.allowMultiple && 's'}</div>}
            {isSelectingVariables && <VariableSelector editor={editor} slot={slot} onDismiss={action(() => this.isSelectingVariables = false)} onComplete={this.onVariables} />}
        </div>
    }
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }> {
    base: HTMLDivElement
    @observable.ref isAddingVariable: boolean = false
    @observable.struct unassignedVariables: Variable[] = []

    render() {
        const { props } = this
        const { dimensionSlots } = props.editor.chart

        return <Section name="Add variables">
            {dimensionSlots.map(slot => <DimensionSlotView slot={slot} editor={props.editor} />)}
        </Section>
    }
}

@observer
export default class EditorBasicTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onChartType(value: string) { this.props.editor.chart.props.type = (value as ChartTypeType) }

    render() {
        const { editor } = this.props
        const { chart } = editor

        return <div className="EditorBasicTab">
            <Section name="Type of chart">
                <SelectField value={chart.props.type} onValue={this.onChartType} options={ChartTypeDefs.map(def => def.key)} optionLabels={ChartTypeDefs.map(def => def.label)}/>
                <FieldsRow>
                    <Toggle label="Chart tab" value={chart.props.hasChartTab} onValue={value => chart.props.hasChartTab = value} />
                    <Toggle label="Map tab" value={chart.props.hasMapTab} onValue={value => chart.props.hasMapTab = value} />
                </FieldsRow>
            </Section>
            <VariablesSection editor={editor} />
        </div>
    }
}
