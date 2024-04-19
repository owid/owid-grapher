import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import { DbChartTagJoin } from "@ourworldindata/utils"
import { AdminLayout } from "./AdminLayout.js"
import { BindString, NumericSelectField, FieldsRow, Timeago } from "./Forms.js"
import { DatasetList, DatasetListItem } from "./DatasetList.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { TagBadge } from "./TagBadge.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface TagPageData {
    id: number
    parentId?: number
    name: string
    specialType?: string
    updatedAt: string
    datasets: DatasetListItem[]
    charts: ChartListItem[]
    children: DbChartTagJoin[]
    possibleParents: DbChartTagJoin[]
    isBulkImport: boolean
    slug: string | null
}

class TagEditable {
    @observable name: string = ""
    @observable parentId?: number
    @observable slug: string | null = null

    constructor(json: TagPageData) {
        for (const key in this) {
            this[key] = (json as any)[key]
        }
    }
}

@observer
class TagEditor extends React.Component<{ tag: TagPageData }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable newtag!: TagEditable
    @observable isDeleted: boolean = false

    // Store the original tag to determine when it is modified
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps(this.props)
    }
    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.newtag = new TagEditable(nextProps.tag)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newtag) !==
            JSON.stringify(new TagEditable(this.props.tag))
        )
    }

    async save() {
        const { tag } = this.props
        const slug = this.newtag.slug || null
        const json = await this.context.admin.requestJSON(
            `/api/tags/${tag.id}`,
            { tag: { ...this.newtag, slug } },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.tag, this.newtag)
                this.props.tag.updatedAt = new Date().toString()
            })
        }
        if (json.tagUpdateWarning) {
            window.alert(json.tagUpdateWarning)
        }
    }

    async deleteTag() {
        const { tag } = this.props

        if (
            !window.confirm(
                `Really delete the category ${tag.name}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/tags/${tag.id}/delete`,
            {},
            "DELETE"
        )

        if (json.success) {
            runInAction(() => (this.isDeleted = true))
        }
    }

    @action.bound onChooseParent(parentId: number) {
        if (parentId === -1) {
            this.newtag.parentId = undefined
        } else {
            this.newtag.parentId = parentId
        }
    }

    @computed get parentTag() {
        const { parentId } = this.props.tag
        return parentId
            ? this.props.tag.possibleParents.find((c) => c.id === parentId)
            : undefined
    }

    render() {
        const { tag } = this.props
        const { newtag } = this

        return (
            <main className="TagEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <section>
                    <h1>Tag: {tag.name}</h1>
                    <p>
                        Last updated <Timeago time={tag.updatedAt} />
                    </p>
                </section>
                <section>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            void this.save()
                        }}
                    >
                        <BindString
                            disabled={tag.isBulkImport}
                            field="name"
                            store={newtag}
                            label="Name"
                            helpText="Category names should ideally be unique across the database and able to be understood without context"
                        />
                        {!tag.isBulkImport && (
                            <>
                                <BindString
                                    field="slug"
                                    store={newtag}
                                    label="Slug"
                                    helpText="The slug for this tag's topic page, e.g. trade-and-globalization. If specified, we assume this tag is a topic."
                                />
                                <FieldsRow>
                                    <NumericSelectField
                                        label="Parent Category"
                                        value={newtag.parentId || -1}
                                        options={[
                                            { value: -1, label: "None" },
                                        ].concat(
                                            tag.possibleParents.map((p) => ({
                                                value: p.id as number,
                                                label: p.name,
                                            }))
                                        )}
                                        onValue={this.onChooseParent}
                                    />
                                    <div>
                                        <br />
                                        {this.parentTag && (
                                            <TagBadge
                                                tag={
                                                    this
                                                        .parentTag as DbChartTagJoin
                                                }
                                            />
                                        )}
                                    </div>
                                </FieldsRow>
                            </>
                        )}
                        {!tag.isBulkImport && (
                            <div>
                                <input
                                    type="submit"
                                    className="btn btn-success"
                                    value="Update category"
                                />{" "}
                                {tag.datasets.length === 0 &&
                                    tag.children.length === 0 &&
                                    !tag.specialType && (
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => this.deleteTag()}
                                        >
                                            Delete category
                                        </button>
                                    )}
                            </div>
                        )}
                    </form>
                </section>
                {tag.children.length > 0 && (
                    <section>
                        <h3>Subcategories</h3>
                        {tag.children.map((c) => (
                            <TagBadge tag={c as DbChartTagJoin} key={c.id} />
                        ))}
                    </section>
                )}
                <section>
                    <h3>Datasets</h3>
                    <DatasetList datasets={tag.datasets} />
                </section>

                <section>
                    <h3>Charts</h3>
                    <ChartList charts={tag.charts} />
                </section>
                {this.isDeleted && <Redirect to={`/tags`} />}
            </main>
        )
    }
}

@observer
export class TagEditPage extends React.Component<{ tagId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable tag?: TagPageData

    render() {
        return (
            <AdminLayout title={this.tag && this.tag.name}>
                {this.tag && <TagEditor tag={this.tag} />}
            </AdminLayout>
        )
    }

    async getData(tagId: number) {
        const json = await this.context.admin.getJSON(`/api/tags/${tagId}.json`)
        runInAction(() => {
            this.tag = json.tag as TagPageData
        })
    }

    componentDidMount() {
        void this.getData(this.props.tagId)
    }
    UNSAFE_componentWillReceiveProps(nextProps: any) {
        void this.getData(nextProps.tagId)
    }
}
