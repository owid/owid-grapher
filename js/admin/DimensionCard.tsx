import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import DimensionWithData from '../charts/DimensionWithData'
import ChartEditor from './ChartEditor'
import { Toggle, EditableListItem, BindAutoString, BindAutoFloat } from './Forms'

@observer
export default class DimensionCard extends React.Component<{ dimension: DimensionWithData, editor: ChartEditor, onEdit?: () => void, onRemove?: () => void }> {
    @observable.ref isExpanded: boolean = false

    @computed get hasExpandedOptions(): boolean {
        return this.props.dimension.property === 'y' || this.props.dimension.property === 'x'
    }

    @action.bound onToggleExpand() {
        this.isExpanded = !this.isExpanded
    }

    @action.bound onIsProjection(value: boolean) {
        this.props.dimension.props.isProjection = value || undefined
    }

    @action.bound onSaveToVariable(value: boolean) {
        this.props.dimension.props.saveToVariable = value || undefined
    }

    render() {
        const { dimension, editor } = this.props
        const { chart } = editor

        return <EditableListItem className="DimensionCard">
            <header>
                <div>
                    {this.hasExpandedOptions && <span className="clickable" onClick={this.onToggleExpand}><i className={"fa fa-chevron-" + (this.isExpanded ? 'up' : 'down')} /></span>}
                </div>
                <div>{dimension.variable.name}</div>
                <div>
                    {this.props.onEdit && <div className="clickable" onClick={this.props.onEdit}><i className="fa fa-exchange" /></div>}
                    {this.props.onRemove && <div className="clickable" onClick={this.props.onRemove}><i className="fa fa-times" /></div>}
                </div>
            </header>
            {this.isExpanded && <div>
                <BindAutoString label="Display name" field="displayName" store={dimension.props} auto={dimension.displayName}/>
                <BindAutoString label="Unit of measurement" field="unit" store={dimension.props} auto={dimension.unit} helpText={`Original database unit: ${dimension.variable.unit}`}/>
                <BindAutoString label="Short (axis) unit" field="shortUnit" store={dimension.props} auto={dimension.shortUnit}/>
                <BindAutoFloat label="Number of decimal places" field="numDecimalPlaces" store={dimension.props} auto={dimension.numDecimalPlaces} helpText={`A negative number here will round integers`}/>
                <BindAutoFloat label="Unit conversion factor" field="conversionFactor" store={dimension.props} auto={dimension.unitConversionFactor} helpText={`Multiply all values by this amount`}/>
                {(chart.isScatter || chart.isDiscreteBar) && <BindAutoFloat field="tolerance" store={dimension.props} auto={dimension.tolerance}/>}
                {chart.isLineChart && <Toggle label="Is projection" value={dimension.isProjection} onValue={this.onIsProjection} />}
                <hr className="ui divider"/>
                <Toggle label="Use these settings as defaults for future charts" value={!!dimension.props.saveToVariable} onValue={this.onSaveToVariable} />
            </div>}
        </EditableListItem>
    }
}
