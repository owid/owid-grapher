import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'

import Admin from './Admin'
import Link from './Link'
import { LoadingBlocker, TextField, BindString, BindFloat, Toggle, FieldsRow } from './Forms'
import { VariableDisplaySettings } from '../charts/VariableData'
import ChartConfig from '../charts/ChartConfig'
import ChartFigureView from '../charts/ChartFigureView'
import Bounds from '../charts/Bounds'

class VariableSingleMeta {
    @observable id: number = 0
    @observable name: string = ""
    @observable unit: string = ""
    @observable shortUnit: string = ""
    @observable description: string = ""

    datasetId: number = 0
    datasetName: string = ""
    datasetNamespace: string = ""

    display: VariableDisplaySettings = new VariableDisplaySettings()
    vardata: string = ""

    constructor(json: any) {
        for (const key in this) {
            if (key === "display")
                _.extend(this.display, json.display)
            else
                this[key] = json[key]
        }
    }
}

@observer
export default class VariableEditPage extends React.Component<{ variableId: number }> {
    context!: { admin: Admin }
    @observable origVariable?: VariableSingleMeta
    @observable variable?: VariableSingleMeta
    @observable.ref vardata?: string
    @observable.ref chart?: ChartConfig

    @computed get isModified(): boolean {
        return JSON.stringify(this.variable) !== JSON.stringify(this.origVariable)
    }

    render() {
        const {variable} = this
        if (!variable) return null
        const isBulkImport = variable.datasetNamespace !== 'owid'

        return <main className="VariableEditPage">
            <ol className="breadcrumb">
                <li className="breadcrumb-item">{variable.datasetNamespace}</li>
                <li className="breadcrumb-item"><Link to={`/datasets/${variable.datasetId}`}>{variable.datasetName}</Link></li>
                <li className="breadcrumb-item active">{variable.name}</li>
            </ol>
            <form onSubmit={e => { e.preventDefault(); this.save() }}>
                <div className="row">
                    <div className="col">
                        <h3>Variable metadata</h3>
                        {isBulkImport ?
                            <p>This variable came from an automated import, so we can't change the original metadata manually.</p>
                        : <p>The core metadata for the variable. It's important to keep this consistent.</p>}
                        <BindString field="name" store={variable} label="Variable Name" disabled={isBulkImport}/>
                        <FieldsRow>
                            <BindString field="unit" store={variable} label="Unit of measurement" disabled={isBulkImport}/>
                            <BindString field="shortUnit" store={variable} label="Short (axis) unit" disabled={isBulkImport}/>
                        </FieldsRow>
                        <h3>Display settings</h3>
                        <p>These settings tell the grapher how to display the variable. They can also be changed in the chart editor.</p>
                        <BindString label="Display name" field="name" store={variable.display}/>
                        <FieldsRow>
                            <BindString label="Unit of measurement" field="unit" store={variable.display}/>
                            <BindString label="Short (axis) unit" field="shortUnit" store={variable.display}/>
                        </FieldsRow>
                        <FieldsRow>
                            <BindFloat label="Number of decimal places" field="numDecimalPlaces" store={variable.display} helpText={`A negative number here will round integers`}/>
                            <BindFloat label="Unit conversion factor" field="conversionFactor" store={variable.display} helpText={`Multiply all values by this amount`}/>
                        </FieldsRow>
                    </div>
                    {this.chart && <div className="col">
                        <div className="topbar">
                            <h3>Preview</h3>
                            <Link className="btn btn-secondary" to={`/charts/create?config=${JSON.stringify(this.chart.json)}`}>Edit as new chart</Link>
                        </div>
                        <ChartFigureView chart={this.chart}/>
                    </div>}
                </div>
                <input type="submit" className="btn btn-success" value="Update variable" disabled={!this.isModified}/>
            </form>
        </main>
    }

    async save() {
        if (this.variable)
            await this.context.admin.requestJSON(`/api/variables/${this.variable.id}`, { variable: this.variable }, "PUT")
    }

    @computed get chartConfig() {
        if (!this.variable) return undefined

        return {
            yAxis: { min: 0 },
            map: { variableId: this.variable.id },
            tab: "map",
            hasMapTab: true,
            dimensions: [{
                property: 'y',
                variableId: this.variable.id,
                display: _.clone(this.variable.display)
            }]
        }
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/variables/${this.props.variableId}.json`)
        runInAction(() => {
            this.origVariable = new VariableSingleMeta(json.variable)
            this.variable = new VariableSingleMeta(json.variable)
//            this.vardata = json.vardata

            const variable = this.variable
            this.chart = new ChartConfig(this.chartConfig as any)
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => {
            if (this.chart && this.chartConfig) {
                console.log(this.chartConfig)
                this.chart.update(this.chartConfig)
            }
        })
        this.getData()
    }

    componentDidUnmount() {
        this.dispose()
    }
}
