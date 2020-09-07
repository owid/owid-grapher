// WIP

import * as React from "react"
import { keys, isEmpty, difference, clone, uniq } from "grapher/utils/Util"
import {
    observable,
    computed,
    action,
    reaction,
    runInAction,
    IReactionDisposer,
} from "mobx"
import { observer } from "mobx-react"
import { Redirect } from "react-router-dom"

import parse from "csv-parse"
import { BindString, NumericSelectField, FieldsRow } from "./Forms"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { faSpinner } from "@fortawesome/free-solid-svg-icons/faSpinner"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

declare const window: any

class EditableVariable {
    @observable name: string = ""
    @observable unit: string = ""
    @observable description: string = ""
    @observable coverage: string = ""
    @observable timespan: string = ""

    // Existing variable to be overwritten by this one
    @observable overwriteId?: number

    @observable values: string[] = []
}

interface ExistingVariable {
    id: number
    name: string
}

interface ExistingDataset {
    id: number
    namespace: string
    name: string
    description: string

    variables: ExistingVariable[]
}

class EditableDataset {
    @observable id?: number
    @observable name: string = ""
    @observable description: string = ""
    @observable existingVariables: ExistingVariable[] = []
    @observable newVariables: EditableVariable[] = []
    @observable years: number[] = []
    @observable entities: string[] = []

    @observable source: {
        name: string
        dataPublishedBy: string
        dataPublisherSource: string
        link: string
        retrievedDate: string
        additionalInfo: string
    } = {
        name: "",
        dataPublishedBy: "",
        dataPublisherSource: "",
        link: "",
        retrievedDate: "",
        additionalInfo: "",
    }

    update(json: any) {
        for (const key in this) {
            if (key in json) this[key] = json[key]
        }
    }

    @computed get isLoading() {
        return this.id && !this.existingVariables.length
    }
}

@observer
class DataPreview extends React.Component<{ csv: CSV }> {
    @observable rowOffset: number = 0
    @observable visibleRows: number = 10
    @computed get numRows(): number {
        return this.props.csv.rows.length
    }

    @action.bound onScroll(ev: React.UIEvent<Element>) {
        const { scrollTop, scrollHeight } = ev.currentTarget
        const { numRows } = this

        const rowOffset = Math.round((scrollTop / scrollHeight) * numRows)
        ev.currentTarget.scrollTop = Math.round(
            (rowOffset / numRows) * scrollHeight
        )

        this.rowOffset = rowOffset
    }

    render() {
        const { rows } = this.props.csv
        const { rowOffset, visibleRows, numRows } = this
        const height = 50

        return (
            <div
                style={{ height: height * visibleRows, overflowY: "scroll" }}
                onScroll={this.onScroll}
            >
                <div
                    style={{
                        height: height * numRows,
                        paddingTop: height * rowOffset,
                    }}
                >
                    <table className="table" style={{ background: "white" }}>
                        <tbody>
                            {rows
                                .slice(rowOffset, rowOffset + visibleRows)
                                .map((row, i) => (
                                    <tr key={i}>
                                        <td>{rowOffset + i + 1}</td>
                                        {row.map((cell, j) => (
                                            <td
                                                key={j}
                                                style={{ height: height }}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }
}

@observer
class EditVariable extends React.Component<{
    variable: EditableVariable
    dataset: EditableDataset
}> {
    render() {
        const { variable, dataset } = this.props

        return (
            <li className="EditVariable">
                <FieldsRow>
                    <BindString store={variable} field="name" label="" />
                    <select
                        onChange={(e) => {
                            variable.overwriteId = e.target.value
                                ? parseInt(e.target.value)
                                : undefined
                        }}
                        value={variable.overwriteId || ""}
                    >
                        <option value="">Create new variable</option>
                        {dataset.existingVariables.map((v) => (
                            <option key={v.id} value={v.id}>
                                Overwrite {v.name}
                            </option>
                        ))}
                    </select>
                </FieldsRow>
            </li>
        )
    }
}

@observer
class EditVariables extends React.Component<{ dataset: EditableDataset }> {
    @computed get deletingVariables() {
        const { dataset } = this.props
        const deletingVariables: ExistingVariable[] = []
        for (const variable of dataset.existingVariables) {
            if (
                !dataset.newVariables.some((v) => v.overwriteId === variable.id)
            ) {
                deletingVariables.push(variable)
            }
        }
        return deletingVariables
    }

    render() {
        const { dataset } = this.props

        return (
            <section className="form-section variables-section">
                <h3>Variables</h3>
                <p className="form-section-desc">
                    These are the variables that will be stored for your
                    dataset.
                </p>
                <ol>
                    {dataset.newVariables.map((variable, i) => (
                        <EditVariable
                            key={i}
                            variable={variable}
                            dataset={dataset}
                        />
                    ))}
                </ol>
                {this.deletingVariables.length > 0 && (
                    <div className="alert alert-danger">
                        Some existing variables are not selected to overwrite
                        and will be deleted:{" "}
                        {this.deletingVariables.map((v) => v.name).join(",")}
                    </div>
                )}
            </section>
        )
    }
}

interface ValidationResults {
    results: { class: string; message: string }[]
    passed: boolean
}

class CSV {
    static transformSingleLayout(rows: string[][], filename: string) {
        const basename = (filename.match(/(.*?)(.csv)?$/) || [])[1]
        const newRows = [["Entity", "Year", basename]]

        for (let i = 1; i < rows.length; i++) {
            const entity = rows[i][0]
            for (let j = 1; j < rows[0].length; j++) {
                const year = rows[0][j]
                const value = rows[i][j]

                newRows.push([entity, year, value])
            }
        }

        return newRows
    }

    filename: string
    rows: string[][]
    existingEntities: string[]

    @computed get basename() {
        return (this.filename.match(/(.*?)(.csv)?$/) || [])[1]
    }

    @computed get data() {
        const { rows } = this

        const variables: EditableVariable[] = []
        const entities = []
        const years = []

        const headingRow = rows[0]
        for (const name of headingRow.slice(2)) {
            const variable = new EditableVariable()
            variable.name = name
            variables.push(variable)
        }

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const entity = row[0],
                year = row[1]

            entities.push(entity)
            years.push(+year)
            row.slice(2).forEach((value, j) => {
                variables[j].values.push(value)
            })
        }

        return {
            variables: variables,
            entities: entities,
            years: years,
        }
    }

    @computed get validation(): ValidationResults {
        const validation: ValidationResults = { results: [], passed: false }
        const { rows } = this

        // Check we actually have enough data
        if (rows[0].length < 3) {
            validation.results.push({
                class: "danger",
                message: `No variables detected. CSV should have at least 3 columns.`,
            })
        }

        // Make sure entities and years are valid
        const invalidLines = []
        for (let i = 1; i < rows.length; i++) {
            const year = rows[i][1]
            if ((+year).toString() !== year || isEmpty(rows[i][0])) {
                invalidLines.push(i + 1)
            }
        }

        if (invalidLines.length) {
            validation.results.push({
                class: "danger",
                message: `Invalid or missing entity/year on lines: ${invalidLines.join(
                    ", "
                )}`,
            })
        }

        // Check for duplicates
        const uniqCheck: any = {}
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const entity = row[0],
                year = row[1]
            const key = entity + "-" + year
            uniqCheck[key] = uniqCheck[key] || 0
            uniqCheck[key] += 1
        }

        keys(uniqCheck).forEach((key) => {
            const count = uniqCheck[key]
            if (count > 1) {
                validation.results.push({
                    class: "danger",
                    message: `Duplicates detected: ${count} instances of ${key}.`,
                })
            }
        })

        // Warn about non-numeric data
        const nonNumeric = []
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            for (let j = 2; j < row.length; j++) {
                if (
                    row[j] !== "" &&
                    (isNaN(parseFloat(row[j])) || !row[j].match(/^[0-9.-]+$/))
                )
                    nonNumeric.push(`${i + 1} '${row[j]}'`)
            }
        }

        if (nonNumeric.length)
            validation.results.push({
                class: "warning",
                message:
                    "Non-numeric data detected on line " +
                    nonNumeric.join(", "),
            })

        // Warn if we're creating novel entities
        const newEntities = difference(
            uniq(this.data.entities),
            this.existingEntities
        )
        if (newEntities.length >= 1) {
            validation.results.push({
                class: "warning",
                message: `These entities were not found in the database and will be created: ${newEntities.join(
                    ", "
                )}`,
            })
        }

        validation.passed = validation.results.every(
            (result) => result.class !== "danger"
        )

        return validation
    }

    @computed get isValid() {
        return this.validation.passed
    }

    constructor({ filename = "", rows = [], existingEntities = [] }) {
        this.filename = filename
        this.rows = rows
        this.existingEntities = existingEntities
    }
}

@observer
class ValidationView extends React.Component<{
    validation: ValidationResults
}> {
    render() {
        const { validation } = this.props

        return (
            <section className="ValidationView">
                {validation.results.map((v: any, index: number) => (
                    <div key={index} className={`alert alert-${v.class}`}>
                        {v.message}
                    </div>
                ))}
            </section>
        )
    }
}

@observer
class CSVSelector extends React.Component<{
    existingEntities: string[]
    onCSV: (csv: CSV) => void
}> {
    @observable csv?: CSV
    fileInput?: HTMLInputElement

    @action.bound onChooseCSV({ target }: { target: HTMLInputElement }) {
        const { existingEntities } = this.props
        const file = target.files && target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const csv = (e as any).target.result
            parse(
                csv,
                {
                    relax_column_count: true,
                    skip_empty_lines: true,
                    rtrim: true,
                },
                (_, rows) => {
                    // TODO error handling
                    //console.log("Error?", err)
                    if (rows[0][0].toLowerCase() === "year")
                        rows = CSV.transformSingleLayout(rows, file.name)
                    this.csv = new CSV({
                        filename: file.name,
                        rows,
                        existingEntities,
                    } as any)
                    this.props.onCSV(this.csv as any)
                }
            )
        }
        reader.readAsText(file)
    }

    render() {
        const { csv } = this

        return (
            <section>
                <input
                    type="file"
                    onChange={this.onChooseCSV}
                    ref={(e) => (this.fileInput = e as HTMLInputElement)}
                />
                {csv && <DataPreview csv={csv} />}
                {csv && <ValidationView validation={csv.validation} />}
            </section>
        )
    }

    componentDidMount() {
        if (this.fileInput) this.fileInput.value = ""
    }
}

@observer
class Importer extends React.Component<ImportPageData> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable csv?: CSV
    @observable.ref dataset = new EditableDataset()

    @observable existingDataset?: ExistingDataset
    @observable postImportDatasetId?: number

    // First step is user selecting a CSV file
    @action.bound onCSV(csv: CSV) {
        this.csv = csv

        // Look for an existing dataset that matches this csv filename
        const existingDataset = this.props.datasets.find(
            (d) => d.name === csv.basename
        )

        if (existingDataset) {
            this.getExistingDataset(existingDataset.id)
        }
    }

    @action.bound onChooseDataset(datasetId: number) {
        if (datasetId === -1) this.existingDataset = undefined
        else this.getExistingDataset(datasetId)
    }

    // Grab existing dataset info to compare against what we are importing
    async getExistingDataset(datasetId: number) {
        const json = await this.context.admin.getJSON(
            `/api/importData/datasets/${datasetId}.json`
        )
        runInAction(() => (this.existingDataset = json.dataset))
    }

    // When we have the csv and have matched against an existing dataset (or decided not to), we can
    // then initialize the dataset model for user customization
    @action.bound initializeDataset() {
        const { csv, existingDataset } = this
        if (!csv) return

        const dataset = new EditableDataset()

        if (existingDataset) {
            dataset.name = existingDataset.name
            dataset.description = existingDataset.description
            dataset.existingVariables = existingDataset.variables
        }

        if (!dataset.name) dataset.name = csv.basename

        dataset.newVariables = csv.data.variables.map(clone)
        dataset.entities = csv.data.entities
        dataset.years = csv.data.years

        if (existingDataset) {
            // Match new variables to existing variables
            dataset.newVariables.forEach((variable) => {
                const match = dataset.existingVariables.filter(
                    (v) => v.name === variable.name
                )[0]
                if (match) {
                    keys(match).forEach((key) => {
                        if (key === "id")
                            variable.overwriteId = (match as any)[key]
                        else (variable as any)[key] = (match as any)[key]
                    })
                }
            })
        }

        this.dataset = dataset
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.saveDataset()
    }

    // Commit the import!
    saveDataset() {
        const { newVariables, entities, years } = this.dataset

        const requestData = {
            dataset: {
                id: this.existingDataset ? this.existingDataset.id : undefined,
                name: this.dataset.name,
                description: this.dataset.description,
            },
            years,
            entities,
            variables: newVariables,
        }
        this.context.admin
            .requestJSON("/api/importDataset", requestData, "POST")
            .then((json: any) => {
                runInAction(() => {
                    this.postImportDatasetId = json.datasetId
                })
            })
    }

    disposers: IReactionDisposer[] = []
    componentDidMount() {
        this.disposers.push(
            reaction(
                () => [this.csv, this.existingDataset],
                () => this.initializeDataset()
            )
        )
    }

    componentWillUnmount() {
        for (const dispose of this.disposers) dispose()
    }

    render() {
        const { csv, dataset, existingDataset } = this
        const { datasets, existingEntities } = this.props

        return (
            <form className="Importer" onSubmit={this.onSubmit}>
                <h2>Import CSV file</h2>
                <p>
                    Examples of valid layouts:{" "}
                    <a href="http://ourworldindata.org/uploads/2016/02/ourworldindata_single-var.png">
                        single variable
                    </a>
                    ,{" "}
                    <a href="http://ourworldindata.org/uploads/2016/02/ourworldindata_multi-var.png">
                        multiple variables
                    </a>
                    .{" "}
                    <span className="form-section-desc">
                        CSV files only:{" "}
                        <a href="https://ourworldindata.org/how-to-our-world-in-data-guide/#1-2-single-variable-datasets">
                            csv file format guide
                        </a>
                        . Maximum file size: 10MB{" "}
                    </span>
                </p>
                <CSVSelector
                    onCSV={this.onCSV}
                    existingEntities={existingEntities}
                />

                {csv && csv.isValid && (
                    <section>
                        <p
                            style={{
                                opacity: dataset.id !== undefined ? 1 : 0,
                            }}
                            className="updateWarning"
                        >
                            Overwriting existing dataset
                        </p>
                        <NumericSelectField
                            value={existingDataset ? existingDataset.id : -1}
                            onValue={this.onChooseDataset}
                            options={[-1].concat(datasets.map((d) => d.id))}
                            optionLabels={["Create new dataset"].concat(
                                datasets.map((d) => d.name)
                            )}
                        />
                        <hr />

                        <h3>
                            {existingDataset
                                ? `Updating existing dataset`
                                : `Creating new dataset`}
                        </h3>
                        {!existingDataset && (
                            <p>
                                Your data will be validated and stored in the
                                database for visualization. After creating the
                                dataset, please fill out the metadata fields and
                                then mark the dataset as "publishable" if it
                                should be reused by others.
                            </p>
                        )}
                        <BindString
                            field="name"
                            store={dataset}
                            helpText={`Dataset name should include a basic description of the variables, followed by the source and year. For example: "Government Revenue Data – ICTD (2016)"`}
                        />

                        {dataset.isLoading && (
                            <FontAwesomeIcon icon={faSpinner} spin />
                        )}
                        {!dataset.isLoading && [
                            <EditVariables
                                key="editVariables"
                                dataset={dataset}
                            />,
                            <input
                                key="submit"
                                type="submit"
                                className="btn btn-success"
                                value={
                                    existingDataset
                                        ? "Update dataset"
                                        : "Create dataset"
                                }
                            />,
                        ]}
                        {this.postImportDatasetId && (
                            <Redirect
                                to={`/datasets/${this.postImportDatasetId}`}
                            />
                        )}
                    </section>
                )}
            </form>
        )
    }
}

interface ImportPageData {
    datasets: {
        id: number
        name: string
    }[]
    tags: {
        id: number
        name: string
        parent: string
    }[]
    existingEntities: string[]
}

@observer
export class ImportPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable importData?: ImportPageData

    async getData() {
        const json = await this.context.admin.getJSON("/api/importData.json")
        runInAction(() => (this.importData = json as ImportPageData))
    }

    componentDidMount() {
        this.getData()
    }

    render() {
        return (
            <AdminLayout>
                <main className="ImportPage">
                    {this.importData && <Importer {...this.importData} />}
                </main>
            </AdminLayout>
        )
    }
}
