import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action } from "mobx"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import filenamify from "filenamify"

import { OwidSource, DbChartTagJoin, OwidOrigin } from "@ourworldindata/utils"

import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { BindString, Toggle, FieldsRow, Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { OriginList } from "./OriginList.js"
import { SourceList } from "./SourceList.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload, faHatWizard } from "@fortawesome/free-solid-svg-icons"
import { faGithub } from "@fortawesome/free-brands-svg-icons"
import { ETL_WIZARD_URL } from "../settings/clientSettings.js"
import { Button } from "antd"
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
    zipFile?: { filename: string }

    origins: OwidOrigin[]
}

class DatasetEditable {
    @observable name: string = ""
    @observable description: string = ""
    @observable isPrivate: boolean = false
    @observable nonRedistributable: boolean = false
    @observable updatePeriodDays: number | undefined = undefined

    @observable source: OwidSource = {
        id: -1,
        name: "",
        dataPublishedBy: "",
        dataPublisherSource: "",
        link: "",
        retrievedDate: "",
        additionalInfo: "",
    }

    @observable tags: DbChartTagJoin[] = []

    constructor(json: DatasetPageData) {
        for (const key in this) {
            if (key in json) {
                if (key === "tags") this.tags = lodash.clone(json.tags)
                else this[key] = (json as any)[key]
            }
        }
    }
}

@observer
class DatasetTagEditor extends React.Component<{
    newDataset: DatasetEditable
    availableTags: { id: number; name: string; parentName: string }[]
}> {
    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        this.props.newDataset.tags = tags
    }

    render() {
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

@observer
class DatasetEditor extends React.Component<{ dataset: DatasetPageData }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable newDataset!: DatasetEditable
    @observable isDeleted: boolean = false

    // HACK (Mispy): Force variable refresh when dataset metadata is updated
    @observable timesUpdated: number = 0

    // Store the original dataset to determine when it is modified
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.newDataset = new DatasetEditable(this.props.dataset)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newDataset) !==
            JSON.stringify(new DatasetEditable(this.props.dataset))
        )
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

    async delete() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Really delete the dataset ${dataset.name}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            this.isDeleted = true
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

    @computed get gitHistoryUrl() {
        return `https://github.com/${
            this.context.admin.settings.GITHUB_USERNAME
        }/owid-datasets/tree/master/datasets/${encodeURIComponent(
            filenamify(this.props.dataset.name)
        )}`
    }

    render() {
        if (this.isDeleted) return <Redirect to="/datasets" />

        const { dataset } = this.props
        const { newDataset } = this
        const isBulkImport = dataset.namespace !== "owid"
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
                        href={`${ETL_WIZARD_URL}datasets?datasetId=${dataset.id}`}
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
                    {/* View on GitHub link (old) */}
                    {!isBulkImport && !dataset.isPrivate && (
                        <a
                            href={this.gitHistoryUrl}
                            target="_blank"
                            className="btn btn-secondary"
                            rel="noopener"
                        >
                            <FontAwesomeIcon icon={faGithub} /> View on GitHub
                        </a>
                    )}
                    {/* Download additional content (old) */}
                    {dataset.zipFile && (
                        <Link
                            native
                            to={`/datasets/${dataset.id}/downloadZip`}
                            className="btn btn-secondary"
                        >
                            <FontAwesomeIcon icon={faDownload} />{" "}
                            additional-material.zip
                        </Link>
                    )}
                </section>

                {/* DATASET METADATA */}
                <section>
                    <h3>Dataset metadata</h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            void this.save()
                        }}
                    >
                        <p>
                            Metadata is non-editable and can be only changed in
                            ETL.
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
                                        disabled={newDataset.nonRedistributable}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        label="Redistribution is prohibited (disable chart data download)"
                                        value={newDataset.nonRedistributable}
                                        onValue={(v) => {
                                            newDataset.nonRedistributable = v
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
                </section>

                {/* ORIGINS */}
                <section>
                    <h3>Origins</h3>
                    <OriginList origins={dataset.origins || []} />
                </section>

                {/* SOURCES */}
                {dataset.variableSources &&
                    dataset.variableSources.length > 0 && (
                        <section>
                            <h3>Sources</h3>
                            <SourceList sources={dataset.variableSources} />
                        </section>
                    )}

                {/* INDICATORS */}
                <section>
                    <h3>Indicators</h3>
                    <VariableList variables={dataset.variables} fields={[]} />
                </section>

                {/* CHARTS */}
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

                {/* ARCHIVE DATASET */}
                {!dataset.isArchived && (
                    <section>
                        <h3>Archive</h3>
                        <p>
                            Archive this grapher dataset to remove it from the
                            main list of active datasets.
                        </p>
                        {dataset.charts && dataset.charts.length > 0 ? (
                            <p>
                                <strong>
                                    This dataset cannot be archived because it
                                    contains charts.
                                </strong>
                            </p>
                        ) : (
                            <p>
                                <strong>Before archiving, ensure that:</strong>
                                <ul>
                                    <li>
                                        The corresponding ETL grapher step has
                                        been archived:{" "}
                                        <code>
                                            grapher/{dataset.namespace}/
                                            {dataset.version}/
                                            {dataset.shortName}
                                        </code>
                                    </li>
                                    <li>
                                        The dataset is not used in any
                                        indicator-based explorers.
                                    </li>
                                </ul>
                            </p>
                        )}
                        <button
                            className="btn btn-outline-danger"
                            onClick={() => this.archive()}
                            disabled={
                                dataset.charts && dataset.charts.length > 0
                            }
                        >
                            Archive dataset
                        </button>
                    </section>
                )}
            </main>
        )
    }
}

@observer
export class DatasetEditPage extends React.Component<{ datasetId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable dataset?: DatasetPageData

    render() {
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

    componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        void this.getData()
    }
}
