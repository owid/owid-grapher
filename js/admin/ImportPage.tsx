// TODO upgrade this

import * as React from 'react'
import { map, uniqBy, filter, keys, groupBy, isEmpty, difference, find, clone } from '../charts/Util'
import { observable, computed, action, autorun, reaction } from 'mobx'
import { observer } from 'mobx-react'

import * as parse from 'csv-parse'
import { Modal } from '../admin/Forms'
import AdminLayout from './AdminLayout'
import Admin from './Admin'
import * as _ from 'lodash'

interface CSV {
    filename: string
    rows: string[][]
}

function transformSingleToMulti(rows: string[][], variableName: string): string[][] {
    const newRows = [['Entity', 'Year', variableName]]

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

interface Validation {
    results: { class: string, message: string }[]
    passed: boolean
}

// Transform to process CSV file and selected import options for the server
class DatasetTransform {
    @observable csv: CSV
    @observable unknownEntities?: string[] = []

    constructor(csv: CSV) {
        this.csv = csv
    }

    // Infer default name of dataset from the csv filename
    @computed get defaultName() {
        return (this.csv.filename.match(/(.*?)(.csv)?$/) || [])[1]
    }

    // Importer accepts two CSV layouts
    // Single-variable: https://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png
    // Multi-variable: https://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png
    @computed get csvLayout(): 'single'|'multi' {
        return this.csv.rows[0][0].toLowerCase() === 'year' ? 'single' : 'multi'
    }

    // We transform single to multi so we can work with the one format in the code
    @computed get rows(): string[][] {
        if (this.csvLayout === 'multi')
            return this.csv.rows.slice(1)
        else
            return transformSingleToMulti(this.csv.rows, this.defaultName).slice(1)
    }

    @computed get entitiesUniq(): string[] {
        return _.uniq(this.rows.map(row => row[0]))
    }

    @computed get validation(): Validation {
        const validation: Validation = { results: [], passed: false }
        const { rows } = this

        // Check we actually have enough data
        if (rows[0].length < 3) {
            validation.results.push({
                class: 'danger',
                message: `No variables detected. CSV should have at least 3 columns.`
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
                class: 'danger',
                message: `Invalid or missing entity/year on lines: ${invalidLines.join(', ')}`
            })
        }

        // Check for duplicates
        const uniqCheck: any = {}
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const entityName = row[0], year = row[1]
            const key = entityName + '-' + year
            uniqCheck[key] = uniqCheck[key] || 0
            uniqCheck[key] += 1
        }

        keys(uniqCheck).forEach(key => {
            const count = uniqCheck[key]
            if (count > 1) {
                validation.results.push({
                    class: 'danger',
                    message: `Duplicates detected: ${count} instances of ${key}.`
                })
            }
        })

        // Warn about non-numeric data
        const nonNumeric = []
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            for (let j = 2; j < row.length; j++) {
                if (row[j] !== '' && (isNaN(parseFloat(row[j])) || !row[j].match(/^[0-9.-]+$/)))
                    nonNumeric.push(`${i + 1}` + " `" + row[j] + "`")
            }
        }

        if (nonNumeric.length)
            validation.results.push({
                class: 'warning',
                message: "Non-numeric data detected on line " + nonNumeric.join(", ")
            })

        // Warn if we're creating novel entities
        if (this.unknownEntities && this.unknownEntities.length >= 1) {
            validation.results.push({
                class: 'warning',
                message: `These entities were not found in the database and will be created: ${this.unknownEntities.join(', ')}`
            })
        }

        validation.passed = !validation.results.find(result => result.class === "error")

        return validation
    }

}

@observer
class CSVSelector extends React.Component<{ onCSV: (csv: CSV) => void }> {
    @action.bound onChooseFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files && e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            const csv = (ev as any).target.result
            parse(csv, { relax_column_count: true, skip_empty_lines: true, rtrim: true },
                (err, rows) => {
                    if (err) {
                        console.error(err)
                    }
                    this.props.onCSV({ filename: file.name, rows: rows })
                }
            )
        }
        reader.readAsText(file)
    }

    render() {
        return <section>
            <input type="file" onChange={this.onChooseFile} />
        </section>
    }
}

// Show all the rows, using faux scrolling trickery to fit big datasets
// TODO make this better
@observer
class DataPreview extends React.Component<{ dataset: DatasetTransform }> {
    @observable rowOffset: number = 0
    @observable visibleRows: number = 10
    @computed get numRows(): number {
        return this.props.dataset.rows.length
    }

    @action.bound onScroll({ target }: { target: HTMLElement }) {
        const { scrollTop, scrollHeight } = target
        const { numRows } = this

        const rowOffset = Math.round(scrollTop / scrollHeight * numRows)
        target.scrollTop = Math.round(rowOffset / numRows * scrollHeight)

        this.rowOffset = rowOffset
    }

    render() {
        const { rows } = this.props.dataset
        const { rowOffset, visibleRows, numRows } = this
        const height = 50

        return <div style={{ height: height * visibleRows, overflowY: 'scroll' }} onScroll={this.onScroll as any}>
            <div style={{ height: height * numRows, paddingTop: height * rowOffset }}>
                <table className="table" style={{ background: 'white' }}>
                    {rows.slice(rowOffset, rowOffset + visibleRows).map((row, i) =>
                        <tr>
                            <td>{rowOffset + i + 1}</td>
                            {row.map(cell => <td style={{ height: height }}>{cell}</td>)}
                        </tr>
                    )}
                </table>
            </div>
        </div>
    }
}

@observer
class RowsValidation extends React.Component<{ dataset: DatasetTransform }> {
    // Initial validation: ask the server which entities are in the db
    async validateCSV() {
        const json = await this.context.admin.requestJSON("/api/importValidate", { entities: this.props.dataset.entitiesUniq }, "POST")
        this.props.dataset.unknownEntities = json.unknownEntities
    }

    componentDidMount() {
        this.validateCSV()
    }

    render() {
        return <section>
            {this.props.dataset.validation.results.map(v =>
                <div className={`alert alert-${v.class}`}>{v.message}</div>
            )}
        </section>
    }
}

@observer
export default class ImportPage extends React.Component {
    context!: { admin: Admin }
    @observable.ref dataset?: DatasetTransform

    async getData() {
        const json = await this.context.admin.getJSON("/api/importData.json")
    }

    @action.bound onCSV(csv: CSV) {
        this.dataset = new DatasetTransform(csv)
    }

    render() {
//        const { csv, dataset } = this
        /*if (dataset.subcategoryId == null) {
            dataset.subcategoryId = (find(categories, c => c.name === "Uncategorized") || {}).id
        }*/

        return <AdminLayout>
            <main className="ImportPage">
                <form className="importer">
                    <h2>Import CSV file</h2>
                    <p>Examples of valid layouts: <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png">single variable</a>, <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png">multiple variables</a>. The multivar layout is preferred. <span className="form-section-desc">CSV files only: <a href="https://ourworldindata.org/how-to-our-world-in-data-guide/#1-2-single-variable-datasets">csv file format guide</a></span></p>
                    <CSVSelector onCSV={this.onCSV}/>
                    {this.dataset && <DataPreview dataset={this.dataset}/>}
                    {this.dataset && <RowsValidation dataset={this.dataset}/>}
                </form>
            </main>
        </AdminLayout>
    }
}