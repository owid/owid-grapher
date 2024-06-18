import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { observable, runInAction } from "mobx"
import { DbPlainTag } from "@ourworldindata/types"
import { TagBadge } from "./TagBadge.js"
import { Link } from "react-router-dom"
import { Button, Modal } from "antd"

@observer
export class TagsIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable tags: DbPlainTag[] = []
    @observable newTagName = ""
    @observable newTagSlug = ""
    @observable isAddingTag = false

    componentDidMount(): void {
        void this.getData()
        this.addTag = this.addTag.bind(this)
    }

    async getData() {
        const result = await this.context.admin.getJSON<{ tags: DbPlainTag[] }>(
            "/api/tags.json"
        )
        runInAction(() => {
            this.tags = result.tags
        })
    }

    async addTag() {
        await this.context.admin.requestJSON(
            "/api/tags/new",
            {
                name: this.newTagName,
                slug: this.newTagSlug || null,
            },
            "POST"
        )
        this.isAddingTag = false
        this.newTagName = ""
        this.newTagSlug = ""
        await this.getData()
    }

    addTagModal() {
        return (
            <Modal
                className="TagsIndexPage__add-tag-modal"
                open={this.isAddingTag}
                onCancel={() => (this.isAddingTag = false)}
            >
                <h3>Add tag</h3>
                <form>
                    <input
                        placeholder="Name"
                        value={this.newTagName}
                        onChange={(e) => (this.newTagName = e.target.value)}
                    />
                    <input
                        placeholder="Slug (optional)"
                        value={this.newTagSlug}
                        onChange={(e) => (this.newTagSlug = e.target.value)}
                    />
                    <Button disabled={!this.newTagName} onClick={this.addTag}>
                        Add
                    </Button>
                </form>
            </Modal>
        )
    }

    render() {
        return (
            <AdminLayout title="Categories">
                <main className="TagsIndexPage">
                    {this.addTagModal()}
                    <header className="TagsIndexPage__header">
                        <h2>Tags</h2>
                        <Button
                            type="primary"
                            onClick={() => (this.isAddingTag = true)}
                        >
                            Add tag
                        </Button>
                    </header>
                    <p>
                        This is every single tag we have in the database. To
                        organise them hierarchically, see the{" "}
                        <Link to="tag-graph">tag graph</Link>.
                    </p>
                    {this.tags.map((tag) => (
                        <TagBadge
                            key={tag.id}
                            tag={{
                                id: tag.id,
                                name: tag.name,
                            }}
                        />
                    ))}
                </main>
            </AdminLayout>
        )
    }
}
