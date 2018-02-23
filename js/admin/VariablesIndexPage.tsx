import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
const timeago = require('timeago.js')()
const fuzzysort = require("fuzzysort")
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { Modal, LoadingBlocker, SearchField, FieldsRow } from './Forms'
import Link from './Link'

interface VariableIndexMeta {
    id: number
    name: string
    uploadedAt: Date
    uploadedBy: string
}

@observer
class VariableRow extends React.Component<{ variable: VariableIndexMeta, highlight: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {variable, highlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>
                <Link to={`/variables/${variable.id}`}>{highlight(variable.name)}</Link>
            </td>
            <td>{timeago.format(variable.uploadedAt)} by {variable.uploadedBy ? variable.uploadedBy : "aibek"}</td>
        </tr>
    }
}

@observer
export default class VariablesIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable variables: VariableIndexMeta[] = []
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string

    @computed get variablesToShow(): VariableIndexMeta[] {
        return this.variables
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    render() {
        const {variablesToShow, searchInput, highlightSearch, numTotalRows} = this

        const highlight = (text: string) => {
            if (this.highlightSearch) {
                const html = text.replace(new RegExp(this.highlightSearch.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), s => `<b>${s}</b>`)
                return <span dangerouslySetInnerHTML={{__html: html}}/>
            } else
                return text
        }

        return <AdminLayout>
            <main className="DatasetsIndexPage">
                <FieldsRow>
                    <span>Showing {variablesToShow.length} of {numTotalRows} variables</span>
                    <SearchField placeholder="Search all variables..." value={searchInput} onValue={action((v: string) => this.searchInput = v)} autofocus/>
                </FieldsRow>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>Uploaded</th>
                        </tr>
                    </thead>
                        <tbody>
                        {variablesToShow.map(variable => <VariableRow variable={variable} highlight={highlight}/>)}
                    </tbody>
                </table>
                {!searchInput && <button className="btn btn-secondary" onClick={this.onShowMore}>Show more variables...</button>}
            </main>
        </AdminLayout>
    }

    async getData() {
        const {searchInput} = this
        const json = await this.context.admin.getJSON("/api/variables.json" + (searchInput ? `?search=${searchInput}` : ""))
        runInAction(() => {
            if (searchInput === this.searchInput) { // Make sure this response is current
                this.variables = json.variables
                this.numTotalRows = json.numTotalRows
                this.highlightSearch = searchInput
            }
        })
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput,
            _.debounce(() => this.getData(), 200)
        )
        this.getData()
     }

    componentDidUnmount() {
        this.dispose()
    }
}
