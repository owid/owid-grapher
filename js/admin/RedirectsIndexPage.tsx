import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { Modal, LoadingBlocker, SearchField, FieldsRow, Pagination } from './Forms'
import Link from './Link'

interface RedirectListItem {
    id: number
    slug: string
    chartId: number
    chartSlug: string
}

@observer
class RedirectRow extends React.Component<{ redirect: RedirectListItem, onDelete: (redirect: RedirectListItem) => void }> {
    context!: { admin: Admin }

    render() {
        const {redirect} = this.props

        return <tr>
            <td>
                {redirect.slug}
            </td>
            <td><Link to={`/charts/${redirect.chartId}/edit`}>{redirect.chartSlug}</Link></td>
            <td>
                <button className="btn btn-danger" onClick={() => this.props.onDelete(redirect)}>Delete</button>
            </td>
        </tr>
    }
}

@observer
export default class RedirectsIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable redirects: RedirectListItem[] = []

    @action.bound async onDelete(redirect: RedirectListItem) {
        if (!window.confirm(`Delete the redirect from ${redirect.slug}? This action may break existing embeds!`))
            return

        const json = await this.context.admin.requestJSON(`/api/redirects/${redirect.id}`, {}, "DELETE")

        if (json.success) {
            runInAction(() => this.redirects.splice(this.redirects.indexOf(redirect), 1))
        }
    }

    render() {
        const {redirects} = this

        return <AdminLayout title="Redirects">
            <main className="RedirectsIndexPage">
                <FieldsRow>
                    <span>Showing {redirects.length} redirects</span>
                </FieldsRow>
                <p>Redirects are automatically created when the slug of a published chart is changed.</p>
                <table className="table table-bordered">
                    <tr>
                        <th>Slug</th>
                        <th>Redirects To</th>
                        <th></th>
                    </tr>
                    {redirects.map(redirect => <RedirectRow redirect={redirect} onDelete={this.onDelete}/>)}
                </table>
            </main>
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON("/api/redirects.json")
        runInAction(() => {
            this.redirects = json.redirects
        })
    }

    componentDidMount() {
        this.getData()
     }
}
