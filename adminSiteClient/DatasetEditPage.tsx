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
    SearchWord,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload, faHatWizard } from "@fortawesome/free-solid-svg-icons"
import { ETL_WIZARD_URL } from "../settings/clientSettings.js"
import { Button } from "antd"
import urljoin from "url-join"

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

    availableTags: { id: number; name: string; parentName: string }[]
    tags: { id: number; name: string }[]
    variables: VariableListItem[]
    charts: ChartListItem[]
    variableSources: OwidSource[]

    origins: OwidOrigin[]
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

interface DatasetTagEditorProps {
    newDataset: DatasetEditable
    availableTags: {
        id: number
        name: string
        parentName: string
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
            { key: "indicators", label: "Indicators" },
            { key: "charts", label: "Charts" },
            { key: "settings", label: "Settings" },
        ]

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
