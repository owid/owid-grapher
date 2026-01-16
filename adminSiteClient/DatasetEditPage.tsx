import { Component } from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action, makeObservable } from "mobx"
import * as lodash from "lodash-es"
import { Prompt } from "react-router-dom"

import { OwidSource, DbChartTagJoin, OwidOrigin } from "@ourworldindata/utils"

import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { BindString, Toggle, FieldsRow, Timeago, TextField } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { OriginList } from "./OriginList.js"
import { SourceList } from "./SourceList.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import {
    BAKED_BASE_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
    ETL_WIZARD_URL,
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import {
    SearchWord,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload, faHatWizard } from "@fortawesome/free-solid-svg-icons"
import { Button } from "antd"
import urljoin from "url-join"

interface ExplorerListItem {
    slug: string
    title: string | null
    isPublished: boolean
    createdAt: string
    lastEditedAt: string
    lastEditedByUserName: string | null
    pageviewsPerDay: number
}

interface MultiDimListItem {
    id: number
    slug: string | null
    catalogPath: string
    title: string | null
    titleVariant: string | null
    published: boolean
    createdAt: string
    updatedAt: string
    pageviewsPerDay: number
}

interface DatasetPageData {
    id: number
    name: string
    description: string
    namespace: string
    shortName: string
    version: string
    isPrivate: boolean
    isArchived: boolean
    nonRedistributable: boolean
    updatePeriodDays: number

    dataEditedAt: Date
    dataEditedByUserId: number
    dataEditedByUserName: string

    metadataEditedAt: Date
    metadataEditedByUserId: number
    metadataEditedByUserName: string

    availableTags: { id: number; name: string }[]
    tags: { id: number; name: string }[]
    variables: VariableListItem[]
    charts: ChartListItem[]
    variableSources: OwidSource[]

    origins: OwidOrigin[]
    explorers: ExplorerListItem[]
    multiDims: MultiDimListItem[]
}

class DatasetEditable {
    name: string = ""
    description: string = ""
    isPrivate: boolean = false
    nonRedistributable: boolean = false
    updatePeriodDays: number | undefined = undefined

    source: OwidSource = {
        id: -1,
        name: "",
        dataPublishedBy: "",
        dataPublisherSource: "",
        link: "",
        retrievedDate: "",
        additionalInfo: "",
    }

    tags: DbChartTagJoin[] = []

    constructor(json: DatasetPageData) {
        makeObservable(this, {
            name: observable,
            description: observable,
            isPrivate: observable,
            nonRedistributable: observable,
            updatePeriodDays: observable,
            source: observable,
            tags: observable,
        })
        for (const key in this) {
            if (key in json) {
                if (key === "tags") this.tags = lodash.clone(json.tags)
                else this[key] = (json as any)[key]
            }
        }
    }
}

interface ExplorerListProps {
    explorers: ExplorerListItem[]
}

@observer
class ExplorerList extends Component<ExplorerListProps> {
    constructor(props: ExplorerListProps) {
        super(props)
        makeObservable(this)
    }

    override render() {
        const { explorers } = this.props

        if (explorers.length === 0) {
            return <p>No explorers use variables from this dataset.</p>
        }

        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th className="table-preview-col">Preview</th>
                        <th>Slug</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Views per day</th>
                        <th>Last updated</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {explorers.map((explorer) => (
                        <tr key={explorer.slug}>
                            <td className="table-preview-col table-preview-col--centered">
                                {explorer.isPublished ? (
                                    <a
                                        href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${explorer.slug}`}
                                    >
                                        <img
                                            src={`${EXPLORER_DYNAMIC_THUMBNAIL_URL}/${explorer.slug}.png`}
                                            width={850}
                                            height={600}
                                            className="chartPreview"
                                        />
                                    </a>
                                ) : null}
                            </td>
                            <td>
                                <Link
                                    native
                                    to={`/${EXPLORERS_ROUTE_FOLDER}/${explorer.slug}`}
                                >
                                    {explorer.slug}
                                </Link>
                            </td>
                            <td>{explorer.title || <em>No title</em>}</td>
                            <td>
                                {explorer.isPublished ? (
                                    <a
                                        href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${explorer.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Published
                                    </a>
                                ) : (
                                    <span className="text-secondary">
                                        Unpublished
                                    </span>
                                )}
                            </td>
                            <td>
                                {explorer.pageviewsPerDay?.toLocaleString() ??
                                    "0"}
                            </td>
                            <td>
                                <Timeago
                                    time={explorer.lastEditedAt}
                                    by={explorer.lastEditedByUserName}
                                />
                            </td>
                            <td>
                                <Timeago time={explorer.createdAt} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )
    }
}

interface MultiDimListProps {
    multiDims: MultiDimListItem[]
}

/**
 * Helper function to extract directory path from catalog path
 * Example: "health/latest/vaccination_coverage#vaccination_coverage" -> "health/latest"
 */
function getGitHubPathFromCatalogPath(catalogPath: string): string | null {
    // Remove everything after and including the # if present
    const pathWithoutFragment = catalogPath.split("#")[0]
    // Get directory path (everything before the last /)
    const parts = pathWithoutFragment.split("/")
    return parts.slice(0, -1).join("/")
}

@observer
class MultiDimList extends Component<MultiDimListProps> {
    constructor(props: MultiDimListProps) {
        super(props)
        makeObservable(this)
    }

    override render() {
        const { multiDims } = this.props

        if (multiDims.length === 0) {
            return (
                <p>
                    No multi-dimensional data pages use variables from this
                    dataset.
                </p>
            )
        }

        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th className="table-preview-col">Preview</th>
                        <th>Slug</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Views per day</th>
                        <th>Last updated</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {multiDims.map((mdim) => (
                        <tr key={mdim.id}>
                            <td className="table-preview-col table-preview-col--centered">
                                {mdim.published && mdim.slug ? (
                                    <a
                                        href={`${BAKED_GRAPHER_URL}/${mdim.slug}`}
                                    >
                                        <img
                                            src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${mdim.slug}.png`}
                                            height={600}
                                            width={850}
                                            className="chartPreview"
                                        />
                                    </a>
                                ) : null}
                            </td>
                            <td>
                                {mdim.slug ? (
                                    (() => {
                                        const githubPath =
                                            getGitHubPathFromCatalogPath(
                                                mdim.catalogPath
                                            )
                                        return githubPath ? (
                                            <a
                                                href={`https://github.com/owid/etl/tree/master/etl/steps/export/multidim/${githubPath}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {mdim.slug}
                                            </a>
                                        ) : (
                                            mdim.slug
                                        )
                                    })()
                                ) : (
                                    <em>No slug</em>
                                )}
                            </td>
                            <td>
                                {mdim.title ? (
                                    <>
                                        {mdim.title}
                                        {mdim.titleVariant && (
                                            <>, {mdim.titleVariant}</>
                                        )}
                                    </>
                                ) : (
                                    <em>No title</em>
                                )}
                            </td>
                            <td>
                                {mdim.published ? (
                                    mdim.slug ? (
                                        <a
                                            href={`${BAKED_GRAPHER_URL}/${mdim.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Published
                                        </a>
                                    ) : (
                                        "Published"
                                    )
                                ) : (
                                    <span className="text-secondary">
                                        Unpublished
                                    </span>
                                )}
                            </td>
                            <td>
                                {mdim.pageviewsPerDay?.toLocaleString() ?? "0"}
                            </td>
                            <td>
                                <Timeago time={mdim.updatedAt} />
                            </td>
                            <td>
                                <Timeago time={mdim.createdAt} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )
    }
}

interface DatasetTagEditorProps {
    newDataset: DatasetEditable
    availableTags: {
        id: number
        name: string
    }[]
}

@observer
class DatasetTagEditor extends Component<DatasetTagEditorProps> {
    constructor(props: DatasetTagEditorProps) {
        super(props)
        makeObservable(this)
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        this.props.newDataset.tags = tags
    }

    override render() {
        const { newDataset, availableTags } = this.props

        return (
            <div className="form-group">
                <label>Tags</label>
                <EditableTags
                    tags={newDataset.tags}
                    suggestions={availableTags}
                    onSave={this.onSaveTags}
                />
            </div>
        )
    }
}

interface DatasetEditorProps {
    dataset: DatasetPageData
}

@observer
class DatasetEditor extends Component<DatasetEditorProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType
    newDataset!: DatasetEditable

    // HACK (Mispy): Force variable refresh when dataset metadata is updated
    timesUpdated: number = 0

    // Tab management
    activeTab: string = "metadata"
    searchInput: string = ""

    constructor(props: DatasetEditorProps) {
        super(props)

        makeObservable(this, {
            newDataset: observable,
            timesUpdated: observable,
            activeTab: observable,
            searchInput: observable,
        })
    }

    // Store the original dataset to determine when it is modified
    override UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    override UNSAFE_componentWillReceiveProps() {
        this.newDataset = new DatasetEditable(this.props.dataset)
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newDataset) !==
            JSON.stringify(new DatasetEditable(this.props.dataset))
        )
    }

    @computed get searchWords(): SearchWord[] {
        return buildSearchWordsFromSearchString(this.searchInput)
    }

    @computed get filteredVariables(): VariableListItem[] {
        const { dataset } = this.props
        const { searchWords } = this

        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (variable: VariableListItem) => [
                    variable.name,
                    variable.namespace,
                    variable.dataset,
                    variable.table,
                    variable.shortName,
                    `${variable.id}`,
                ]
            )
            return dataset.variables.filter(filterFn)
        }
        return dataset.variables
    }

    @computed get collectionUrl(): string | null {
        const { dataset } = this.props
        const publishedCharts = dataset.charts.filter(
            (chart) => chart.isPublished
        )

        if (publishedCharts.length === 0) {
            return null
        }

        // Sort by pageviews descending (most views first)
        const sortedSlugs = publishedCharts
            .sort((a, b) => b.pageviewsPerDay - a.pageviewsPerDay)
            .map((chart) => chart.slug)

        const chartsParam = sortedSlugs.join("+")
        return `https://ourworldindata.org/collection/custom?charts=${chartsParam}`
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onTabChange(tab: string) {
        this.activeTab = tab
    }

    async save() {
        const { dataset } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}`,
            { dataset: this.newDataset },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.dataset, this.newDataset)
                this.timesUpdated += 1
            })
        }
    }

    async archive() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Are you sure you want to archive: ${dataset.name}?`
            )
        ) {
            return
        }
        await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/setArchived`,
            {},
            "POST"
        )
    }

    async republishCharts() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Are you sure you want to republish all charts in ${dataset.name}?`
            )
        ) {
            return
        }

        await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/charts`,
            { republish: true },
            "POST"
        )
    }

    renderTabContent() {
        const { dataset } = this.props
        const { newDataset, activeTab, searchInput, filteredVariables } = this
        const highlight = highlightFunctionForSearchWords(this.searchWords)

        switch (activeTab) {
            case "metadata":
                return (
                    <section>
                        <h3>Dataset metadata</h3>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                void this.save()
                            }}
                        >
                            <p>
                                Metadata is non-editable and can be only changed
                                in ETL.
                            </p>
                            <div className="row">
                                <div className="col">
                                    <BindString
                                        field="name"
                                        store={newDataset}
                                        label="Name"
                                        secondaryLabel="DB field: datasets.name"
                                        disabled
                                        helpText="Short name for this dataset, followed by the source and year. Example: Government Revenue Data – ICTD (2016)"
                                    />
                                    <DatasetTagEditor
                                        newDataset={newDataset}
                                        availableTags={dataset.availableTags}
                                    />
                                    <FieldsRow>
                                        <Toggle
                                            label="Is publishable (include in exported OWID collection)"
                                            value={!newDataset.isPrivate}
                                            onValue={(v) =>
                                                (newDataset.isPrivate = !v)
                                            }
                                            disabled={
                                                newDataset.nonRedistributable
                                            }
                                        />
                                    </FieldsRow>
                                    <FieldsRow>
                                        <Toggle
                                            label="Redistribution is prohibited (disable chart data download)"
                                            value={
                                                newDataset.nonRedistributable
                                            }
                                            onValue={(v) => {
                                                newDataset.nonRedistributable =
                                                    v
                                            }}
                                            disabled
                                        />
                                    </FieldsRow>
                                </div>
                                <div className="col">
                                    <BindString
                                        label="Number of days between OWID updates"
                                        field="updatePeriodDays"
                                        store={newDataset}
                                        disabled
                                        helpText="Date when this data was obtained by us. Date format should always be YYYY-MM-DD."
                                    />
                                    <BindString
                                        field="description"
                                        store={newDataset}
                                        label="Internal notes"
                                        secondaryLabel="DB field: datasets.description"
                                        textarea
                                        disabled
                                    />
                                </div>
                            </div>
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update dataset"
                            />
                        </form>

                        {/* ORIGINS */}
                        <h3 className="mt-4">Origins</h3>
                        <OriginList origins={dataset.origins || []} />

                        {/* SOURCES */}
                        {dataset.variableSources &&
                            dataset.variableSources.length > 0 && (
                                <>
                                    <h3 className="mt-4">Sources</h3>
                                    <SourceList
                                        sources={dataset.variableSources}
                                    />
                                </>
                            )}
                    </section>
                )

            case "indicators":
                return (
                    <section>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h3>Indicators</h3>
                            <TextField
                                placeholder="Search indicators..."
                                value={searchInput}
                                onValue={this.onSearchInput}
                            />
                        </div>
                        <p>
                            Showing {filteredVariables.length} of{" "}
                            {dataset.variables.length} indicators
                            {searchInput && <> for "{searchInput}"</>}
                        </p>
                        <VariableList
                            variables={filteredVariables}
                            fields={[]}
                            searchHighlight={highlight}
                        />
                    </section>
                )

            case "charts":
                return (
                    <section>
                        <button
                            className="btn btn-primary float-right"
                            onClick={() => this.republishCharts()}
                        >
                            Republish all charts
                        </button>
                        <h3>Charts</h3>
                        <ChartList charts={dataset.charts} />
                    </section>
                )

            case "explorers":
                return (
                    <section>
                        <h3>Explorers</h3>
                        <ExplorerList explorers={dataset.explorers} />
                    </section>
                )

            case "multiDims":
                return (
                    <section>
                        <h3>Multi-dimensional data pages</h3>
                        <MultiDimList multiDims={dataset.multiDims} />
                    </section>
                )

            case "settings":
                return (
                    <section>
                        {/* ARCHIVE DATASET */}
                        {!dataset.isArchived && (
                            <>
                                <h3>Archive</h3>
                                <p>
                                    Archive this grapher dataset to remove it
                                    from the main list of active datasets.
                                    Archiving is only allowed if none of the
                                    dataset's variables are currently in use.
                                </p>
                                {dataset.charts && dataset.charts.length > 0 ? (
                                    <p>
                                        <strong>
                                            This dataset cannot be archived
                                            because it has charts that directly
                                            reference it.
                                        </strong>
                                    </p>
                                ) : (
                                    <p>
                                        Before archiving, ensure that the
                                        corresponding ETL grapher step has been
                                        archived:{" "}
                                        <code>
                                            grapher/{dataset.namespace}/
                                            {dataset.version}/
                                            {dataset.shortName}
                                        </code>
                                    </p>
                                )}
                                <button
                                    className="btn btn-outline-danger"
                                    onClick={() => this.archive()}
                                    disabled={
                                        dataset.charts &&
                                        dataset.charts.length > 0
                                    }
                                >
                                    Archive dataset
                                </button>
                            </>
                        )}
                    </section>
                )

            default:
                return null
        }
    }

    override render() {
        const { dataset } = this.props
        const { activeTab } = this
        const tabs = [
            { key: "metadata", label: "Metadata" },
            {
                key: "indicators",
                label: `Indicators (${dataset.variables.length})`,
            },
            { key: "charts", label: `Charts (${dataset.charts.length})` },
        ]

        // Add explorers tab only if there are explorers
        if (dataset.explorers && dataset.explorers.length > 0) {
            tabs.push({
                key: "explorers",
                label: `Explorers (${dataset.explorers.length})`,
            })
        }

        // Add multi-dims tab only if there are multi-dims
        if (dataset.multiDims && dataset.multiDims.length > 0) {
            tabs.push({
                key: "multiDims",
                label: `Multi-dims (${dataset.multiDims.length})`,
            })
        }

        tabs.push({ key: "settings", label: "Settings" })

        return (
            <main className="DatasetEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />

                {/* HEADER */}
                <section>
                    {dataset.isArchived ? (
                        <h1>
                            <span style={{ color: "red" }}>Archived:</span>{" "}
                            {dataset.name}
                        </h1>
                    ) : (
                        <h1>{dataset.name}</h1>
                    )}
                    {dataset.shortName && (
                        <h4 style={{ color: "gray" }}>
                            {dataset.namespace}/{dataset.version}/
                            {dataset.shortName}
                        </h4>
                    )}
                    <p>
                        Uploaded{" "}
                        <Timeago
                            time={dataset.dataEditedAt}
                            by={dataset.dataEditedByUserName}
                        />
                    </p>

                    <Link
                        native
                        to={`/datasets/${dataset.id}.csv`}
                        className="btn btn-primary"
                    >
                        <FontAwesomeIcon icon={faDownload} /> Download CSV
                    </Link>
                    {/* Link to Wizard dataset preview */}
                    <a
                        href={urljoin(
                            ETL_WIZARD_URL,
                            `datasets?datasetId=${dataset.id}`
                        )}
                        target="_blank"
                        className="btn btn-tertiary"
                        rel="noopener"
                    >
                        <Button
                            type="default"
                            icon={<FontAwesomeIcon icon={faHatWizard} />}
                        >
                            Explore in Wizard
                        </Button>
                    </a>
                    {/* Link to view all published charts in a collection */}
                    {this.collectionUrl && (
                        <a
                            href={this.collectionUrl}
                            target="_blank"
                            className="btn btn-secondary"
                            rel="noopener"
                        >
                            View all published charts
                        </a>
                    )}
                </section>

                {/* TAB NAVIGATION */}
                <div className="mt-4">
                    <ul className="nav nav-tabs">
                        {tabs.map((tab) => (
                            <li key={tab.key} className="nav-item">
                                <a
                                    className={
                                        "nav-link" +
                                        (tab.key === activeTab ? " active" : "")
                                    }
                                    onClick={() => this.onTabChange(tab.key)}
                                >
                                    {tab.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* TAB CONTENT */}
                <div className="tab-content mt-3">
                    {this.renderTabContent()}
                </div>
            </main>
        )
    }
}

interface DatasetEditPageProps {
    datasetId: number
}

@observer
export class DatasetEditPage extends Component<DatasetEditPageProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType
    dataset: DatasetPageData | undefined = undefined

    constructor(props: DatasetEditPageProps) {
        super(props)

        makeObservable(this, {
            dataset: observable,
        })
    }

    override render() {
        return (
            <AdminLayout title={this.dataset && this.dataset.name}>
                {this.dataset && <DatasetEditor dataset={this.dataset} />}
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON(
            `/api/datasets/${this.props.datasetId}.json`
        )
        runInAction(() => {
            this.dataset = json.dataset as DatasetPageData
        })
    }

    override componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    override UNSAFE_componentWillReceiveProps() {
        void this.getData()
    }
}
