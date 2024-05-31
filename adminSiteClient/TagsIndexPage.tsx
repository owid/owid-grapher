import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { observable, runInAction } from "mobx"
import { DbPlainTag } from "@ourworldindata/types"
import { TagBadge } from "./TagBadge.js"

@observer
export class TagsIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable tags: DbPlainTag[] = []

    componentDidMount(): void {
        void this.getData()
    }

    async getData() {
        const result = await this.context.admin.getJSON<{ tags: DbPlainTag[] }>(
            "/api/tags.json"
        )
        runInAction(() => {
            this.tags = result.tags
        })
    }

    render() {
        return (
            <AdminLayout title="Categories">
                <main className="TagsIndexPage">
                    {this.tags.map((tag) => (
                        <TagBadge
                            key={tag.id}
                            tag={{
                                id: tag.id,
                                name: tag.name,
                                slug: tag.slug,
                            }}
                        />
                    ))}
                </main>
            </AdminLayout>
        )
    }
}
