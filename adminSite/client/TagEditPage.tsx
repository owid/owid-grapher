import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import { format } from "timeago.js"

import { AdminLayout } from "./AdminLayout"
import { BindString, NumericSelectField, FieldsRow } from "./Forms"
import { DatasetList, DatasetListItem } from "./DatasetList"
import { ChartList, ChartListItem } from "./ChartList"
import { TagBadge, Tag } from "./TagBadge"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"

interface TagPageData {
    id: number
    parentId?: number
    name: string
    specialType?: string
    updatedAt: string
    datasets: DatasetListItem[]
    charts: ChartListItem[]
    children: Tag[]
    possibleParents: Tag[]
    isBulkImport: boolean
}

class TagEditable {
    @observable name: string = ""
    @observable parentId?: number

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
    componentWillMount() {
        this.componentWillReceiveProps(this.props)
    }
    componentWillReceiveProps(nextProps: any) {
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
        const json = await this.context.admin.requestJSON(
            `/api/tags/${tag.id}`,
            { tag: this.newtag },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.tag, this.newtag)
                this.props.tag.updatedAt = new Date().toString()
            })
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
            ? this.props.tag.possibleParents.find(c => c.id === parentId)
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
                    <p>Last updated {format(tag.updatedAt)}</p>
                </section>
                <section>
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            this.save()
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
                            <FieldsRow>
                                <NumericSelectField
                                    label="Parent Category"
                                    value={newtag.parentId || -1}
                                    options={[-1].concat(
                                        tag.possibleParents.map(
                                            p => p.id as number
                                        )
                                    )}
                                    optionLabels={["None"].concat(
                                        tag.possibleParents.map(p => p.name)
                                    )}
                                    onValue={this.onChooseParent}
                                />
                                <div>
                                    <br />
                                    {this.parentTag && (
                                        <TagBadge tag={this.parentTag as Tag} />
                                    )}
                                </div>
                            </FieldsRow>
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
                        {tag.children.map(c => (
                            <TagBadge tag={c as Tag} key={c.id} />
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
        this.getData(this.props.tagId)
    }
    componentWillReceiveProps(nextProps: any) {
        this.getData(nextProps.tagId)
    }
}
