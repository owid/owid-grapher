import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'
import {Prompt} from 'react-router'
const timeago = require('timeago.js')()

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import Link from './Link'
import { LoadingBlocker, TextField, BindString, Toggle, FieldsRow } from './Forms'
import ChartConfig from '../charts/ChartConfig'
import ChartFigureView from '../charts/ChartFigureView'
import Bounds from '../charts/Bounds'
import ChartList, { ChartListItem } from './ChartList'
import VariableList, { VariableListItem } from './VariableList'

class DatasetEditable {
    namespace: string = 'owid'
    @observable id: number = 0
    @observable name: string = ""
    @observable description: string = ""
    @observable variables: VariableListItem[] = []
    @observable charts: ChartListItem[] = []

    constructor(json: any) {
        for (const key in this) {
            this[key] = json[key]
        }
    }
}

@observer
export default class DatasetEditPage extends React.Component<{ datasetId: number }> {
    context!: { admin: Admin }
    @observable origDataset?: DatasetEditable
    @observable dataset?: DatasetEditable

    @computed get isModified(): boolean {
        return JSON.stringify(this.dataset) !== JSON.stringify(this.origDataset)
    }

    renderWithDataset() {
        const {dataset} = this
        if (!dataset) return null
        const isBulkImport = dataset.namespace !== 'owid'

        return <main className="DatasetEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>
            <ol className="breadcrumb">
                <li className="breadcrumb-item">{dataset.namespace}</li>
                <li className="breadcrumb-item active">{dataset.name}</li>
            </ol>
            <section>
                <h3>Dataset metadata</h3>
                <form onSubmit={e => { e.preventDefault(); this.save() }}>
                    {isBulkImport ?
                        <p>This dataset came from an automated import, so we can't change the original metadata manually.</p>
                    : <p>The core metadata for the dataset. It's important to keep this consistent.</p>}
                    <BindString field="name" store={dataset} label="Name" disabled={isBulkImport} required helpText="Short name for this collection of variables, followed by the source and year. Example: Government Revenue Data – ICTD (2016)"/>
                    <BindString field="description" store={dataset} label="Description" textarea disabled={isBulkImport}/>
                    <input type="submit" className="btn btn-success" value="Update dataset" disabled={!this.isModified}/>
                </form>
            </section>
            <section>
                <h3>Variables</h3>
                <VariableList variables={dataset.variables}/>
            </section>
            <section>
                <h3>Charts</h3>
                <ChartList charts={dataset.charts}/>
            </section>
        </main>
    }

    render() {
        return <AdminLayout>
            {this.dataset && this.renderWithDataset()}
        </AdminLayout>
    }

    async save() {
        if (this.dataset)
            await this.context.admin.requestJSON(`/api/datasets/${this.dataset.id}`, { dataset: this.dataset }, "PUT")
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/datasets/${this.props.datasetId}.json`)
        runInAction(() => {
            this.origDataset = new DatasetEditable(json.dataset)
            this.dataset = new DatasetEditable(json.dataset)
//            this.vardata = json.vardata

            const dataset = this.dataset
        })
    }

    componentDidMount() {
        this.getData()
    }

    componentWillReceiveProps() {
        this.getData()
    }
}
