import React from "react"
import { observer } from "mobx-react"
import { observable, runInAction } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { DbChartTagJoin } from "@ourworldindata/utils"
import { GetAllExplorersTagsRoute } from "../explorer/ExplorerConstants.js"
import { EditableTags } from "./EditableTags.js"

type ExplorerWithTags = {
    slug: string
    tags: DbChartTagJoin[]
}

@observer
export class ExplorerTagsPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable explorers: ExplorerWithTags[] = []
    @observable tags: DbChartTagJoin[] = []

    componentDidMount() {
        this.getData()
    }

    render() {
        return (
            <AdminLayout title="Explorer Tags">
                <main className="ExplorerTags">
                    <h3>Explorer tags</h3>
                    <p>
                        Explorer data is currently stored in Git. This is why
                        we're managing these tags (which are stored in the
                        database) on a separate page.
                    </p>
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th>Explorer</th>
                                <th>Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.explorers.map((explorer) => (
                                <tr key={explorer.slug}>
                                    <td>{explorer.slug}</td>
                                    <td>
                                        <EditableTags
                                            tags={explorer.tags}
                                            suggestions={this.tags}
                                            onSave={(tags) => {
                                                this.saveTags(
                                                    explorer.slug,
                                                    tags
                                                )
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { tags } = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => {
            this.tags = tags
        })
        const json = (await this.context.admin.getJSON(
            GetAllExplorersTagsRoute
        )) as {
            explorers: ExplorerWithTags[]
        }
        runInAction(() => {
            this.explorers = json.explorers
        })
    }

    async saveTags(slug: string, tags: DbChartTagJoin[]) {
        const tagIds = tags.map((tag) => tag.id)
        await this.context.admin.requestJSON(
            `/api/explorer/${slug}/tags`,
            {
                tagIds,
            },
            "POST"
        )
    }
}
