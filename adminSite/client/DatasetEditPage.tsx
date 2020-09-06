import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    action,
    IReactionDisposer,
    when
} from "mobx"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import filenamify from "filenamify"
import { format } from "timeago.js"

import { OwidVariableDisplaySettings } from "owidTable/OwidVariable"
import { OwidSource } from "owidTable/OwidSource"

import { AdminLayout } from "./AdminLayout"
import { Link } from "./Link"
import { BindString, Toggle, BindFloat, FieldsRow, EditableTags } from "./Forms"
import { ChartList, ChartListItem } from "./ChartList"
import { Grapher } from "charts/core/Grapher"
import { ChartFigureView } from "site/client/ChartFigureView"
import { ChartType, EPOCH_DATE } from "charts/core/GrapherConstants"
import { Tag } from "./TagBadge"
import { VariableList, VariableListItem } from "./VariableList"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { Base64 } from "js-base64"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload"
import { faGithub } from "@fortawesome/free-brands-svg-icons/faGithub"

class VariableEditable {
    @observable name: string = ""
    @observable unit: string = ""
    @observable shortUnit: string = ""
    @observable description: string = ""
    @observable
    display: OwidVariableDisplaySettings = new OwidVariableDisplaySettings()

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") lodash.extend(this.display, json.display)
            else this[key] = json[key]
        }
    }
}

@observer
class VariableEditRow extends React.Component<{
    variable: VariableEditListItem
    isBulkImport: boolean
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable.ref chart?: Grapher
    @observable newVariable!: VariableEditable

    componentWillMount() {
        this.componentWillReceiveProps()
    }
    componentWillReceiveProps() {
        this.newVariable = new VariableEditable(this.props.variable)
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newVariable) !==
            JSON.stringify(new VariableEditable(this.props.variable))
        )
    }

    async save() {
        const { variable } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/variables/${variable.id}`,
            { variable: this.newVariable },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.variable, this.newVariable)
            })
        }
    }

    @computed get chartConfig() {
        return {
            yAxis: { min: 0 },
            map: { variableId: this.props.variable.id },
            tab: "map",
            hasMapTab: true,
            dimensions: [
                {
                    property: "y",
                    variableId: this.props.variable.id,
                    display: lodash.clone(this.newVariable.display)
                }
            ]
        }
    }

    @action.bound chartIsReady(chart: Grapher) {
        // XXX refactor this with EditorBasicTab
        if (lodash.isEmpty(chart.mapTransform.choroplethData)) {
            chart.tab = "chart"
            chart.hasMapTab = false
            if (chart.isScatter || chart.isSlopeChart) {
                chart.selectedKeys = []
            } else if (chart.primaryDimensions.length > 1) {
                const entity = lodash.includes(
                    chart.availableEntityNames,
                    "World"
                )
                    ? "World"
                    : lodash.sample(chart.availableEntityNames)
                chart.selectedKeys = chart.availableKeys.filter(
                    key => chart.lookupKey(key).entityName === entity
                )
                chart.addCountryMode = "change-country"
            } else {
                chart.addCountryMode = "add-country"
                if (chart.filledDimensions[0].yearsUniq.length === 1) {
                    chart.type = ChartType.DiscreteBar
                    chart.selectedKeys =
                        chart.availableKeys.length > 15
                            ? lodash.sampleSize(chart.availableKeys, 8)
                            : chart.availableKeys
                } else {
                    chart.selectedKeys =
                        chart.availableKeys.length > 10
                            ? lodash.sampleSize(chart.availableKeys, 3)
                            : chart.availableKeys
                }
            }
        }
    }

    dispose!: IReactionDisposer
    dispose2!: IReactionDisposer
    componentDidMount() {
        this.chart = new Grapher(this.chartConfig as any, {
            isEmbed: true
        })

        this.dispose2 = when(
            () => this.chart !== undefined && this.chart.isReady,
            () => this.chartIsReady(this.chart as Grapher)
        )

        this.dispose = autorun(() => {
            const chart = this.chart
            const display = lodash.clone(this.newVariable.display)
            if (chart) {
                runInAction(() => (chart.dimensions[0].display = display))
            }
        })
    }

    componentWillUnmount() {
        this.dispose()
        this.dispose2()
    }

    render() {
        const { isBulkImport } = this.props
        const { newVariable } = this

        // Todo: can we reuse code from VariableEditPage?

        return (
            <div className="VariableEditRow row">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <div className="col">
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            this.save()
                        }}
                    >
                        <section>
                            <BindString
                                label="Name"
                                field="name"
                                store={newVariable}
                                helpText="The full name of the variable e.g. Top marginal income tax rate"
                                disabled={isBulkImport}
                            />
                            <BindString
                                label="Display name"
                                field="name"
                                store={newVariable.display}
                                helpText="How the variable should be named on charts"
                            />
                            <FieldsRow>
                                <BindString
                                    label="Unit of measurement"
                                    field="unit"
                                    store={newVariable.display}
                                    placeholder={newVariable.unit}
                                />
                                <BindString
                                    label="Short (axis) unit"
                                    field="shortUnit"
                                    store={newVariable.display}
                                    placeholder={newVariable.shortUnit}
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <BindFloat
                                    label="Number of decimal places"
                                    field="numDecimalPlaces"
                                    store={newVariable.display}
                                    helpText={`A negative number here will round integers`}
                                />
                                <BindFloat
                                    label="Unit conversion factor"
                                    field="conversionFactor"
                                    store={newVariable.display}
                                    helpText={`Multiply all values by this amount`}
                                />
                            </FieldsRow>
                            <FieldsRow>
                                <Toggle
                                    value={
                                        newVariable.display.yearIsDay === true
                                    }
                                    onValue={value =>
                                        (newVariable.display.yearIsDay = value)
                                    }
                                    label="Treat year column as day series"
                                />
                                <BindString
                                    label="Zero Day as YYYY-MM-DD"
                                    field="zeroDay"
                                    store={newVariable.display}
                                    disabled={!newVariable.display.yearIsDay}
                                    placeholder={
                                        newVariable.display.yearIsDay
                                            ? EPOCH_DATE
                                            : ""
                                    }
                                    helpText={`The day series starts on this date.`}
                                />
                            </FieldsRow>
                            <BindString
                                label="Description"
                                field="description"
                                store={newVariable}
                                helpText="Any further useful information about this variable"
                                textarea
                            />
                            <BindString
                                field="entityAnnotationsMap"
                                placeholder="Entity: note"
                                store={newVariable.display}
                                label="Entity annotations"
                                textarea
                                disabled={isBulkImport}
                                helpText="Additional text to show next to entity labels. Each note should be in a separate line."
                            />
                        </section>
                        <input
                            type="submit"
                            className="btn btn-success"
                            value="Update variable"
                        />
                    </form>
                </div>
                {this.chart && (
                    <div className="col">
                        <ChartFigureView chart={this.chart} />
                        <Link
                            className="btn btn-secondary pull-right"
                            to={`/charts/create/${Base64.encode(
                                JSON.stringify(this.chart.object)
                            )}`}
                        >
                            Edit as new chart
                        </Link>
                    </div>
                )}
            </div>
        )
    }
}

interface VariableEditListItem {
    id: number
    name: string
    unit: string
    shortUnit: string
    description: string
    display: OwidVariableDisplaySettings
}

interface DatasetPageData {
    id: number
    name: string
    description: string
    namespace: string
    isPrivate: boolean

    dataEditedAt: Date
    dataEditedByUserId: number
    dataEditedByUserName: string

    metadataEditedAt: Date
    metadataEditedByUserId: number
    metadataEditedByUserName: string

    availableTags: { id: number; name: string; parentName: string }[]
    tags: { id: number; name: string }[]
    variables: VariableEditListItem[]
    charts: ChartListItem[]
    source: OwidSource
    zipFile?: { filename: string }
}

class DatasetEditable {
    @observable name: string = ""
    @observable description: string = ""
    @observable isPrivate: boolean = false

    @observable source: OwidSource = {
        id: -1,
        name: "",
        dataPublishedBy: "",
        dataPublisherSource: "",
        link: "",
        retrievedDate: "",
        additionalInfo: ""
    }

    @observable tags: Tag[] = []

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
    isBulkImport: boolean
}> {
    @action.bound onSaveTags(tags: Tag[]) {
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
                {/*<small className="form-text text-muted">Currently used for internal organization</small>*/}
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
    componentWillMount() {
        this.componentWillReceiveProps()
    }
    componentWillReceiveProps() {
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

    @computed get zipFileUrl() {
        return "/"
    }

    async uploadZip(file: File) {
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${this.props.dataset.id}/uploadZip`,
            file,
            "PUT"
        )
        if (json.success) {
            this.props.dataset.zipFile = { filename: file.name }
        }
    }

    @action.bound onChooseZip(ev: { target: HTMLInputElement }) {
        if (!ev.target.files) return

        const file = ev.target.files[0]
        this.uploadZip(file)
    }

    @action.bound startChooseZip() {
        const input = document.createElement("input")
        input.type = "file"
        input.addEventListener("change", this.onChooseZip as any)
        input.click()
    }

    render() {
        if (this.isDeleted) return <Redirect to="/datasets" />

        const { dataset } = this.props
        const { newDataset, timesUpdated } = this
        const isBulkImport = dataset.namespace !== "owid"

        return (
            <main className="DatasetEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <section>
                    <h1>{dataset.name}</h1>
                    <p>
                        Uploaded {format(dataset.dataEditedAt)} by{" "}
                        {dataset.dataEditedByUserName}
                    </p>
                    <Link
                        native
                        to={`/datasets/${dataset.id}.csv`}
                        className="btn btn-primary"
                    >
                        <FontAwesomeIcon icon={faDownload} /> Download CSV
                    </Link>
                    {!isBulkImport && !dataset.isPrivate && (
                        <a
                            href={this.gitHistoryUrl}
                            target="_blank"
                            className="btn btn-secondary"
                        >
                            <FontAwesomeIcon icon={faGithub} /> View on GitHub
                        </a>
                    )}
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
                    {!isBulkImport && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.startChooseZip}
                        >
                            <FontAwesomeIcon icon={faUpload} />{" "}
                            {dataset.zipFile ? "Overwrite Zip" : "Upload Zip"}
                        </button>
                    )}
                </section>
                <section>
                    <h3>Dataset metadata</h3>
                    <form
                        onSubmit={e => {
                            e.preventDefault()
                            this.save()
                        }}
                    >
                        {isBulkImport ? (
                            <p>
                                This dataset came from an automated import, so
                                we can't change the original metadata manually.
                            </p>
                        ) : (
                            <p>
                                The core metadata for the dataset. It's
                                important to keep this in a standardized style
                                across datasets.
                            </p>
                        )}
                        <div className="row">
                            <div className="col">
                                <BindString
                                    field="name"
                                    store={newDataset}
                                    label="Name"
                                    disabled={isBulkImport}
                                    helpText="Short name for this dataset, followed by the source and year. Example: Government Revenue Data – ICTD (2016)"
                                />
                                <BindString
                                    field="additionalInfo"
                                    store={newDataset.source}
                                    label="Description"
                                    textarea
                                    disabled={isBulkImport}
                                    helpText="Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like."
                                    rows={10}
                                />
                                <BindString
                                    field="link"
                                    store={newDataset.source}
                                    label="Link"
                                    disabled={isBulkImport}
                                    helpText="Link to the publication from which we retrieved this data"
                                />
                                <BindString
                                    field="retrievedDate"
                                    store={newDataset.source}
                                    label="Retrieved"
                                    disabled={isBulkImport}
                                    helpText="Date when this data was obtained by us"
                                />
                                <DatasetTagEditor
                                    newDataset={newDataset}
                                    availableTags={dataset.availableTags}
                                    isBulkImport={isBulkImport}
                                />
                                <Toggle
                                    label="Is publishable (include in exported OWID collection)"
                                    value={!newDataset.isPrivate}
                                    onValue={v => (newDataset.isPrivate = !v)}
                                    disabled={isBulkImport}
                                />
                            </div>

                            <div className="col">
                                <BindString
                                    field="name"
                                    store={newDataset.source}
                                    label="Source Name"
                                    disabled={isBulkImport}
                                    helpText={`Source name displayed on charts using this dataset. For academic papers, the name of the source should be "Authors (year)" e.g. Arroyo-Abad and Lindert (2016). For institutional projects or reports, the name should be "Institution, Project (year or vintage)" e.g. U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). For data that we have modified extensively, the name should be "Our World in Data based on Author (year)" e.g. Our World in Data based on Atkinson (2002) and Sen (2000).`}
                                />

                                <BindString
                                    field="dataPublishedBy"
                                    store={newDataset.source}
                                    label="Data published by"
                                    disabled={isBulkImport}
                                    helpText={`For academic papers this should be a complete reference. For institutional projects, detail the project or report. For data we have modified extensively, list OWID as the publishers and provide the name of the person in charge of the calculation.`}
                                />
                                <BindString
                                    field="dataPublisherSource"
                                    store={newDataset.source}
                                    label="Data publisher's source"
                                    disabled={isBulkImport}
                                    helpText={`Basic indication of how the publisher collected this data e.g. surveys data. Anything longer than a line should go in the dataset description.`}
                                />
                                <BindString
                                    field="description"
                                    store={newDataset}
                                    label="Internal notes"
                                    textarea
                                    disabled={isBulkImport}
                                />
                            </div>
                        </div>
                        {!isBulkImport && (
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update dataset"
                            />
                        )}
                    </form>
                </section>
                <section>
                    <h3>Variables</h3>
                    {dataset.variables.length >= 12 ? (
                        <VariableList
                            variables={dataset.variables as VariableListItem[]}
                        />
                    ) : (
                        dataset.variables.map(variable => (
                            <VariableEditRow
                                key={`${variable.id}-${timesUpdated}`}
                                variable={variable}
                                isBulkImport={isBulkImport}
                            />
                        ))
                    )}
                </section>
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
                {!isBulkImport && (
                    <section>
                        <h3>Danger zone</h3>
                        <p>
                            Delete this dataset and all variables it contains.
                            If there are any charts using this data, you must
                            delete them individually first.
                        </p>
                        <div className="card-footer">
                            <button
                                className="btn btn-danger"
                                onClick={() => this.delete()}
                            >
                                Delete dataset
                            </button>
                        </div>
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
        this.componentWillReceiveProps()
    }
    componentWillReceiveProps() {
        this.getData()
    }
}
