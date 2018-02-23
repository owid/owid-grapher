import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
const timeago = require('timeago.js')()
const fuzzysort = require("fuzzysort")
import * as _ from 'lodash'

import FuzzySearch from '../charts/FuzzySearch'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { Modal, LoadingBlocker, SearchField, FieldsRow } from './Forms'
import Link from './Link'

interface DatasetIndexMeta {
    id: number
    name: string
    namespace: string
    description: string
    categoryName: string
    subcategoryName: string
    createdAt: Date
    updatedAt: Date
}

interface Searchable {
    dataset: DatasetIndexMeta
    term: string
}

@observer
class DatasetRow extends React.Component<{ dataset: DatasetIndexMeta, highlight: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {dataset, highlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>{dataset.namespace}</td>
            <td>
                <Link to={`/datasets/${dataset.id}`}>{highlight(dataset.name)}</Link>
            </td>
            <td>{dataset.description}</td>
            <td>{dataset.categoryName}</td>
            <td>{dataset.subcategoryName}</td>
            <td>{timeago.format(dataset.createdAt)}</td>
            <td>{timeago.format(dataset.updatedAt)}</td>
        </tr>
    }
}

@observer
export default class DatasetsIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable datasets: DatasetIndexMeta[] = []
    @observable maxVisibleRows = 50
    @observable searchInput?: string

    @computed get searchIndex(): Searchable[] {
        const searchIndex: Searchable[] = []
        for (const dataset of this.datasets) {
            searchIndex.push({
                dataset: dataset,
                term: fuzzysort.prepare(dataset.name)
            })
        }

        return searchIndex
    }

    @computed get datasetsToShow(): DatasetIndexMeta[] {
        const {searchInput, searchIndex, maxVisibleRows} = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: 'term'
            })
            return _.uniq(results.map((result: any) => result.obj.dataset))
        } else {
            return this.datasets.slice(0, maxVisibleRows)
        }
    }

    @computed get namespaces() {
        return _.uniq(this.datasets.map(d => d.namespace))
    }

    @computed get numTotalRows(): number {
        return this.datasets.length
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    render() {
        const {datasetsToShow, searchInput, numTotalRows} = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html = fuzzysort.highlight(fuzzysort.single(this.searchInput, text)) || text
                return <span dangerouslySetInnerHTML={{__html: html}}/>
            } else
                return text
        }

        return <AdminLayout>
            <main className="DatasetsIndexPage">
                <FieldsRow>
                    <span>Showing {datasetsToShow.length} of {numTotalRows} datasets</span>
                    <SearchField placeholder="Search all datasets..." value={searchInput} onValue={this.onSearchInput} autofocus/>
                </FieldsRow>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Dataspace</th>
                            <th>Dataset</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th>Subcategory</th>
                            <th>Created</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                        <tbody>
                        {datasetsToShow.map(dataset => <DatasetRow dataset={dataset} highlight={highlight}/>)}
                    </tbody>
                </table>
                {!searchInput && <button className="btn btn-secondary" onClick={this.onShowMore}>Show more datasets...</button>}
            </main>
        </AdminLayout>
    }

    async getData() {
        const {admin} = this.context
        if (admin.currentRequests.length > 0)
            return

        const json = await admin.getJSON("/api/datasets.json")
        runInAction(() => {
            this.datasets = json.datasets
        })
    }

    componentDidMount() {
        this.getData()
     }
}
