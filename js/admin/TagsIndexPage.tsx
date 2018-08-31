import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { FieldsRow } from './Forms'
import Link from './Link'

interface TagListItem {
    id: number
    slug: string
    chartId: number
    chartSlug: string
    name: string
    parentName: string
}

@observer
class RedirectRow extends React.Component<{ redirect: TagListItem, onDelete: (redirect: TagListItem) => void }> {
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
export default class CategoriesIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable tags: TagListItem[] = []

    @computed get parentCategories(): { name: string, tags: TagListItem[] }[] {
        const tagsByParent = _.groupBy(this.tags, c => c.parentName)
        return _.map(tagsByParent, (tags, parentName) => ({ name: parentName, tags: tags }))
    }

    render() {
        const {parentCategories} = this

        return <AdminLayout title="Tags">
            <main className="TagsIndexPage">
                <FieldsRow>
                    <span>Showing {this.tags.length} tags</span>
                </FieldsRow>
                <div className="cardHolder">
                    {parentCategories.map(parent =>
                        <section>
                            <h4>
                                {parent.name}
                            </h4>
                            {parent.tags.map(tag =>
                                <span className="badge badge-secondary">{tag.name}</span>
                            )}
                            <button className="btn btn-default">+ New Tag</button>
                        </section>
                    )}
                </div>
            </main>
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => {
            this.tags = json.tags
        })
    }

    componentDidMount() {
        this.getData()
     }
}
