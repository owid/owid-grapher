import { Component } from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction } from "mobx"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface RedirectListItem {
    id: number
    slug: string
    chartId: number
    chartSlug: string
}

interface RedirectRowProps {
    redirect: RedirectListItem
    onDelete: (redirect: RedirectListItem) => void
}

@observer
class RedirectRow extends Component<RedirectRowProps> {
    static contextType = AdminAppContext
    declare context: AdminAppContextType

    render() {
        const { redirect } = this.props

        return (
            <tr>
                <td>{redirect.slug}</td>
                <td>
                    <Link to={`/charts/${redirect.chartId}/edit`}>
                        {redirect.chartSlug}
                    </Link>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() => this.props.onDelete(redirect)}
                    >
                        Delete
                    </button>
                </td>
            </tr>
        )
    }
}

@observer
export class RedirectsIndexPage extends Component {
    static contextType = AdminAppContext
    declare context: AdminAppContextType

    @observable redirects: RedirectListItem[] = []

    @action.bound async onDelete(redirect: RedirectListItem) {
        if (
            !window.confirm(
                `Delete the redirect from ${redirect.slug}? This action may break existing embeds!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/redirects/${redirect.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            runInAction(() =>
                this.redirects.splice(this.redirects.indexOf(redirect), 1)
            )
        }
    }

    render() {
        const { redirects } = this

        return (
            <AdminLayout title="Chart Redirects">
                <main className="RedirectsIndexPage">
                    <FieldsRow>
                        <span>Showing {redirects.length} redirects</span>
                    </FieldsRow>
                    <p>
                        Redirects are automatically created when the slug of a
                        published chart is changed.
                    </p>
                    <table className="table table-bordered">
                        <tbody>
                            <tr>
                                <th>Slug</th>
                                <th>Redirects To</th>
                                <th></th>
                            </tr>
                            {redirects.map((redirect) => (
                                <RedirectRow
                                    key={redirect.id}
                                    redirect={redirect}
                                    onDelete={this.onDelete}
                                />
                            ))}
                        </tbody>
                    </table>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON("/api/redirects.json")
        runInAction(() => {
            this.redirects = json.redirects
        })
    }

    componentDidMount() {
        void this.getData()
    }
}
