import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'
import {Prompt} from 'react-router'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import Link from './Link'
import { LoadingBlocker, TextField, BindString, BindFloat, Toggle, FieldsRow } from './Forms'
import ChartConfig from '../charts/ChartConfig'
import ChartFigureView from '../charts/ChartFigureView'
import Bounds from '../charts/Bounds'

class DatasetSingleMeta {
    namespace: string = 'owid'
    @observable id: number = 0
    @observable name: string = ""

    constructor(json: any) {
        for (const key in this) {
            this[key] = json[key]
        }
    }
}

@observer
export default class DatasetEditPage extends React.Component<{ datasetId: number }> {
    context!: { admin: Admin }
    @observable origDataset?: DatasetSingleMeta
    @observable dataset?: DatasetSingleMeta

    @computed get isModified(): boolean {
        return JSON.stringify(this.dataset) !== JSON.stringify(this.origDataset)
    }

    renderWithDataset() {
        const {dataset} = this
        if (!dataset) return null
        const isBulkImport = dataset.namespace !== 'owid'

        return <main className="DatasetEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>,
            <ol className="breadcrumb">
                <li className="breadcrumb-item">{dataset.namespace}</li>
                <li className="breadcrumb-item"><Link to={`/datasets/${dataset.id}`}>{dataset.name}</Link></li>
                <li className="breadcrumb-item active">{dataset.name}</li>
            </ol>
            <form onSubmit={e => { e.preventDefault(); this.save() }}>
                <h3>dataset metadata</h3>
                {isBulkImport ?
                    <p>This dataset came from an automated import, so we can't change the original metadata manually.</p>
                : <p>The core metadata for the dataset. It's important to keep this consistent.</p>}
                <BindString field="name" store={dataset} label="dataset Name" disabled={isBulkImport}/>
                {/*<FieldsRow>
                    <BindString field="unit" store={dataset} label="Unit of measurement" disabled={isBulkImport}/>
                    <BindString field="shortUnit" store={dataset} label="Short (axis) unit" disabled={isBulkImport}/>
                </FieldsRow>*/}
                <input type="submit" className="btn btn-success" value="Update dataset" disabled={!this.isModified}/>
            </form>
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

    @computed get chartConfig() {
        if (!this.dataset) return undefined

        return {
            yAxis: { min: 0 },
            map: { datasetId: this.dataset.id },
            tab: "map",
            hasMapTab: true,
            dimensions: [{
                property: 'y',
                datasetId: this.dataset.id,
                display: _.clone(this.dataset.display)
            }]
        }
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/datasets/${this.props.datasetId}.json`)
        runInAction(() => {
            this.origDataset = new DatasetSingleMeta(json.dataset)
            this.dataset = new DatasetSingleMeta(json.dataset)
//            this.vardata = json.vardata

            const dataset = this.dataset
            this.chart = new ChartConfig(this.chartConfig as any)
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => {
            if (this.chart && this.chartConfig) {
                this.chart.update(this.chartConfig)
            }
        })

        this.getData()
    }

    componentDidUnmount() {
        this.dispose()
    }
}
