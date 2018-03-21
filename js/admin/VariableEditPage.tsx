import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'
import {Prompt, Redirect} from 'react-router-dom'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import Link from './Link'
import { LoadingBlocker, TextField, BindString, BindFloat, Toggle, FieldsRow } from './Forms'
import { VariableDisplaySettings } from '../charts/VariableData'
import ChartConfig from '../charts/ChartConfig'
import ChartFigureView from '../charts/ChartFigureView'
import ChartList, { ChartListItem } from './ChartList'
import Bounds from '../charts/Bounds'

interface VariablePageData {
    id: number
    name: string
    unit: string
    shortUnit: string
    description: string
    display: VariableDisplaySettings

    datasetId: number
    datasetName: string
    datasetNamespace: string

    charts: ChartListItem[]
    source: { id: number, name: string }
}

class VariableEditable {
    @observable name: string = ""
    @observable unit: string = ""
    @observable shortUnit: string = ""
    @observable description: string = ""
    @observable display: VariableDisplaySettings = new VariableDisplaySettings()

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
class VariableEditor extends React.Component<{ variable: VariablePageData }> {
    @observable newVariable!: VariableEditable
    @observable isDeleted: boolean = false

    // Store the original dataset to determine when it is modified
    componentWillMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.newVariable = new VariableEditable(this.props.variable)
        this.isDeleted = false
    }

    context!: { admin: Admin }
    @observable.ref chart?: ChartConfig

    @computed get isModified(): boolean {
        return JSON.stringify(this.newVariable) !== JSON.stringify(new VariableEditable(this.props.variable))
    }

    async delete() {
        const {variable} = this.props
        if (!window.confirm(`Really delete the variable ${variable.name}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`/api/variables/${variable.id}`, {}, "DELETE")

        if (json.success) {
            this.isDeleted = true
        }
    }

    render() {
        const {variable} = this.props
        const {newVariable} = this
        const isBulkImport = variable.datasetNamespace !== 'owid'

        if (this.isDeleted)
            return <Redirect to={`/datasets/${variable.datasetId}`}/>

        return <main className="VariableEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>
            <ol className="breadcrumb">
                <li className="breadcrumb-item">{variable.datasetNamespace}</li>
                <li className="breadcrumb-item"><Link to={`/datasets/${variable.datasetId}`}>{variable.datasetName}</Link></li>
                <li className="breadcrumb-item active">{variable.name}</li>
            </ol>
            <form onSubmit={e => { e.preventDefault(); this.save() }}>
                <div className="row">
                    <div className="col">
                        <section>
                            <h3>Variable metadata</h3>
                            {isBulkImport ?
                                <p>This variable came from an automated import, so we can't change the original metadata manually.</p>
                            : <p>The core metadata for the variable. It's important to keep this consistent.</p>}
                            <BindString field="name" store={newVariable} label="Variable Name" disabled={isBulkImport}/>
                            <FieldsRow>
                                <BindString field="unit" store={newVariable} label="Unit of measurement" disabled={isBulkImport}/>
                                <BindString field="shortUnit" store={newVariable} label="Short (axis) unit" disabled={isBulkImport}/>
                            </FieldsRow>
                            <BindString field="description" store={newVariable} label="Description" textarea disabled={isBulkImport}/>
                        </section>
                        <section>
                            <h3>Display settings</h3>
                            <p>These settings tell the grapher how to display the variable. They can also be changed in the chart editor.</p>
                            <BindString label="Display name" field="name" store={newVariable.display}/>
                            <FieldsRow>
                                <BindString label="Unit of measurement" field="unit" store={newVariable.display}/>
                                <BindString label="Short (axis) unit" field="shortUnit" store={newVariable.display}/>
                            </FieldsRow>
                            <FieldsRow>
                                <BindFloat label="Number of decimal places" field="numDecimalPlaces" store={newVariable.display} helpText={`A negative number here will round integers`}/>
                                <BindFloat label="Unit conversion factor" field="conversionFactor" store={newVariable.display} helpText={`Multiply all values by this amount`}/>
                            </FieldsRow>
                        </section>
                        <input type="submit" className="btn btn-success" value="Update variable"/>
                    </div>
                    {this.chart && <div className="col">
                        <div className="topbar">
                            <h3>Preview</h3>
                            <Link className="btn btn-secondary" to={`/charts/create/${encodeURIComponent(JSON.stringify(this.chartConfig))}`}>Edit as new chart</Link>
                        </div>
                        <ChartFigureView chart={this.chart}/>
                    </div>}
                </div>
                <section>
                    <h3>Source</h3>
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><Link to={`/sources/${variable.source.id}`}>{variable.source.name}</Link></td>
                            </tr>
                        </tbody>
                    </table>
                </section>
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={variable.charts}/>
                </section>
                <section>
                    <h3>Danger zone</h3>
                    <p>
                        Delete this variable and all data it contains. If there are any charts using this data, you must delete them individually first.
                    </p>
                    <div className="card-footer">
                        <button className="btn btn-danger" onClick={() => this.delete()}>Delete variable</button>
                    </div>
                </section>
            </form>
        </main>
    }

    async save() {
        const {variable} = this.props
        const json = await this.context.admin.requestJSON(`/api/variables/${variable.id}`, { variable: this.newVariable }, "PUT")

        if (json.success) {
            Object.assign(this.props.variable, this.newVariable)
        }
    }

    @computed get chartConfig() {
        return {
            yAxis: { min: 0 },
            map: { variableId: this.props.variable.id },
            tab: "map",
            hasMapTab: true,
            dimensions: [{
                property: 'y',
                variableId: this.props.variable.id,
                display: _.clone(this.newVariable.display)
            }]
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.chart = new ChartConfig(this.chartConfig as any)

        this.dispose = autorun(() => {
            if (this.chart && this.chartConfig) {
                this.chart.update(this.chartConfig)
            }
        })
    }

    componentDidUnmount() {
        this.dispose()
    }
}

@observer
export default class VariableEditPage extends React.Component<{ variableId: number }> {
    context!: { admin: Admin }
    @observable variable?: VariablePageData

    render() {
        return <AdminLayout>
            {this.variable && <VariableEditor variable={this.variable}/>}
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/variables/${this.props.variableId}.json`)
        runInAction(() => {
            this.variable = json.variable as VariablePageData
        })
    }

    componentDidMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.getData()
    }
}
