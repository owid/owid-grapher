import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { map, uniqBy, filter, keys, groupBy, isEmpty, difference, find, clone } from '../charts/Util'
import { observable, computed, action, autorun, reaction } from 'mobx'
import { observer } from 'mobx-react'

import * as parse from 'csv-parse'
import EditorModal from './EditorModal'

const styles = require('./Importer.css')

declare const App: any
declare const window: any

class Source {
    static template = ""

    @observable id?: number
    @observable name: string
    @observable dataPublishedBy: string
    @observable dataPublisherSource: string
    @observable link: string
    @observable retrievedDate: string
    @observable additionalInfo: string

    constructor({ id = null, name = "", dataPublishedBy = "", dataPublisherSource = "", link = "", retrievedDate = "", additionalInfo = "" } = {}) {
        this.id = id as any
        this.name = name
        this.dataPublishedBy = dataPublishedBy
        this.dataPublisherSource = dataPublisherSource
        this.link = link
        this.retrievedDate = retrievedDate
        this.additionalInfo = additionalInfo
    }
}

class Variable {
    @observable overwriteId?: number
    @observable name: string
    @observable unit: string
    @observable description: string
    @observable coverage: string
    @observable timespan: string
    @observable source: any
    @observable values: string[]

    constructor({ overwriteId = null, name = "", description = "", coverage = "", timespan = "", unit = "", source = null } = {}) {
        this.overwriteId = overwriteId as any
        this.name = name
        this.unit = unit
        this.coverage = coverage
        this.timespan = timespan
        this.description = description
        this.source = source
        this.values = []
    }
}

interface ExistingVariable {
    id: number
    name: string
    source: {
        id: number
        name: string
        description: string
    }
}

class Dataset {
    static fromServer(d: any) {
        return new Dataset({ id: d.id, name: d.name, description: d.description, subcategoryId: d.fk_dst_subcat_id })
    }

    @observable id: number | null
    @observable name: string
    @observable description: string
    @observable subcategoryId: number | null = null
    @observable existingVariables: ExistingVariable[] = []
    @observable newVariables: Variable[] = []
    @observable years: number[] = []
    @observable entities: number[] = []
    @observable entityNames: string[] = []
    @observable importError: string | null = null
    @observable importRequest = null
    @observable importSuccess = false

    constructor({ id = null, name = "", description = "", subcategoryId = null }: { id?: number, name?: string, description?: string, subcategoryId?: number } = {}) {
        this.id = id
        this.name = name
        this.description = description
        this.subcategoryId = subcategoryId

        // When a single source becomes available (either from the database or added by user) we
        // should use it as the default for all variables without a soruce
        reaction(
            () => this.sources[0] && this.newVariables,
            () => {
                const defaultSource = this.sources[0]
                if (!defaultSource) return

                for (const variable of this.newVariables) {
                    if (!variable.source)
                        variable.source = defaultSource
                }
            }
        )

        autorun(() => {
            if (this.id == null) return

            App.fetchJSON(`/admin/datasets/${this.id}.json`).then((data: any) => {
                // todo error handling
                this.existingVariables = data.variables
            })
        })

        // Match existing to new variables
        reaction(
            () => this.newVariables && this.existingVariables,
            () => {
                if (!this.newVariables || !this.existingVariables)
                    return

                this.newVariables.forEach(variable => {
                    const match = this.existingVariables.filter(v => v.name === variable.name)[0]
                    if (match) {
                        keys(match).forEach(key => {
                            if (key === 'id')
                                variable.overwriteId = (match as any)[key]
                            else
                                (variable as any)[key] = (match as any)[key]
                        })
                    }
                })
            }
        )
    }

    @computed get isLoading() {
        return this.id && !this.existingVariables.length
    }

    @computed get sources(): Array<{ name: string, description: string }> {
        const { newVariables, existingVariables } = this
        const sources = map(existingVariables, v => v.source).concat(map(newVariables, v => v.source))
        return uniqBy(filter(sources), source => source.id)
    }

    @action.bound save() {
        const { newVariables, entityNames, entities, years } = this

        const requestData = {
            dataset: {
                id: this.id,
                name: this.name,
                description: this.description,
                subcategoryId: this.subcategoryId
            },
            years, entityNames, entities,
            variables: newVariables
        }

        this.importError = null
        this.importSuccess = false
        this.importRequest = App.postJSON('/admin/import/variables', requestData).then((response: Response) => {
            if (response.status !== 200)
                return response.text().then(err => this.importError = err)
            else {
                return response.json().then(json => {
                    this.importSuccess = true
                    this.id = json.datasetId
                })
            }
        })
    }
}

@observer
class DataPreview extends React.Component<{ csv: CSV }> {
    @observable rowOffset: number = 0
    @observable visibleRows: number = 10
    @computed get numRows(): number {
        return this.props.csv.rows.length
    }

    @action.bound onScroll({ target }: { target: HTMLElement }) {
        const { scrollTop, scrollHeight } = target
        const { numRows } = this

        const rowOffset = Math.round(scrollTop / scrollHeight * numRows)
        target.scrollTop = Math.round(rowOffset / numRows * scrollHeight)

        this.rowOffset = rowOffset
    }

    render() {
        const { rows } = this.props.csv
        const { rowOffset, visibleRows, numRows } = this
        const height = 50

        return <div style={{ height: height * visibleRows, 'overflow-y': 'scroll' }} onScroll={this.onScroll as any}>
            <div style={{ height: height * numRows, 'padding-top': height * rowOffset }}>
                <table className="table" style={{ background: 'white' }}>
                    {map(rows.slice(rowOffset, rowOffset + visibleRows), (row, i) =>
                        <tr>
                            <td>{rowOffset + i + 1}</td>
                            {map(row, cell => <td style={{ height: height }}>{cell}</td>)}
                        </tr>
                    )}
                </table>
            </div>
        </div>
    }
}

@observer
class EditName extends React.Component<{ dataset: Dataset }> {
    @action.bound onInput(e: any) {
        this.props.dataset.name = e.target.value
    }

    render() {
        const { dataset } = this.props
        return <label>
            Name
            <input type="text" value={dataset.name} onInput={this.onInput} placeholder="Short name for your dataset" required />
        </label>
    }
}

@observer
class EditDescription extends React.Component<{ dataset: Dataset }> {
    @action.bound onInput(e: any) {
        this.props.dataset.description = e.target.value
    }

    render() {
        const { dataset } = this.props

        return <label>
            Description
            <textarea value={dataset.description} onInput={this.onInput} placeholder="Optional description for dataset" />
        </label>
    }
}

const EditCategory = ({ categories, dataset }: any) => {
    const categoriesByParent = groupBy(categories, (category: any) => category.parent)

    return <label>
        Category <span className="form-section-desc">(Currently used only for internal organization)</span>
        <select onChange={e => dataset.subcategoryId = e.target.value} value={dataset.subcategoryId}>
            {map(categoriesByParent, (subcats, parent) =>
                <optgroup label={parent}>
                    {map(subcats, category =>
                        <option value={category.id}>{category.name}</option>
                    )}
                </optgroup>
            )}
        </select>
    </label>
}

@observer
class EditVariable extends React.Component<{ variable: Variable, dataset: Dataset }> {
    @observable isEditingSource: boolean = false

    @action.bound onEditSource(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault()
        this.isEditingSource = !this.isEditingSource
    }

    render() {
        const { variable, dataset } = this.props
        const { isEditingSource } = this

        const sourceName = variable.source && (variable.source.id ? variable.source.name : `New: ${variable.source.name}`)

        return <li className={styles.editVariable}>
            <div className="variableProps">
                <label className="name">
                    Name <br />
                    <span className="form-section-desc explanatory-notes">The variable name will be displayed in charts ('Sources' tab). For charts with many variables, the name will be crucial for readers to understand which sources correspond to which variables. <br /> Variable name should be of the format "Minimal variable description (Source)". For example: "Top marignal income tax rate (Piketty 2014)". Or "Tax revenue as share of GDP (ICTD 2016)"</span>
                    <input value={variable.name} onInput={e => variable.name = e.currentTarget.value} placeholder="Enter variable name" />
                </label>
                <label className="description">
                    Description <br />
                    <span className="form-section-desc explanatory-notes">
                        The variable  description will be displayed in charts (‘Sources’ tab). It will be the first row in the table explaining the variable sources.<br />
                        Variable descriptions should be concise but clear and self-contained. They will correspond, roughly, to the information that will go in the subtitle of charts. <br />
                        For example: “Percentage of the population covered by health insurance (includes affiliated members of health insurance or estimation of the population having free access to health care services provided by the State)”</span>
                    <textarea rows={4} placeholder="Short description of variable" value={variable.description} onInput={e => variable.description = e.currentTarget.value} />
                </label>
                <label>Unit <span className="form-section-desc explanatory-notes">(is displayed in axis-labels as suffix and in the legend of the map)</span>
                    <input value={variable.unit} onInput={e => variable.unit = e.currentTarget.value} placeholder="e.g. % or $" /></label>
                <label>Geographic Coverage<input value={variable.coverage} onInput={e => variable.coverage = e.currentTarget.value} placeholder="e.g. Global by country" /></label>
                <label>Time Span<input value={variable.timespan} onInput={e => variable.timespan = e.currentTarget.value} placeholder="e.g. 1920-1990" /></label>
                <label>Source
                    <button className="clickable" onClick={this.onEditSource} style={{ position: 'relative' }}>
                        <i className="fa fa-pencil" /> {sourceName || 'Add source'}
                        <input type="text" value={variable.source && variable.source.name} required style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0 }} />
                    </button>
                </label>
                <label>Action
                    <select onChange={e => { variable.overwriteId = e.target.value ? parseInt(e.target.value) : undefined }}>
                        <option value="" selected={variable.overwriteId == null}>Create new variable</option>
                        {map(dataset.existingVariables, v =>
                            <option value={v.id} selected={variable.overwriteId === v.id}>Overwrite {v.name}</option>
                        )}
                    </select>
                </label>
            </div>
            {isEditingSource && <EditSource variable={variable} dataset={dataset} onSave={() => this.isEditingSource = false} />}
        </li>
    }
}

@observer
class EditVariables extends React.Component<{ dataset: Dataset }> {
    render() {
        const { dataset } = this.props

        return <section className="form-section variables-section">
            <h3>Variable names and descriptions</h3>
            <p className="form-section-desc">Here you can configure the variables that will be stored for your dataset.</p>
            <ol>
                {map(dataset.newVariables, variable =>
                    <EditVariable variable={variable} dataset={dataset} />
                )}
            </ol>
        </section>
    }
}

@observer
class EditSource extends React.Component<{ variable: Variable, dataset: Dataset, onSave: () => void }> {
    @observable source: any = null

    constructor(props: { variable: Variable }) {
        super()
        this.source = props.variable.source || new Source()
    }

    componentDidMount() {
        reaction(
            () => this.props.variable.source,
            () => this.source = this.props.variable.source || this.source
        )
    }

    @action.bound onChangeSource(e: any) {
        const name = e.target.value
        this.source = this.props.dataset.sources.filter(source => source.name === name)[0] || new Source()
    }

    @action.bound onSave(e: any) {
        e.preventDefault()
        this.props.variable.source = this.source
        this.props.onSave()
    }

    render() {
        const { dataset } = this.props
        const { source } = this

        return <form className={styles.editSource} onSubmit={this.onSave}>
            <hr />
            <h4>Edit source</h4>
            <label>
                <span>Source:</span>
                <select onChange={this.onChangeSource}>
                    <option selected={!source.id}>Create new</option>
                    {map(dataset.sources, otherSource =>
                        <option value={otherSource.name} selected={source.name === otherSource.name}>{otherSource.name}</option>
                    )}
                </select>
            </label>
            <label>
                <span>Name:</span>
                <input type="text" required value={source.name} onInput={e => source.name = e.currentTarget.value} />
            </label>
            <p className="form-section-desc">
                The source name will be displayed in charts (at the bottom of the ‘Chart’ and ‘Map’ tabs). For academic papers, the name of the source should be “Authors (year)”. For example Arroyo-Abad and Lindert (2016). <br />
                For institutional projects or reports, the name should be “Institution, Project (year or vintage)”. For example: U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). <br />
                For data that we have modified extensively, the name should be "Our World In Data based on Author (year)”. For example: Our World In Data based on Atkinson (2002) and Sen (2000).
            </p>
            <div className="editSourceDescription">
                <label className="description">
                    <label>
                        <span>Data published by:</span>
                        <input type="text" value={source.dataPublishedBy} onInput={e => source.dataPublishedBy = e.currentTarget.value} />
                    </label>
                    <label>
                        <span>Data publisher's source:</span>
                        <input type="text" value={source.dataPublisherSource} onInput={e => source.dataPublisherSource = e.currentTarget.value} />
                    </label>
                    <label>
                        <span>Link:</span>
                        <input type="text" value={source.link} onInput={e => source.link = e.currentTarget.value} />
                    </label>
                    <label>
                        <span>Retrieved date:</span>
                        <input type="text" value={source.retrievedDate} onInput={e => source.retrievedDate = e.currentTarget.value} />
                    </label>
                    <label>
                        <span>Additional Information:</span>
                        <textarea rows={5} value={source.additionalInfo} onInput={e => source.additionalInfo = e.currentTarget.value}></textarea>
                    </label>
                </label>
            </div>
            <p className="form-section-desc">
                For academic papers, the first item in the description should be “Data published by: complete reference”.  This should be followed by the authors underlying sources, a link to the paper, and the date on which the paper was accessed. <br />
                For institutional projects, the format should be similar, but detailing the corresponding project or report. <br />
                For data that we have modified extensively in order to change the meaning of the data, we should list OWID as publisher, and provide the name of the person in charge of the calculation.<br />
                The field “Data publisher’s source” should give basic pointers (e.g. surveys data). Anything longer than a line should be relegated to the field “Additional information”. <br />
                Sometimes it is necessary to change the structure of this description. (e.g. the row dedicated to ‘Link’ or Data publisher’s source has to be deleted).
            </p>
            {source.id && <p className="existing-source-warning text-warning">
                <i className="fa fa-warning"></i> You are editing an existing source. Changes may also affect other variables.
            </p>}
            <input type="submit" className="btn btn-success" value="Save" />
        </form>
    }
}

@observer
class ImportProgressModal extends React.Component<{ dataset: Dataset }> {
    @action.bound onDismiss() {
        const { dataset } = this.props
        dataset.importRequest = null
    }

    render() {
        const { dataset } = this.props
        return <div className={styles.importProgress}>
            <h4>Import progress</h4>
            <div className="progressInner">
                <p className="success"><i className="fa fa-check" /> Preparing import for {dataset.years.length} values...</p>
                {dataset.importError && <p className="error"><i className="fa fa-times" /> Error: {dataset.importError}</p>}
                {dataset.importSuccess && <p className="success"><i className="fa fa-check" /> Import successful!</p>}
                {!dataset.importSuccess && !dataset.importError && <div style={{ 'text-align': 'center' }}><i className="fa fa-spin fa-spinner" /></div>}
            </div>
            {dataset.importSuccess && <a className="btn btn-success" href={App.url(`/admin/datasets/${dataset.id}`)}>Done</a>}
            {dataset.importError && <a className="btn btn-warning" onClick={this.onDismiss}>Dismiss</a>}
        </div>
    }
}

class CSV {
    static transformSingleLayout(rows: string[][]) {
        const newRows = [['Entity', 'Year', (this as any).basename]]

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

        const variables: any[] = []
        const entityNameCheck: any = {}
        const entityNames = []
        const entities = []
        const years = []

        const headingRow = rows[0]
        for (const name of headingRow.slice(2))
            variables.push(new Variable({ name }))

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const entityName = row[0], year = row[1]

            let entity = entityNameCheck[entityName]
            if (entity === undefined) {
                entity = entityNames.length
                entityNames.push(entityName)
                entityNameCheck[entityName] = entity
            }
            entities.push(entity)
            years.push(+year)
            row.slice(2).forEach((value, j) => {
                variables[j].values.push(value)
            })
        }

        return {
            variables: variables,
            entityNames: entityNames,
            entities: entities,
            years: years
        }
    }

    @computed get validation(): any {
        const validation: { results: Array<{ class: string, message: string }>, passed: boolean } = { results: [], passed: false }
        const { rows } = this

        // Check we actually have enough data
        if (rows[0].length < 3) {
            validation.results.push({
                class: 'error',
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
                class: 'error',
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
                    class: 'error',
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
                    nonNumeric.push(i + 1 + " `" + row[j] + "`")
            }
        }

        if (nonNumeric.length)
            validation.results.push({
                class: 'warning',
                message: "Non-numeric data detected on line " + nonNumeric.join(", ")
            })

        // Warn if we're creating novel entities
        const newEntities = difference(this.data.entityNames, this.existingEntities)
        if (newEntities.length >= 1) {
            validation.results.push({
                class: 'warning',
                message: `These entities were not found in the database and will be created: ${newEntities.join(', ')}`
            })
        }

        validation.passed = !find(validation.results, result => result.class === "error")

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
class ValidationResults extends React.Component<{ validation: any }> {
    render() {
        const { validation } = this.props

        return <section className={styles.validation}>
            {map(validation.results, (v: any) =>
                <div className={`alert alert-${v.class}`}>{v.message}</div>
            )}
        </section>
    }
}

@observer
class CSVSelector extends React.Component<{ existingEntities: string[], onCSV: (csv: CSV) => void }> {
    @observable csv: CSV | null = null

    @action.bound onChooseCSV({ target }: { target: HTMLInputElement }) {
        const { existingEntities } = this.props
        const file = target.files && target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const csv = (e as any).target.result
            parse(csv, { relax_column_count: true, skip_empty_lines: true, rtrim: true },
                (_, rows) => {
                    // TODO error handling
                    //console.log("Error?", err)
                    if (rows[0][0].toLowerCase() === 'year')
                        rows = CSV.transformSingleLayout(rows)
                    this.csv = new CSV({ filename: file.name, rows, existingEntities } as any)
                    this.props.onCSV(this.csv as any)
                }
            )
        }
        reader.readAsText(file)
    }

    render() {
        const { csv } = this

        return <section>
            <input type="file" onChange={this.onChooseCSV} />
            {csv && <DataPreview csv={csv} />}
            {csv && <ValidationResults validation={csv.validation} />}
        </section>
    }
}

@observer
export default class Importer extends React.Component<{ datasets: any[], categories: any[], sourceTemplate: string, existingEntities: string[] }> {
    static bootstrap(props: any) {
        ReactDOM.render(<Importer datasets={props.datasets} categories={props.categories} sourceTemplate={props.sourceTemplate.meta_value} existingEntities={props.entityNames} />, document.getElementById("import-view"))
    }

    @observable csv: CSV
    @observable.ref dataset = new Dataset()

    @action.bound onChooseDataset({ target }: { target: HTMLSelectElement }) {
        const d = this.props.datasets[target.selectedIndex - 1]
        this.dataset = d ? Dataset.fromServer(d) : new Dataset()
        this.fillDataset(this.dataset)
    }

    @action.bound onCSV(csv: CSV) {
        this.csv = csv
        const match = filter(this.props.datasets, d => d.name === csv.basename)[0]
        this.dataset = match ? Dataset.fromServer(match) : new Dataset()
        this.fillDataset(this.dataset)
    }

    fillDataset(dataset: Dataset) {
        const { csv } = this
        if (!dataset.name)
            dataset.name = csv.basename

        dataset.newVariables = map(csv.data.variables, clone)
        dataset.entityNames = csv.data.entityNames
        dataset.entities = csv.data.entities
        dataset.years = csv.data.years
    }

    @action.bound onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        this.dataset.save()
    }

    render() {
        const { csv, dataset } = this
        const { datasets, categories, existingEntities } = this.props

        if (App.isDebug) {
            window.Importer = this
            window.dataset = dataset
        }

        Source.template = this.props.sourceTemplate

        if (dataset.subcategoryId == null) {
            dataset.subcategoryId = (find(categories, c => c.name === "Uncategorized") || {}).id
        }

        return <form className={styles.importer} onSubmit={this.onSubmit}>
            <h2>Import CSV file</h2>
            <p>Examples of valid layouts: <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png">single variable</a>, <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png">multiple variables</a>. The multivar layout is preferred. <span className="form-section-desc">CSV files only: <a href="https://ourworldindata.org/how-to-our-world-in-data-guide/#1-2-single-variable-datasets">csv file format guide</a></span></p>
            <CSVSelector onCSV={this.onCSV} existingEntities={existingEntities} />

            {csv && csv.isValid && <section>
                <p style={{ opacity: dataset.id ? 1 : 0 }} className="updateWarning">Updating existing dataset</p>
                <select className="chooseDataset" onChange={this.onChooseDataset}>
                    <option selected={dataset.id == null}>Create new dataset</option>
                    {map(datasets, (d) =>
                        <option value={d.id} selected={d.id === dataset.id}>{d.name}</option>
                    )}
                </select>
                <hr />
                <h3>Dataset name and description</h3>
                <p>The dataset name and description are for our own internal use and do not appear on the charts.<br />
                    <span className="form-section-desc explanatory-notes">Dataset name should include a basic description of the variables, followed by the source and year. For example: "Government Revenue Data – ICTD (2016)"</span></p>
                <EditName dataset={dataset} />
                <hr />
                <EditDescription dataset={dataset} />
                <hr />
                <EditCategory dataset={dataset} categories={categories} />
                <hr />

                {dataset.isLoading && <i className="fa fa-spinner fa-spin"></i>}
                {!dataset.isLoading && [
                    <EditVariables dataset={dataset} />,
                    <input type="submit" className="btn btn-success" value={dataset.id ? "Update dataset" : "Create dataset"} />,
                    dataset.importRequest && <EditorModal>
                        <ImportProgressModal dataset={dataset} />
                    </EditorModal>
                ]}
            </section>}
        </form>
    }
}
