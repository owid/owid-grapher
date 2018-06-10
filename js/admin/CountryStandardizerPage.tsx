import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
import * as parse from 'csv-parse'

const fuzzysort = require("fuzzysort")
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { LoadingBlocker, FieldsRow, SelectField } from './Forms'
import { sortedUniq, keyBy } from '../charts/Util'
import Link from './Link'
import CountryNameFormat, { CountryNameFormatDefs } from '../standardizer/CountryNameFormat'

class CSV {
    @observable filename: string = ""
    @observable rows: string[][]
    @observable countryEntriesMap: Map<string, CountryEntry>
    @observable mapCountriesInputToOutput: { [key:string]: string }

    constructor() {
        this.countryEntriesMap = new Map<string, CountryEntry>()
        this.rows = []
        this.mapCountriesInputToOutput = {}
    }

    @computed get countryColumnIndex() {
        const { rows } = this
        if (rows.length == 0) {
            return -1
        }
        return rows[0].findIndex((column_name:string) => column_name.toLowerCase() == "country")
    }

    @computed get showDownloadOption() {
        const { rows } = this
        if (rows.length > 0) {
            return true
        }
        return false
    }

    @action.bound onFileUpload(filename:string, rows: string[][]) {
        this.filename = filename
        this.rows = rows
        this.parseCSV()
    }

    @action.bound onFormatChange(countryMap: any) {
        this.mapCountriesInputToOutput = countryMap
        this.parseCSV()
    }

    parseCSV() {
        console.log("parsing CSV")

        const { rows, countryColumnIndex, mapCountriesInputToOutput } = this

        let entriesByCountry = new Map<string, CountryEntry>()
        let countries = rows.slice(1).map((row:string[]) => row[countryColumnIndex] as string )

        // for fuzzy-sort
        let targetValues = Object.keys(mapCountriesInputToOutput).map(key => fuzzysort.prepare(mapCountriesInputToOutput[key]))

        countries.map((country:string) => {
            let outputCountry = mapCountriesInputToOutput[country]
            let approximatedMatches:FuzzyMatch[] = []

            if (outputCountry === undefined) {
                approximatedMatches = fuzzysort.go(country, targetValues)
            }
            let entry:CountryEntry = {
                originalName: country,
                standardizedName: mapCountriesInputToOutput[country],
                approximatedMatches: approximatedMatches,
                selectedMatch: "",
                customName: ""
            }
            entriesByCountry.set(country, entry)
        })

        this.countryEntriesMap = entriesByCountry
    }

}

interface FuzzyMatch {
    [key:string]: any
}

export interface CountryEntry extends React.HTMLAttributes<HTMLTableRowElement> {
    originalName: string
    standardizedName: string
    approximatedMatches: FuzzyMatch[]
    selectedMatch: string|undefined
    customName: string|undefined
}


@observer
export class CountryEntryRowRenderer extends React.Component<{ entry: CountryEntry, onUpdate: Function } > {
    @observable selectedStandardName!: string

    defaultOption() {
        return "Select one"
    }

    @computed get isMatched(): boolean {
        const { entry } = this.props

        if (entry.standardizedName !== undefined && entry.standardizedName.length > 0) {
            return true
        }
        if (entry.selectedMatch !== undefined && entry.selectedMatch.length > 0) {
            return true
        }
        if (entry.customName !== undefined && entry.customName.length > 0) {
            return true
        }
        return false
    }

    @computed get defaultValue() {
        const { entry } = this.props

        if (entry.selectedMatch !== undefined && entry.selectedMatch.length > 0) {
            return entry.selectedMatch
        }
        return this.defaultOption()
    }

    @action.bound onEntrySelected(selectedName: string) {
        const { entry, onUpdate } = this.props

        let value = selectedName == this.defaultOption() ? undefined : selectedName
        onUpdate(selectedName, entry.originalName, false)
    }

    render() {
        const { entry, onUpdate } = this.props
        const { defaultValue, isMatched } = this
        const defaultOption = this.defaultOption()

        return <tr>
                <td><span style={{color: isMatched ? "black" : "red"}}>{ entry.originalName }</span></td>
                <td>{ entry.standardizedName }</td>
                <td>{ entry.approximatedMatches.length > 0 ?
                    <SelectField value={defaultValue} onValue={this.onEntrySelected} options={[defaultOption].concat(entry.approximatedMatches.map(fuzzyMatch => fuzzyMatch['target']))} optionLabels={[defaultOption].concat(entry.approximatedMatches.map(fuzzyMatch => fuzzyMatch['target']))} /> :
                    <span>No candidates found</span> }
                </td>
                <td><input type="text" className="form-control" value={entry.customName} onChange={e => onUpdate(e.currentTarget.value, entry.originalName, true) } /></td>
            </tr>
    }
}

@observer
export default class CountryStandardizerPage extends React.Component {
    context!: { admin: Admin }
    fileUploader!: HTMLInputElement

    @observable countryList: CountryEntry[] = []
    @observable inputFormat: string = CountryNameFormat.OurWorldInDataName
    @observable outputFormat: string = CountryNameFormat.OurWorldInDataName
    @observable csv: CSV = new CSV()
    @observable showAllRows: boolean = false

    @action.bound onInputFormat(format: string) {
        this.inputFormat = format
        this.fetchCountryMap(this.inputFormat, this.outputFormat)
    }

    @action.bound onOutputFormat(format: string) {
        this.outputFormat = format
        this.fetchCountryMap(this.inputFormat, this.outputFormat)
    }

    @action.bound onChooseCSV({ target }: { target: HTMLInputElement }) {
        const file = target.files && target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const csv = (e as any).target.result
            parse(csv, { relax_column_count: true, skip_empty_lines: true, rtrim: true },
                (_, rows) => {
                    this.csv.onFileUpload(file.name, rows)
                }
            )
        }
        reader.readAsText(file)
    }

    componentDidMount() {
        this.fetchCountryMap(this.inputFormat, this.outputFormat)
    }

    async fetchCountryMap(inputFormat: string, outputFormat: string) {
        if (inputFormat === undefined || outputFormat === undefined)
            return

        console.log("fetch input -> output country mapping")
        const { admin }  = this.context
        const results = await admin.getJSON(`/api/countries.json?input=` + inputFormat + `&output=` + outputFormat)

        let countryMap: { [key:string]: string} = {}
        results.countries.forEach((countryFormat:any) => {
            countryMap[countryFormat.input] = countryFormat.output
        })
        runInAction(() => {
            this.csv.onFormatChange(countryMap)
        })
    }

    csvDataUri(): string {
        return window.URL.createObjectURL(this.outputCSV())
    }

    csvFilename(): string {
        const { csv } = this
        return csv.filename.replace(".csv", "_country_standardized.csv")
    }

    outputCSV() {
        const { csv } = this

        if (csv === undefined)
            return null

        const columnName = this.outputFormat
        const columnIndex = csv.countryColumnIndex + 1
        let sRows:any[] = []

        // add a new column with the output country name
        csv.rows.forEach((row, rowIndex) => {
            let columnValue:string = ""

            if (rowIndex == 0) {
                columnValue = columnName
            }
            else {
                // prioritize user selected name
                let entry = csv.countryEntriesMap.get(row[csv.countryColumnIndex]) as CountryEntry
                if (entry.customName !== undefined && entry.customName.length > 0) {
                    columnValue = entry.customName
                }
                else if (entry.standardizedName !== undefined) {
                    columnValue = entry.standardizedName
                }
                else if (entry.selectedMatch !== undefined && entry.selectedMatch.length > 0) {
                    columnValue = entry.selectedMatch
                }
            }

            let newRow = row.slice(0)
            newRow.splice(columnIndex, 0, columnValue)
            sRows.push(newRow)
        })

        return new Blob([sRows.join("\n")], { type: "text/csv" })
    }

    @action.bound onUpdateRow(value: string, inputCountry: string, isCustom: boolean) {
        const { csv } = this

        let entry = csv.countryEntriesMap.get(inputCountry) as CountryEntry
        console.log("updating " + inputCountry + " with " + value)

        if (isCustom) {
            entry.customName = value === undefined ? "" : value
        }
        else {
            entry.selectedMatch = value
        }
    }

    // IE11 compatibility
    @action.bound onDownload(ev: React.MouseEvent<HTMLAnchorElement>) {

        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(this.outputCSV(), this.csvFilename())
            ev.preventDefault()
        }
    }

    @action.bound onToggleRows() {
        this.showAllRows = !this.showAllRows
    }

    render() {
        const { csv } = this
        const { showDownloadOption } = csv

        let allowedInputFormats = CountryNameFormatDefs.filter(c => c.use_as_input)
        let allowedOutputFormats = CountryNameFormatDefs.filter(c => c.use_as_output)

        let countries:string[] = []

        if (csv !== undefined) {
            csv.countryEntriesMap.forEach((countryEntry, country) => {
                if (this.showAllRows) {
                    countries.push(country)
                }
                else if (countryEntry.standardizedName === undefined) {
                    countries.push(country)
                }
            })
        }

        return <AdminLayout title="CountryStandardizer">
            <main className="CountryStandardizerPage">
                <section style={{ paddingBottom: "1.5em" }}>
                    <SelectField label="Input Format" value={CountryNameFormat.OurWorldInDataName} onValue={this.onInputFormat} options={CountryNameFormatDefs.map(def => def.key)} optionLabels={CountryNameFormatDefs.map(def => def.label)}/>
                    <SelectField label="Output Format" value={CountryNameFormat.OurWorldInDataName} onValue={this.onOutputFormat} options={allowedOutputFormats.map(def => def.key)} optionLabels={allowedOutputFormats.map(def => def.label)}/>
                    <div className="topbar">
                        <input type="file" onChange={this.onChooseCSV} accept=".csv" />
                        {showDownloadOption ?
                            <a href={this.csvDataUri()} download={this.csvFilename()} className="btn btn-secondary" onClick={this.onDownload}><i className="fa fa-download"></i> {this.csvFilename()}</a>
                            : <div></div>
                        }
                    </div>
                    <FieldsRow>
                        <label><input type="checkbox" checked={this.showAllRows} onChange={this.onToggleRows} /> Show All Rows</label>
                    </FieldsRow>
                </section>
                <div>
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th>Original Name</th>
                                <th>Standardized Name</th>
                                <th>Potential Candidates</th>
                                <th>Custom Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {countries.map((country: string) => <CountryEntryRowRenderer entry={(csv.countryEntriesMap.get(country) as CountryEntry) } onUpdate={this.onUpdateRow} /> ) }
                        </tbody>
                    </table>
                </div>
            </main>
        </AdminLayout>
    }
}
