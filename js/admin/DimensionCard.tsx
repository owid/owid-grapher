import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import DimensionWithData from '../charts/DimensionWithData'
import ChartEditor from './ChartEditor'
import { TextField, NumberField, Toggle, EditableListItem } from './Forms'
import { toString } from '../charts/Util'

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

    @action.bound onDisplayName(value: string) {
        this.props.dimension.props.displayName = value || undefined
    }

    @action.bound onUnit(value: string) {
        this.props.dimension.props.unit = value || undefined
    }

    @action.bound onShortUnit(value: string) {
        this.props.dimension.props.shortUnit = value || undefined
    }

    @action.bound onTolerance(value: number | undefined) {
        this.props.dimension.props.tolerance = value
    }

    @action.bound onConversionFactor(value: number | undefined) {
        this.props.dimension.props.conversionFactor = value
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
                    {this.props.onEdit && <span className="clickable" onClick={this.props.onEdit} style={{ 'margin-right': '10px' }}><i className="fa fa-exchange" /></span>}
                    {this.props.onRemove && <span className="clickable" onClick={this.props.onRemove} style={{ 'margin-right': '10px' }}><i className="fa fa-times" /></span>}
                </div>
                <div>{dimension.variable.name}</div>
                <div>
                    {this.hasExpandedOptions && <span className="clickable" onClick={this.onToggleExpand}><i className={"fa fa-chevron-" + (this.isExpanded ? 'up' : 'down')} /></span>}
                </div>
            </header>
            {this.isExpanded && <div>
                <TextField label="Display name" value={dimension.props.displayName} onValue={this.onDisplayName} placeholder={dimension.displayName} />
                <TextField label="Unit of measurement" value={dimension.props.unit} onValue={this.onUnit} placeholder={dimension.unit} helpText={`Original database unit: ${dimension.variable.unit}`}/>
                <TextField label="Short (axis) unit" value={dimension.props.shortUnit} onValue={this.onShortUnit} placeholder={dimension.shortUnit} />
                <NumberField label="Unit conversion factor" value={dimension.props.conversionFactor} onValue={this.onConversionFactor} placeholder={toString(dimension.unitConversionFactor)} />
                {(chart.isScatter || chart.isDiscreteBar) && <NumberField label="Tolerance" value={dimension.props.tolerance} onValue={this.onTolerance} placeholder={toString(dimension.tolerance)} />}
                {chart.isLineChart && <Toggle label="Is projection" value={dimension.isProjection} onValue={this.onIsProjection} />}
                <hr />
                <Toggle label="Use these settings as defaults for future charts" value={!!dimension.props.saveToVariable} onValue={this.onSaveToVariable} />
            </div>}
        </EditableListItem>
    }
}
