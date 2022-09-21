import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import Papa from "papaparse"

import unidecode from "unidecode"
import FuzzySet from "fuzzyset"

import { AdminLayout } from "./AdminLayout.js"
import { SelectField, SelectGroupsField, SelectGroup } from "./Forms.js"
import {
    CountryNameFormat,
    CountryNameFormatDefs,
    CountryDefByKey,
} from "../adminSiteClient/CountryNameFormat.js"
import { uniq, toString, csvEscape, sortBy } from "../clientUtils/Util.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

class CSV {
    filename?: string
    rows: string[][]
    countryEntriesMap: Map<string, CountryEntry>
    mapCountriesInputToOutput: Record<string, string>
    autoMatchedCount: number = 0
    parseError?: string
    findSimilarCountries: boolean = true

    constructor() {
        makeObservable(this, {
            filename: observable,
            rows: observable,
            countryEntriesMap: observable,
            mapCountriesInputToOutput: observable,
            autoMatchedCount: observable,
            parseError: observable,
            findSimilarCountries: observable,
            allCountries: computed,
            countryColumnIndex: computed,
            showDownloadOption: computed,
            numCountries: computed,
            validationError: computed,
            onFileUpload: action.bound,
            onFormatChange: action.bound,
            parseCSV: action.bound,
        })

        this.countryEntriesMap = new Map<string, CountryEntry>()
        this.rows = []
        this.mapCountriesInputToOutput = {}
    }

    get allCountries(): string[] {
        const standardNames = Object.values(
            this.mapCountriesInputToOutput
        ).filter((value: string | undefined) => value !== undefined) as string[]
        return uniq(sortBy(standardNames)) as string[]
    }

    get countryColumnIndex() {
        const { rows } = this
        if (rows.length === 0) {
            return -1
        }
        return rows[0].findIndex(
            (columnName) => columnName.toLowerCase() === "country"
        )
    }

    get showDownloadOption() {
        const { rows, validationError } = this
        if (rows.length > 0 && validationError === undefined) {
            return true
        }
        return false
    }

    get numCountries() {
        return this.rows.length - 1
    }

    get validationError(): string | undefined {
        const { parseError } = this
        if (parseError !== undefined) {
            return `Could not parse file (error: ${parseError}). Check if it is a valid CSV file.`
        }

        const { rows, countryColumnIndex } = this
        if (rows.length === 0) return undefined

        if (countryColumnIndex < 0) {
            return "Could not find a column name with the header 'Country'"
        }

        return undefined
    }

    onFileUpload(
        filename: string,
        rows: string[][],
        err: { message: string } | undefined,
        similarityMatch: boolean
    ) {
        this.filename = filename
        if (err) {
            this.parseError = err.message
            this.rows = []
        } else {
            this.parseError = undefined
            this.rows = rows
        }
        this.findSimilarCountries = similarityMatch
        this.parseCSV()
    }

    onFormatChange(
        countryMap: Record<string, string>,
        findSimilarCountries: boolean
    ) {
        this.mapCountriesInputToOutput = countryMap
        this.findSimilarCountries = findSimilarCountries
        this.parseCSV()
    }

    parseCSV() {
        const {
            rows,
            countryColumnIndex,
            mapCountriesInputToOutput,
            findSimilarCountries,
        } = this

        if (countryColumnIndex < 0) {
            this.countryEntriesMap = new Map<string, CountryEntry>()
            this.autoMatchedCount = 0
            return
        }

        const entriesByCountry = new Map<string, CountryEntry>()
        const countries = rows
            .slice(1) // remove header row
            .map((row: string[]) =>
                unidecode(row[countryColumnIndex] as string)
            )
            .filter(
                (country?: string) => country !== "" && country !== undefined
            ) // exclude empty strings

        // for fuzzy-match, use the input and output values as target to improve matching potential
        const inputCountries = Object.keys(mapCountriesInputToOutput).filter(
            (key) => mapCountriesInputToOutput[key] !== undefined
        )
        const outputCountries = inputCountries.map(
            (key) => mapCountriesInputToOutput[key]
        ) as string[]
        const fuzz = FuzzySet(inputCountries.concat(outputCountries))

        let autoMatched = 0

        countries.map((country: string) => {
            const outputCountry =
                mapCountriesInputToOutput[country.toLowerCase()]
            let approximatedMatches: string[] = []

            if (outputCountry === undefined) {
                if (findSimilarCountries) {
                    const fuzzMatches = fuzz.get(country) ?? []
                    approximatedMatches = fuzzMatches
                        .map(
                            (fuzzyMatch: [number, string]) =>
                                mapCountriesInputToOutput[fuzzyMatch[1]] ||
                                fuzzyMatch[1]
                        )
                        .filter((key) => key !== undefined)
                    approximatedMatches = uniq(approximatedMatches)
                }
            } else {
                autoMatched += 1
            }

            const entry: CountryEntry = {
                originalName: country,
                standardizedName: outputCountry || undefined,
                approximatedMatches: approximatedMatches,
                selectedMatch: "",
                customName: "",
            }
            entriesByCountry.set(country, entry)
        })

        this.countryEntriesMap = entriesByCountry
        this.autoMatchedCount = autoMatched
    }
}

interface CountryEntry extends React.HTMLAttributes<HTMLTableRowElement> {
    originalName: string
    standardizedName?: string
    approximatedMatches: string[]
    selectedMatch?: string
    customName?: string
}

const CountryEntryRowRenderer = observer(
    class CountryEntryRowRenderer extends React.Component<{
        entry: CountryEntry
        allCountries: string[]
        onUpdate: (
            value: string,
            inputCountry: string,
            isCustom: boolean
        ) => void
    }> {
        selectedStandardName: string

        constructor(props: {
            entry: CountryEntry
            allCountries: string[]
            onUpdate: (
                value: string,
                inputCountry: string,
                isCustom: boolean
            ) => void
        }) {
            super(props)

            makeObservable(this, {
                selectedStandardName: observable,
                defaultOption: computed,
                isMatched: computed,
                defaultValue: computed,
                onEntrySelected: action.bound,
            })
        }

        get defaultOption() {
            return "Select one"
        }

        get isMatched(): boolean {
            const { entry } = this.props

            if (
                entry.standardizedName ||
                entry.selectedMatch ||
                entry.customName
            )
                return true
            else return false
        }

        get defaultValue() {
            const { entry } = this.props

            if (
                entry.selectedMatch !== undefined &&
                entry.selectedMatch.length > 0
            ) {
                return entry.selectedMatch
            }
            return this.defaultOption
        }

        onEntrySelected(selectedName: string) {
            const { entry, onUpdate } = this.props

            onUpdate(selectedName, entry.originalName, false)
        }

        render() {
            const { entry, allCountries, onUpdate } = this.props
            const { defaultOption, defaultValue, isMatched } = this

            const optgroups: SelectGroup[] = []

            if (entry.approximatedMatches.length > 0) {
                const options = entry.approximatedMatches.map(
                    (countryName) => ({
                        value: countryName,
                        label: countryName,
                    })
                )
                optgroups.push({ title: "Likely matches", options: options })
            }

            optgroups.push({
                title: "All standard names",
                options: allCountries.map((countryName) => ({
                    value: countryName,
                    label: countryName,
                })),
            })

            return (
                <tr>
                    <td>
                        <span style={{ color: isMatched ? "black" : "red" }}>
                            {entry.originalName}
                        </span>
                    </td>
                    <td>{entry.standardizedName}</td>
                    <td>
                        <SelectGroupsField
                            value={defaultValue}
                            onValue={this.onEntrySelected}
                            options={[
                                { value: defaultOption, label: defaultOption },
                            ]}
                            groups={optgroups}
                        />
                    </td>
                    <td>
                        <input
                            type="text"
                            className="form-control"
                            value={entry.customName}
                            onChange={(e) =>
                                onUpdate(
                                    e.currentTarget.value,
                                    entry.originalName,
                                    true
                                )
                            }
                        />
                    </td>
                </tr>
            )
        }
    }
)

export const CountryStandardizerPage = observer(
    class CountryStandardizerPage extends React.Component {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        fileUploader!: HTMLInputElement

        countryList: CountryEntry[] = []
        inputFormat: string = CountryNameFormat.NonStandardCountryName
        outputFormat: string = CountryNameFormat.OurWorldInDataName
        csv: CSV = new CSV()
        showAllRows: boolean = false

        constructor(props) {
            super(props)

            makeObservable(this, {
                countryList: observable,
                inputFormat: observable,
                outputFormat: observable,
                csv: observable,
                showAllRows: observable,
                shouldSaveSelection: computed,
                displayMatchStatus: computed,
                onInputFormat: action.bound,
                onOutputFormat: action.bound,
                onChooseCSV: action.bound,
                csvDataUri: computed,
                csvFilename: computed,
                downloadTooltip: computed,
                fileUploadLabel: computed,
                outputCSV: computed,
                onUpdateRow: action.bound,
                onDownload: action.bound,
                onToggleRows: action.bound,
                onSave: action.bound,
                entriesToShow: computed,
            })
        }

        get shouldSaveSelection(): boolean {
            if (
                this.inputFormat === CountryNameFormat.NonStandardCountryName &&
                this.outputFormat === CountryNameFormat.OurWorldInDataName
            ) {
                return true
            }
            return false
        }

        get displayMatchStatus() {
            const { autoMatchedCount, numCountries, showDownloadOption } =
                this.csv

            if (!showDownloadOption) return <div></div>

            const columnName = CountryDefByKey[this.outputFormat].label

            let text = ""
            let banner = ""
            if (autoMatchedCount === numCountries) {
                banner = "alert-success"
                text = " All countries were auto-matched!"
            } else {
                banner = "alert-warning"
                text =
                    " Some countries could not be matched. Either select a similar candidate from the dropdown (which will be saved back in the database) or enter a custom name."
            }
            text +=
                " The file you will download has a new column with the header '" +
                columnName +
                "'."
            return (
                <div className={"alert " + banner} role="alert">
                    <strong>Status:</strong>
                    {text}
                </div>
            )
        }

        onInputFormat(format: string) {
            this.inputFormat = format
        }

        onOutputFormat(format: string) {
            this.outputFormat = format
        }

        onChooseCSV({ target }: { target: HTMLInputElement }) {
            const file = target.files && target.files[0]
            if (!file) return

            const reader = new FileReader()
            reader.onload = (e) => {
                const csv = e?.target?.result
                if (csv && typeof csv === "string") {
                    const res = Papa.parse<string[]>(csv, {
                        delimiter: ",",
                        skipEmptyLines: true,
                    })
                    this.csv.onFileUpload(
                        file.name,
                        res.data,
                        res.errors[0],
                        this.shouldSaveSelection
                    )
                } else console.error("Csv was not read correctly")
            }
            reader.readAsText(file)
        }

        dispose!: IReactionDisposer
        componentDidMount() {
            // Fetch mapping from server when the input or output format changes
            this.dispose = reaction(
                () => [this.inputFormat, this.outputFormat],
                () => this.fetchCountryMap()
            )

            this.fetchCountryMap()
        }

        componentWillUnmount() {
            this.dispose()
        }

        async fetchCountryMap() {
            const { inputFormat, outputFormat } = this
            const { admin } = this.context
            const results = await admin.getJSON(
                `/api/countries.json?input=${inputFormat}&output=${outputFormat}`
            )

            runInAction(() => {
                const countryMap: { [key: string]: string } = {}
                results.countries.forEach(
                    (countryFormat: { input: string; output: unknown }) => {
                        if (countryFormat.input === null) return
                        countryMap[countryFormat.input.toLowerCase()] =
                            toString(countryFormat.output)
                    }
                )

                this.csv.onFormatChange(countryMap, this.shouldSaveSelection)
            })
        }

        get csvDataUri(): string {
            if (this.outputCSV)
                return window.URL.createObjectURL(this.outputCSV)
            else return ""
        }

        get csvFilename(): string {
            const { csv } = this

            if (csv.filename === undefined) return ""

            return csv.filename.replace(".csv", "_country_standardized.csv")
        }

        get downloadTooltip(): string {
            const { shouldSaveSelection } = this

            if (shouldSaveSelection) {
                return "Downloading will save any custom selection for future ease"
            }
            return ""
        }

        get fileUploadLabel() {
            const { csv } = this

            if (csv === undefined || csv.filename === undefined) {
                return "Choose CSV file"
            }
            return csv.filename
        }

        get outputCSV() {
            const { csv } = this

            if (csv === undefined || csv.validationError !== undefined)
                return undefined

            const columnName = CountryDefByKey[this.outputFormat].label
            const columnIndex = csv.countryColumnIndex + 1
            const outputRows: string[][] = []

            // add a new column with the output country name
            csv.rows.forEach((row, rowIndex) => {
                let columnValue: string = ""

                if (rowIndex === 0) {
                    // Don't map header row
                    columnValue = columnName
                } else {
                    // prioritize user selected name
                    const entry = csv.countryEntriesMap.get(
                        unidecode(row[csv.countryColumnIndex])
                    )
                    if (entry !== undefined) {
                        if (
                            entry.customName !== undefined &&
                            entry.customName.length > 0
                        ) {
                            columnValue = entry.customName
                        } else if (entry.standardizedName !== undefined) {
                            columnValue = entry.standardizedName
                        } else if (
                            entry.selectedMatch !== undefined &&
                            entry.selectedMatch.length > 0
                        ) {
                            columnValue = entry.selectedMatch
                        }
                    }
                }

                const newRow = row.slice(0)
                newRow.splice(columnIndex, 0, columnValue)
                outputRows.push(newRow)
            })

            const strRows = outputRows.map((row) =>
                row.map((val) => csvEscape(val)).join(",")
            )
            return new Blob([strRows.join("\n")], { type: "text/csv" })
        }

        onUpdateRow(value: string, inputCountry: string, isCustom: boolean) {
            const { csv } = this

            const entry = csv.countryEntriesMap.get(
                inputCountry
            ) as CountryEntry
            console.log("updating " + inputCountry + " with " + value)

            if (isCustom) {
                entry.customName = value === undefined ? "" : value
            } else {
                entry.selectedMatch = value
            }
        }

        // IE11 compatibility
        onDownload() {
            const { shouldSaveSelection } = this

            if (shouldSaveSelection) {
                this.onSave()
            }
        }

        onToggleRows() {
            this.showAllRows = !this.showAllRows
        }

        onSave() {
            const { csv } = this

            const countries: Record<string, string> = {}
            let needToSave: boolean = false

            csv.countryEntriesMap.forEach((entry) => {
                // ignore if there was a user entered a new name
                if (
                    entry.customName !== undefined &&
                    entry.customName.length > 0
                ) {
                    console.log(
                        "not saving custom-name for entry " + entry.originalName
                    )
                } else if (
                    entry.selectedMatch !== undefined &&
                    entry.selectedMatch.length > 0
                ) {
                    needToSave = true
                    countries[entry.originalName] = entry.selectedMatch
                }
            })

            if (needToSave) {
                this.context.admin.requestJSON(
                    `/api/countries`,
                    { countries: countries },
                    "POST"
                )
            }
        }

        get entriesToShow(): CountryEntry[] {
            if (this.csv === undefined) return []

            const countries: CountryEntry[] = []
            this.csv.countryEntriesMap.forEach((entry) => {
                if (this.showAllRows) {
                    countries.push(entry)
                } else if (entry.standardizedName === undefined) {
                    countries.push(entry)
                }
            })
            return countries
        }

        render() {
            const { csv, entriesToShow } = this
            const { showDownloadOption, validationError } = csv

            const allowedInputFormats = CountryNameFormatDefs.filter(
                (c) => c.use_as_input
            )
            const allowedOutputFormats = CountryNameFormatDefs.filter(
                (c) => c.use_as_output
            )

            return (
                <AdminLayout title="CountryStandardizer">
                    <main className="CountryStandardizerPage">
                        <section>
                            <h3>Country Standardizer Tool</h3>
                            <p>
                                Upload a CSV file with countries. Select the
                                current input and desired output format. The
                                tool will attempt to find a match automatically
                                for all entries. If not, you will be able to
                                select a similar entry or use a new name. After
                                which, you can download the file that has a new
                                column for your output countries.
                            </p>
                            <div className="form-group">
                                <div className="custom-file">
                                    <input
                                        type="file"
                                        className="custom-file-input"
                                        id="customFile"
                                        onChange={this.onChooseCSV}
                                    />
                                    <label
                                        htmlFor="customFile"
                                        className="custom-file-label"
                                    >
                                        {this.fileUploadLabel}
                                    </label>
                                </div>
                                <small
                                    id="custom-file-help-block"
                                    className="text-muted form-text"
                                >
                                    Country has to be saved under a column named
                                    'Country'
                                </small>
                            </div>
                            <SelectField
                                label="Input Format"
                                value={this.inputFormat}
                                onValue={this.onInputFormat}
                                options={allowedInputFormats.map((def) => ({
                                    value: def.key,
                                    label: def.label,
                                }))}
                                helpText="Choose the current format of the country names. If input format is other than the default, the tool won't attempt to find similar countries when there is no exact match."
                                data-step="1"
                            />
                            <SelectField
                                label="Output Format"
                                value={this.outputFormat}
                                onValue={this.onOutputFormat}
                                options={allowedOutputFormats.map((def) => ({
                                    value: def.key,
                                    label: def.label,
                                }))}
                                helpText="Choose the desired format of the country names. If the chosen format is other than OWID name, the tool won't attempt to find similar countries when there is no exact match."
                            />
                            <div className="topbar">
                                {showDownloadOption ? (
                                    <a
                                        href={this.csvDataUri}
                                        download={this.csvFilename}
                                        className="btn btn-secondary"
                                        onClick={this.onDownload}
                                        title={this.downloadTooltip}
                                    >
                                        <FontAwesomeIcon icon={faDownload} />{" "}
                                        Download {this.csvFilename}
                                    </a>
                                ) : (
                                    <button
                                        className="btn btn-secondary"
                                        disabled
                                    >
                                        <FontAwesomeIcon icon={faDownload} /> No
                                        file to download (upload a CSV to start)
                                    </button>
                                )}
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={this.showAllRows}
                                        onChange={this.onToggleRows}
                                    />{" "}
                                    Show All Rows
                                </label>
                            </div>
                            {validationError !== undefined ? (
                                <div
                                    className="alert alert-danger"
                                    role="alert"
                                >
                                    <strong>CSV Error:</strong>{" "}
                                    {validationError}
                                </div>
                            ) : (
                                <div></div>
                            )}
                            {this.displayMatchStatus}
                        </section>
                        <div>
                            <table className="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Original Name</th>
                                        <th>Standardized Name</th>
                                        <th>
                                            Potential Candidates (select below)
                                        </th>
                                        <th>Or enter a Custom Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entriesToShow.map((entry, i) => (
                                        <CountryEntryRowRenderer
                                            key={i}
                                            entry={entry}
                                            allCountries={this.csv.allCountries}
                                            onUpdate={this.onUpdateRow}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </main>
                </AdminLayout>
            )
        }
    }
)
