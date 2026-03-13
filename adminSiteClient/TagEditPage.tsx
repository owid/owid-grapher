import { Component } from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, makeObservable } from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import { DbChartTagJoin } from "@ourworldindata/utils"
import { AdminLayout } from "./AdminLayout.js"
import { BindString, Timeago, Toggle } from "./Forms.js"
import { DatasetListItem } from "./DatasetList.js"
import { ChartListItem } from "./ChartList.js"
import { TagBadge } from "./TagBadge.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AutoComplete, Flex, Table, TableColumnsType, Tag, Tabs } from "antd"

export type DrawerTab = "gdocs" | "charts" | "datasets" | "explorers"

export interface TagPageData {
    id: number
    name: string
    specialType?: string
    updatedAt: string
    datasets: DatasetListItem[]
    charts: ChartListItem[]
    children: DbChartTagJoin[]
    gdocs: {
        id: string
        title: string
        slug: string
        type: string
        published: number
    }[]
    explorers: {
        slug: string
        title: string
        isPublished: number
    }[]
    slug: string | null
    searchableInAlgolia: boolean
}

class TagEditable {
    name: string = ""
    slug: string | null = null
    searchableInAlgolia: boolean = false

    constructor(json: TagPageData) {
        makeObservable(this, {
            name: observable,
            slug: observable,
            searchableInAlgolia: observable,
        })
        for (const key in this) {
            this[key] = (json as any)[key]
        }
    }
}

@observer
export class TagEditor extends Component<{
    tag: TagPageData
    publishedGdocTopicSlugs: string[]
    activeTab?: DrawerTab | null
    /** When true, child lists won't sync search state to the URL */
    embedded?: boolean
}> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    newtag!: TagEditable
    isDeleted: boolean = false

    constructor(props: {
        tag: TagPageData
        publishedGdocTopicSlugs: string[]
        activeTab?: DrawerTab | null
        embedded?: boolean
    }) {
        super(props)

        makeObservable(this, {
            newtag: observable,
            isDeleted: observable,
        })
    }

    // Store the original tag to determine when it is modified
    override UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps(this.props)
    }
    override UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.newtag = new TagEditable(nextProps.tag)
        this.isDeleted = false
    }

    get slugMatchesPublishedTopicPage(): boolean {
        return (
            !!this.newtag.slug &&
            this.props.publishedGdocTopicSlugs.includes(this.newtag.slug)
        )
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
                `Really delete the tag ${tag.name}? This action cannot be undone!`
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

    override render() {
        const { tag, activeTab } = this.props
        const { newtag } = this

        const gdocColumns: TableColumnsType<TagPageData["gdocs"][number]> = [
            {
                title: "Title",
                dataIndex: "title",
                key: "title",
                render: (title: string, record) => (
                    <a href={`/admin/gdocs/${record.id}/preview`}>
                        {title || record.slug}
                    </a>
                ),
            },
            {
                title: "Type",
                dataIndex: "type",
                key: "type",
                width: 160,
            },
            {
                title: "Status",
                dataIndex: "published",
                key: "published",
                width: 120,
                render: (published: number) =>
                    published ? (
                        <Tag color="green">Published</Tag>
                    ) : (
                        <Tag>Unpublished</Tag>
                    ),
            },
        ]

        const chartColumns: TableColumnsType<ChartListItem> = [
            {
                title: "Title",
                key: "title",
                render: (_, record) => (
                    <a href={`/admin/charts/${record.id}/edit`}>
                        {record.title}
                        {record.variantName && (
                            <span style={{ color: "#999", marginLeft: 4 }}>
                                — {record.variantName}
                            </span>
                        )}
                    </a>
                ),
            },
            {
                title: "Id",
                dataIndex: "id",
                key: "id",
                width: 60,
            },
            {
                title: "Status",
                key: "status",
                width: 120,
                render: (_, record) =>
                    record.publishedAt ? (
                        <Tag color="green">Published</Tag>
                    ) : (
                        <Tag>Draft</Tag>
                    ),
            },
        ]

        const datasetColumns: TableColumnsType<DatasetListItem> = [
            {
                title: "Dataset",
                key: "name",
                render: (_, record) => (
                    <a href={`/admin/datasets/${record.id}`}>{record.name}</a>
                ),
            },
            {
                title: "Namespace",
                dataIndex: "namespace",
                key: "namespace",
                width: 120,
            },
            {
                title: "Uploaded",
                dataIndex: "dataEditedAt",
                key: "dataEditedAt",
                width: 160,
                render: (val: Date) => <Timeago time={val} />,
            },
        ]

        const explorerColumns: TableColumnsType<
            TagPageData["explorers"][number]
        > = [
            {
                title: "Title",
                dataIndex: "title",
                key: "title",
                render: (title: string, record) => (
                    <a href={`/admin/explorers/${record.slug}`}>{title}</a>
                ),
            },
            {
                title: "Status",
                dataIndex: "isPublished",
                key: "isPublished",
                width: 120,
                render: (isPublished: number) =>
                    isPublished ? (
                        <Tag color="green">Published</Tag>
                    ) : (
                        <Tag>Unpublished</Tag>
                    ),
            },
        ]

        const tableProps = {
            size: "small" as const,
            pagination: false as const,
        }

        const tabItems = [
            {
                key: "gdocs" as DrawerTab,
                label: `Gdocs (${tag.gdocs.length})`,
                children: (
                    <Table
                        {...tableProps}
                        columns={gdocColumns}
                        dataSource={tag.gdocs}
                        rowKey="id"
                    />
                ),
            },
            {
                key: "charts" as DrawerTab,
                label: `Charts (${tag.charts.length})`,
                children: (
                    <Table
                        {...tableProps}
                        columns={chartColumns}
                        dataSource={tag.charts}
                        rowKey="id"
                    />
                ),
            },
            {
                key: "datasets" as DrawerTab,
                label: `Datasets (${tag.datasets.length})`,
                children: (
                    <Table
                        {...tableProps}
                        columns={datasetColumns}
                        dataSource={tag.datasets}
                        rowKey="id"
                    />
                ),
            },
            {
                key: "explorers" as DrawerTab,
                label: `Explorers (${tag.explorers.length})`,
                children: (
                    <Table
                        {...tableProps}
                        columns={explorerColumns}
                        dataSource={tag.explorers}
                        rowKey="slug"
                    />
                ),
            },
        ]

        const { embedded } = this.props

        const canDelete =
            tag.datasets.length === 0 &&
            tag.charts.length === 0 &&
            tag.gdocs.length === 0 &&
            tag.explorers.length === 0 &&
            tag.children.length === 0 &&
            !tag.specialType

        const slugField = (
            <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Slug</label>
                <AutoComplete
                    style={{ width: "100%" }}
                    value={newtag.slug ?? ""}
                    onChange={(value) =>
                        runInAction(() => (newtag.slug = value || null))
                    }
                    options={this.props.publishedGdocTopicSlugs.map((slug) => ({
                        value: slug,
                        label: slug,
                    }))}
                    filterOption={(inputValue, option) =>
                        option?.value
                            .toLowerCase()
                            .includes(inputValue.toLowerCase()) ?? false
                    }
                    allowClear
                />
                {!embedded && (
                    <small className="form-text text-muted">
                        The slug for this tag's topic page, e.g.
                        trade-and-globalization.
                    </small>
                )}
            </div>
        )

        const nameField = (
            <BindString
                field="name"
                store={newtag}
                label="Name"
                helpText={
                    embedded
                        ? undefined
                        : "Tag names must be unique and should be able to be understood without context"
                }
            />
        )

        const searchableToggle = (
            <Toggle
                label="Searchable in Algolia (must exist in tag graph)"
                value={
                    newtag.searchableInAlgolia ||
                    this.slugMatchesPublishedTopicPage
                }
                onValue={(value) =>
                    runInAction(() => (newtag.searchableInAlgolia = value))
                }
                disabled={this.slugMatchesPublishedTopicPage}
                secondaryLabel={
                    embedded
                        ? undefined
                        : this.slugMatchesPublishedTopicPage
                          ? "This slug matches a published topic page, so charts with this tag will be indexed in Algolia"
                          : "When enabled, charts with this tag will be indexed in Algolia even without matching a published topic page"
                }
            />
        )

        const actionButtons = (
            <>
                <input
                    type="submit"
                    disabled={!this.isModified || !newtag.name}
                    className="btn btn-success"
                    value="Update tag"
                />{" "}
                {canDelete && (
                    <button
                        className="btn btn-danger"
                        type="button"
                        onClick={() => this.deleteTag()}
                    >
                        Delete tag
                    </button>
                )}
            </>
        )

        return (
            <main className="TagEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                {!embedded && (
                    <section>
                        <h1>Tag: {tag.name}</h1>
                        <p>
                            Last updated <Timeago time={tag.updatedAt} />
                        </p>
                    </section>
                )}
                <section>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            void this.save()
                        }}
                    >
                        {embedded ? (
                            <>
                                <Flex gap={12}>
                                    <div style={{ flex: 1 }}>{nameField}</div>
                                    <div style={{ flex: 1 }}>
                                        {slugField}
                                        <div style={{ marginTop: 4 }}>
                                            {searchableToggle}
                                        </div>
                                    </div>
                                </Flex>
                                <div style={{ marginTop: 8 }}>
                                    {actionButtons}
                                </div>
                            </>
                        ) : (
                            <>
                                {nameField}
                                {slugField}
                                {searchableToggle}
                                <div style={{ marginTop: 16 }}>
                                    {actionButtons}
                                </div>
                            </>
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
                <Tabs
                    defaultActiveKey={activeTab ?? "gdocs"}
                    items={tabItems}
                />
                {this.isDeleted && <Redirect to={`/tags`} />}
            </main>
        )
    }
}

@observer
export class TagEditPage extends Component<{ tagId: number }> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    tag: TagPageData | undefined = undefined
    publishedGdocTopicSlugs: string[] = []

    constructor(props: { tagId: number }) {
        super(props)

        makeObservable(this, {
            tag: observable,
            publishedGdocTopicSlugs: observable,
        })
    }

    override render() {
        return (
            <AdminLayout title={this.tag && this.tag.name}>
                {this.tag && (
                    <TagEditor
                        tag={this.tag}
                        publishedGdocTopicSlugs={this.publishedGdocTopicSlugs}
                    />
                )}
            </AdminLayout>
        )
    }

    async getData(tagId: number) {
        const [tagJson, slugsJson] = await Promise.all([
            this.context.admin.getJSON(`/api/tags/${tagId}.json`),
            this.context.admin.getJSON("/api/gdocs/publishedTopicSlugs"),
        ])
        runInAction(() => {
            this.tag = tagJson.tag as TagPageData
            this.publishedGdocTopicSlugs = slugsJson.slugs as string[]
        })
    }

    override componentDidMount() {
        void this.getData(this.props.tagId)
    }
    override UNSAFE_componentWillReceiveProps(nextProps: any) {
        void this.getData(nextProps.tagId)
    }
}
