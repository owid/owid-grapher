import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'
import { VariableDisplaySettings } from '../charts/VariableData'

import Admin from './Admin'
import { LoadingBlocker, TextField, BindString, BindFloat, Toggle, FieldsRow } from './Forms'

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
                <li className="breadcrumb-item active">{variable.datasetName}</li>
            </ol>
            <form>
                <div className="row">
                    <div className="col">
                        <h3>Variable metadata</h3>
                        {isBulkImport ?
                            <p>This variable came from an automated import, so we can't change the core metadata manually.</p>
                        : <p>The core metadata for the variable. It's important to keep this consistent.</p>}
                        <BindString field="name" store={variable} label="Variable Name" disabled={isBulkImport}/>
                        <BindString field="unit" store={variable} label="Unit of measurement" disabled={isBulkImport}/>
                        <BindString field="shortUnit" store={variable} label="Short unit" disabled={isBulkImport}/>
                        <h3>Display settings</h3>
                        <p>These settings give sensible defaults for how the grapher will render the variable. They can also be changed in the chart editor.</p>
                        <BindString label="Display name" field="name" store={variable.display}/>
                        <BindString label="Unit of measurement" field="unit" store={variable.display}/>
                        <BindString label="Short (axis) unit" field="shortUnit" store={variable.display}/>
                        <BindFloat label="Number of decimal places" field="numDecimalPlaces" store={variable.display} helpText={`A negative number here will round integers`}/>
                        <BindFloat label="Unit conversion factor" field="conversionFactor" store={variable.display} helpText={`Multiply all values by this amount`}/>
                    </div>
                    <div className="col">
                        <h3>Preview</h3>
                    </div>
                </div>
                <input type="submit" className="btn btn-success" value="Update variable" disabled={!this.isModified}/>
            </form>
        </main>
    }

    async save() {
        /*await this.context.admin.requestJSON(`/api/users/${this.props.userId}`, this.user, "PUT")
        this.isSaved = true*/
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/variables/${this.props.variableId}.json`)
        runInAction(() => {
            this.origVariable = new VariableSingleMeta(json.variable)
            this.variable = new VariableSingleMeta(json.variable)
            this.vardata = json.vardata
        })
    }

    componentDidMount() {
        this.getData()
    }
}
