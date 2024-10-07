import React from "react"
import { observer } from "mobx-react"
import { action, computed, observable, runInAction } from "mobx"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { DbChartTagJoin } from "@ourworldindata/utils"
import {
    GetAllExplorersRoute,
    GetAllExplorersTagsRoute,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import { EditableTags } from "./EditableTags.js"
import cx from "classnames"

type ExplorerWithTags = {
    slug: string
    tags: DbChartTagJoin[]
}

@observer
export class ExplorerTagsPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable explorersWithTags: ExplorerWithTags[] = []
    @observable explorers: ExplorerProgram[] = []
    @observable tags: DbChartTagJoin[] = []
    @observable newExplorerSlug = ""
    @observable newExplorerTags: DbChartTagJoin[] = []

    componentDidMount() {
        void this.getData()
    }

    // Don't show explorers that already have tags
    @computed get filteredExplorers() {
        return this.explorers.filter((explorer) => {
            return !this.explorersWithTags.find((e) => e.slug === explorer.slug)
        })
    }

    render() {
        return (
            <AdminLayout title="Explorer Tags">
                <main className="ExplorerTags">
                    <h3>Explorer tags</h3>
                    <p>
                        This page is for managing the tags for each explorer.
                        Explorer data is currently stored in{" "}
                        <a href="https://github.com/owid/owid-content">git</a>,
                        but tags are stored in the database, which means it's
                        hard to strictly enforce{" "}
                        <a href="https://en.wikipedia.org/wiki/Referential_integrity">
                            referential integrity.
                        </a>
                    </p>
                    <p>
                        If you update an explorer's slug, you'll need to delete
                        the old row in this table and create a new one for the
                        new slug.
                    </p>

                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th style={{ width: "45%" }}>Explorer</th>
                                <th style={{ width: "45%" }}>Tags</th>
                                <th style={{ width: "10%" }}>Controls</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Existing Explorers Rows */}
                            {this.explorersWithTags.map((explorer) => {
                                const isSlugValid = this.explorers.find(
                                    (e) => e.slug === explorer.slug
                                )

                                return (
                                    <tr
                                        key={explorer.slug}
                                        className={cx({
                                            "table-danger": !isSlugValid,
                                        })}
                                    >
                                        <td>
                                            {explorer.slug}
                                            {isSlugValid ? null : (
                                                <p>
                                                    <strong>
                                                        ❗️ this slug doesn't
                                                        match any explorer in
                                                        the database - is it for
                                                        an explorer that has
                                                        been deleted or renamed?
                                                    </strong>
                                                </p>
                                            )}
                                        </td>
                                        <td>
                                            <EditableTags
                                                tags={explorer.tags}
                                                suggestions={this.tags}
                                                onSave={(tags) => {
                                                    void this.saveTags(
                                                        explorer.slug,
                                                        tags
                                                    )
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() =>
                                                    this.deleteExplorerTags(
                                                        explorer.slug
                                                    )
                                                }
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {/* New Explorer Row */}
                            <tr>
                                <td>
                                    <select
                                        value={this.newExplorerSlug}
                                        onChange={(e) => {
                                            this.newExplorerSlug =
                                                e.target.value
                                        }}
                                    >
                                        <option value="">
                                            Select an explorer
                                        </option>
                                        {this.filteredExplorers.map(
                                            (explorer) => (
                                                <option
                                                    key={explorer.slug}
                                                    value={explorer.slug}
                                                >
                                                    {explorer.slug}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </td>
                                <td>
                                    <EditableTags
                                        // This component clones the `tags` prop and doesn't rerender when that prop changes,
                                        // meaning the tags don't clear when you save a new explorer.
                                        // So we force a rerender by setting a key which updates when an explorer is created
                                        // Unfortunately it also resets if if you delete a row before saving the new explorer
                                        // But that seems like a rare edge case, and I don't want to rewrite the EditableTags component
                                        key={this.explorersWithTags.length}
                                        tags={[]}
                                        suggestions={this.tags}
                                        onSave={(tags) => {
                                            this.newExplorerTags = tags
                                        }}
                                    />
                                </td>
                                <td>
                                    <button
                                        className="btn btn-primary"
                                        disabled={
                                            !this.newExplorerSlug ||
                                            !this.newExplorerTags.length
                                        }
                                        title="Enter a slug and at least one tag to save"
                                        onClick={() => this.saveNewExplorer()}
                                    >
                                        Save
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const [{ tags }, explorersWithTags, explorers] = await Promise.all([
            this.context.admin.getJSON("/api/tags.json") as Promise<{
                tags: DbChartTagJoin[]
            }>,
            this.context.admin.getJSON(GetAllExplorersTagsRoute) as Promise<{
                explorers: ExplorerWithTags[]
            }>,
            this.context.admin.getJSON(GetAllExplorersRoute) as Promise<{
                explorers: ExplorerProgram[]
            }>,
        ])
        runInAction(() => {
            this.tags = tags
            this.explorersWithTags = explorersWithTags.explorers
            this.explorers = explorers.explorers
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

    async deleteExplorerTags(slug: string) {
        if (
            window.confirm(
                `Are you sure you want to delete the tags for "${slug}"?`
            )
        ) {
            await this.context.admin.requestJSON(
                `/api/explorer/${slug}/tags`,
                {},
                "DELETE"
            )
            await this.getData()
        }
    }

    @action.bound async saveNewExplorer() {
        await this.saveTags(this.newExplorerSlug, this.newExplorerTags)
        await this.getData()
        this.newExplorerTags = []
        this.newExplorerSlug = ""
    }
}
