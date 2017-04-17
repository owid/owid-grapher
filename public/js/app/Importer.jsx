/* Importer.jsx
 * ================                                                             
 *
 * Frontend for editing datasets.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-17
 */ 

// @flow

import * as _ from 'underscore'
import owid from '../owid'	

import React, {Component} from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import {bind} from 'decko'

import parse from 'csv-parse'
import {NullElement} from './Util'

import styles from './Importer.css'

import Modal from 'react-modal'

class Source {
	static template = ""

	@observable id : ?number
	@observable name : string
	@observable description : string

	constructor({id = null, name = "", description = ""} = {}) {
		this.id = id
		this.name = name
		this.description = description || Source.template
	}
}

class Variable {
	@observable overwriteId : ?number
	@observable name : string
	@observable unit : string
	@observable description : string
	@observable coverage : string
	@observable timespan : string
	@observable source : Object
	@observable values : string[]

	constructor({overwriteId = null, name = "", description = "", coverage = "", timespan = "", unit = "", source = null, values = []} = {}) {
		this.overwriteId = overwriteId
		this.name = name
		this.unit = unit
		this.coverage = coverage
		this.timespan = timespan
		this.description = description
		this.source = source
		this.values = []
	}
}

class Dataset {
	@observable id : number
	@observable name : string
	@observable description : string
	@observable subcategoryId : number = null
	@observable existingVariables : Object[] = []
	@observable newVariables : Object[] = []
	@observable years : number[] = []
	@observable entities : number[] = []
	@observable entityNames : string[] = []
	@observable importError = null
	@observable importRequest = null
	@observable importSuccess = false


	static fromServer(d) {
		return new Dataset({id: d.id, name: d.name, description: d.description, subcategoryId: d.fk_dst_subcat_id})
	}

	@computed get isLoading() {
		return this.id && !this.existingVariables.length
	}

	@computed get sources() {
		const {newVariables, existingVariables} = this
		const sources = _.pluck(existingVariables.concat(newVariables), 'source')		
		return _.uniq(_.filter(sources), source => source.id)
	}

	@action.bound save() {
		const {id, name, description, subcategoryId, newVariables, entityNames, entities, years} = this

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
		this.importRequest = App.postJSON('/import/variables', requestData).then(response => {
			if (response.status != 200)
				return response.text().then(err => this.importError = err)
			else {
				return response.json().then(json => {
					console.log(json)
					this.importSuccess = true
					this.id = json.datasetId
				})
			}
		})
	}

	constructor({id = null, name = "", description = "", subcategoryId = null} : {name: string, description: string, subcategoryId: number} = {}) {
		this.id = id
		this.name = name
		this.description = description
		this.subcategoryId = subcategoryId

		// When a single source becomes available (either from the database or added by user) we
		// should use it as the default for all variables without a soruce
		autorun(() => {
			const defaultSource = this.sources[0]
			if (!defaultSource) return

			for (let variable of this.newVariables) {
				if (!variable.source)
					variable.source = defaultSource
			}
		})

		autorun(() => {
			if (this.id == null) return; 

			App.fetchJSON(`/datasets/${this.id}.json`).then(data => {
				// todo error handling
				this.existingVariables = data.variables
			})
		})

		// Match existing to new variables
		autorun(() => {
			if (!this.newVariables || !this.existingVariables)
				return

			this.newVariables.forEach(variable => {
				const match = this.existingVariables.filter(v => v.name == variable.name)[0]
				if (match) {
					_.keys(match).forEach(key => {
						if (key == 'id')
							variable.overwriteId = match[key]
						else
							variable[key] = match[key]
					})
				}
			})
		})
	}
}

@observer
class DataPreview extends Component {
	@observable rowOffset : number = 0
	@observable visibleRows : number = 10
	@computed get numRows() : number {
		return this.props.csv.rows.length
	}

	@action.bound onScroll({target} : {target: HTMLElement}) {
		const {scrollTop, scrollHeight} = target
		const {numRows} = this

		const rowOffset = Math.round(scrollTop/scrollHeight * numRows)
		target.scrollTop = Math.round(rowOffset/numRows * scrollHeight)

		this.rowOffset = rowOffset
	}

	render() {
		const {rows} = this.props.csv
		const {rowOffset, visibleRows, numRows} = this
		const height = 50

		return <div style={{height: height*visibleRows, 'overflow-y': 'scroll'}} onScroll={this.onScroll}>
			<div style={{height: height*numRows, 'padding-top': height*rowOffset}}>
				<table class="table" style={{background: 'white'}}>
				    {_.map(rows.slice(rowOffset, rowOffset+visibleRows), (row, i) =>
				    	<tr>
				    		<td>{rowOffset+i+1}</td>
				    		{_.map(row, cell => <td style={{height: height}}>{cell}</td>)}
				    	</tr>
				    )}
				</table>
			</div>
		</div>
	}
}

@observer
class EditName extends Component {
	@action.bound onInput(e) {
		this.props.dataset.name = e.target.value
	}

	render() {
		const {dataset} = this.props
		return <label>
			Name
			<input type="text" value={dataset.name} onInput={this.onInput} placeholder="Short name for your dataset" required/>
		</label>
	}
}


@observer
class EditDescription extends Component {
	@action.bound onInput(e) {
		this.props.dataset.description = e.target.value
	}

	render() {
		const {dataset} = this.props

		return <label>
			Description
			<textarea value={dataset.description} onInput={this.onInput} placeholder="Optional description for dataset"/>
		</label>
	}
}

const EditCategory = ({categories, dataset}) => {
	const categoriesByParent = _.groupBy(categories, category => category.parent)

	return <label>
		Category <span class="form-section-desc">(Currently used only for internal organization)</span>
		<select onChange={e => dataset.subcategoryId = e.target.value} value={dataset.subcategoryId}>	
			{_.map(categoriesByParent, (subcats, parent) => 
				<optgroup label={parent}>
					{_.map(subcats, category => 
						<option value={category.id}>{category.name}</option>
					)}
				</optgroup>
			)}
		</select>
	</label>
}

@observer
class EditVariable extends Component {
	@observable editSource = false

	@action.bound onEditSource(e) {
		e.preventDefault()
		this.editSource = !this.editSource
	}

	render() {
		const {variable, dataset} = this.props
		const {editSource} = this 

		const sourceName = variable.source && (variable.source.id ? variable.source.name : `New: ${variable.source.name}`)

		return <li class={styles.editVariable}>
			<div class="variableProps">
				<label class="name">
					Name <br />
					<span class="form-section-desc">The variable name will be displayed in charts ('Sources' tab). For charts with many variables, the name will be crucial for readers to understand which sources correspond to which variables. <br /> Variable name should be of the format "Minimal variable description (Source)". For example: "Top marignal income tax rate (Piketty 2014)". Or "Tax revenue as share of GDP (ICTD 2016)"</span>
					<input value={variable.name} onInput={e => variable.name = e.target.value} placeholder="Enter variable name"/>
				</label>
				<label class="description">
					Description <br />
					<span class="form-section-desc">
					The variable  description will be displayed in charts (‘Sources’ tab). It will be the first row in the table explaining the variable sources.<br />
					Variable descriptions should be concise but clear and self-contained. They will correspond, roughly, to the information that will go in the subtitle of charts. <br />
					For example: “Percentage of the population covered by health insurance (includes affiliated members of health insurance or estimation of the population having free access to health care services provided by the State)”</span>
					<textarea rows={4} placeholder="Short description of variable" value={variable.description} onInput={e => variable.description = e.target.value}/>
				</label>
				<label>Unit (is displayed in axis-labels as suffix and in the legend of the map)
				<input value={variable.unit} onInput={e => variable.unit = e.target.value} placeholder="e.g. % or $"/></label>
				<label>Geographic Coverage<input value={variable.coverage} onInput={e => variable.coverage = e.target.value} placeholder="e.g. Global by country"/></label>
				<label>Time Span<input value={variable.timespan} onInput={e => variable.timespan = e.target.value} placeholder="e.g. 1920-1990"/></label>
				<label>Source
					<button onClick={this.onEditSource} style={{position: 'relative'}}>
						<i class="fa fa-pencil"/> {sourceName || 'Add source'}
						<input type="text" value={variable.source && variable.source.name} required style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0}}/>
					</button>
				</label>
				<label>Action
					<select onChange={e => variable.overwriteId = e.target.value}>
						<option selected={variable.overwriteId == null}>Create new variable</option>
						{_.map(dataset.existingVariables, v => 
							<option value={v.id} selected={variable.overwriteId == v.id}>Overwrite {v.name}</option>
						)}							
					</select>
				</label>
			</div>
			{editSource && <EditSource variable={variable} dataset={dataset} onSave={e => this.editSource = false}/>}
		</li>
	}	
}

@observer
class EditVariables extends Component {
	render() {
		const {dataset} = this.props

		return <section class="form-section variables-section">
			<h3>Check Variables</h3>
			<p class="form-section-desc">Here you can configure the variables that will be stored for your dataset.</p>

			<ol>
				{_.map(dataset.newVariables, variable => 
					<EditVariable variable={variable} dataset={dataset}/>	
				)}
			</ol>
		</section>
	}
}

@observer
class EditSource extends Component {	
	@observable source = null

	constructor(props) {
		super()
		this.source = props.variable.source || new Source()
	}

	componentDidMount() {
		autorun(() => {
			this.source = this.props.variable.source || this.source
		})
	}

	@action.bound onChangeSource(e) {
		const name = e.target.value
		this.source = this.props.dataset.sources.filter(source => source.name == name)[0] || new Source()
	}

	@action.bound onSave(e) {
		e.preventDefault()
		this.props.variable.source = this.source
		this.props.onSave()	
	}

	render() {
		const {variable, dataset} = this.props
		const {source} = this

		return <form class={styles.editSource} onSubmit={this.onSave}>
			<hr/>
			<h4>Edit source</h4>
			<label>
				<span>Source:</span>
				<select onChange={this.onChangeSource}>
					<option selected={!source.id}>Create new</option>
					{_.map(dataset.sources, otherSource => 
						<option value={otherSource.name} selected={source.name == otherSource.name}>{otherSource.name}</option>
					)}
				</select>
			</label>
			<label>
				<span>Name:</span>
				<input type="text" required value={source.name} onInput={e => source.name = e.target.value}/>
			</label>
			<p class="form-section-desc">
			The source name will be displayed in charts (at the bottom of the ‘Chart’ and ‘Map’ tabs). For academic papers, the name of the source should be “Authors (year)”. For example Arroyo-Abad and Lindert (2016). <br/>
			For institutional projects or reports, the name should be “Institution, Project (year or vintage)”. For example: U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). <br/>
			For data that we have modified extensively, the name should be "Our World In Data based on Author (year)”. For example: Our World In Data based on Atkinson (2002) and Sen (2000).
			</p>
				<div class="editSourceDescription">
					<label class="description">
						<span>Description:</span>
						<textarea rows={10} required value={source.description} onInput={e => source.description = e.target.value}></textarea>
					</label>
					<label class="preview datasource-wrapper">
						<span>Preview:</span>
						<div dangerouslySetInnerHTML={{__html: source.description}}></div>
					</label>
				</div>
			<p class="form-section-desc">
				For academic papers, the first item in the description should be “Data published by: complete reference”.  This should be followed by the authors underlying sources, a link to the paper, and the date on which the paper was accessed. <br/>
				For institutional projects, the format should be similar, but detailing the corresponding project or report. <br/>
				For data that we have modified extensively in order to change the meaning of the data, we should list OWID as publisher, and provide the name of the person in charge of the calculation.<br/>
				The field “Data publisher’s source” should give basic pointers (e.g. surveys data). Anything longer than a line should be relegated to the field “Additional information”. <br/>
				Sometimes it is necessary to change the structure of this description. (e.g. the row dedicated to ‘Link’ or Data publisher’s source has to be deleted). 
			</p>
			{source.id && <p class="existing-source-warning text-warning">
				<i class="fa fa-warning"></i> You are editing an existing source. Changes may also affect other variables.
			</p>}
			<input type="submit" class="btn btn-success" value="Save"/>
		</form>		
	}	
}

@observer
class ImportProgressModal extends Component {	
	@action.bound onDismiss() {
		const {dataset} = this.props
		dataset.importRequest = null
	}

	render() {
		const {dataset} = this.props
		return <div class={styles.importProgress}>
			<h4>Import progress</h4>
			<div class="progressInner">
				<p class="success"><i class="fa fa-check"/> Preparing import for {dataset.years.length} values...</p>
				{dataset.importError && <p class="error"><i class="fa fa-times"/> Error: {dataset.importError}</p>}
				{dataset.importSuccess && <p class="success"><i class="fa fa-check"/> Import successful!</p>}
				{!dataset.importSuccess && !dataset.importError && <div style="text-align: center;"><i class="fa fa-spin fa-spinner"/></div>}
			</div>
			{dataset.importSuccess && <a class="btn btn-success" href={App.url(`/datasets/${dataset.id}`)}>Done</a>}
			{dataset.importError && <a class="btn btn-warning" onClick={this.onDismiss}>Dismiss</a>}
		</div>
	}
}

class CSV {
	filename: string
	rows: [][]
	existingEntities: []

	@computed get basename() {
		return (this.filename.match(/(.*?)(.csv)?$/)||[])[1]		
	}

	@computed get data() {
		const {rows} = this

		const variables = []
		const entityNameIndex = 0
		const entityNameCheck = {}
		const entityNames = []
		const entities = []
		const years = []

		const headingRow = rows[0]
		for (let name of headingRow.slice(2))
			variables.push(new Variable({name}))

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i]
			const entityName = row[0], year = row[1]

			var entity = entityNameCheck[entityName]
			if (entity === undefined) {
				entity = entityNames.length
				entityNames.push(entityName)
				entityNameCheck[entityName] = entity
			}
			entities.push(entity)
			years.push(+year)
			row.slice(2).forEach((value, i) => {
				variables[i].values.push(value)
			})
		}

		return {
			variables: variables,
			entityNames: entityNames,
			entities: entities,
			years: years
		}
	}

	@computed get validation() {
		const validation = { results: [] }
		const {rows} = this

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
			if ((+year).toString() != year || _.isEmpty(rows[i][0])) {
				invalidLines.push(i+1)
			}
		}

		if (invalidLines.length) {
			validation.results.push({
				class: 'error',
				message: `Invalid or missing entity/year on lines: ${invalidLines.join(', ')}`
			})
		}

		// Check for duplicates
		const uniqCheck = {}
		for (let i = 1; i < rows.length; i++) {
			const row = rows[i]
			const entityName = row[0], year = row[1]			
			const key = entityName+'-'+year
			uniqCheck[key] = uniqCheck[key] || 0
			uniqCheck[key] += 1
		}

		_.keys(uniqCheck).forEach(key => {
			const count = uniqCheck[key]
			if (count > 1) {
				validation.results.push({
					class: 'error',
					message: `Duplicates detected: ${count} instances of ${key}.`
				})
			}
		})

		// Warn if we're creating novel entities
		const newEntities = _.difference(this.data.entityNames, this.existingEntities)
		if (newEntities.length >= 1) {
			validation.results.push({
				class: 'warning',
				message: `These entities were not found in the database and will be created: ${newEntities.join(', ')}`
			})
		}

		validation.passed = !_.findWhere(validation.results, { class: 'error' })

		return validation
	}

	@computed get isValid() {
		return this.validation.passed
	}

	static transformSingleLayout(rows) {
		const newRows = [['Entity', 'Year', this.basename]]

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

	constructor({ filename = "", rows = [], existingEntities = [] }) {
		this.filename = filename
		this.rows = rows
		this.existingEntities = existingEntities
	}
}

@observer
class ValidationResults extends Component {
	render() {
		const {validation} = this.props

		return <section class={styles.validation}>
			{_.map(validation.results, v => 
				<div class={`alert alert-${v.class}`}>{v.message}</div>
			)}
		</section>
	}
}

@observer
class CSVSelector extends Component {
	props: {
		onCSV: CSV => void
	}
	
	@observable csv : ?csv = null

	@action.bound onChooseCSV({target}: {target: HTMLInputElement}) {
		const {existingEntities} = this.props
		const file = target.files[0]
		if (!file) return

		var reader = new FileReader()
		reader.onload = (e) => {
			const csv = e.target.result
			parse(csv, { relax_column_count: true, skip_empty_lines: true, rtrim: true },
				(err, rows) => {
					// TODO error handling
					console.log("Error?", err)
					if (rows[0][0].toLowerCase() == 'year')
						rows = CSV.transformSingleLayout(rows)
					this.csv = new CSV({ filename: file.name, rows, existingEntities })
					this.props.onCSV(this.csv)
				}
			)			
		}
		reader.readAsText(file)
	}

	render() {
		const {csv} = this

		return <section>
			<input type="file" onChange={this.onChooseCSV}/>
			{csv && <DataPreview csv={csv}/>}
			{csv && <ValidationResults validation={csv.validation}/>}
		</section>
	}
}

@observer
export default class Importer extends Component {
	@observable csv = null
	@observable dataset = new Dataset()

	@action.bound onChooseDataset({target}: {target: HTMLSelectElement}) {
		const d = this.props.datasets[target.selectedIndex-1]
		this.dataset = d ? Dataset.fromServer(d) : new Dataset()
	}

	@action.bound onCSV(csv : CSV) {
		this.csv = csv
		const match = _.filter(this.props.datasets, d => d.name == csv.basename)[0]
		this.dataset = match ? Dataset.fromServer(match) : new Dataset()
	}

	componentDidMount() {
		autorun(() => {
			const {dataset, csv} = this
			if (!dataset || !csv || !csv.isValid) return

			if (!dataset.name)
				dataset.name = csv.basename

			dataset.newVariables = _.map(csv.data.variables, _.clone)
			dataset.entityNames = csv.data.entityNames
			dataset.entities = csv.data.entities
			dataset.years = csv.data.years
		})
	}

	@action.bound onSubmit(e) {
		e.preventDefault()
		this.dataset.save()
	}
	
	render() {
		const {csv, dataset} = this
		const {datasets, categories, existingEntities} = this.props

		if (App.isDebug) {
			window.Importer = this
			window.dataset = dataset
		}

		Source.template = this.props.sourceTemplate

		if (dataset.subcategoryId == null) {
			dataset.subcategoryId = (_.findWhere(categories, { name: "Uncategorized" })||{}).id
		}

		return <form class={styles.importer} onSubmit={this.onSubmit}>
			<h2>Import CSV file</h2>
			<p>Examples of valid layouts: <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_single-var.png">single variable</a>, <a href="http://ourworldindata.org/wp-content/uploads/2016/02/ourworldindata_multi-var.png">multiple variables</a>. The multivar layout is preferred. <span class="form-section-desc">CSV files only: <a href="https://ourworldindata.org/how-to-our-world-in-data-guide/#1-2-single-variable-datasets">csv file format guide</a></span></p>
			<CSVSelector onCSV={this.onCSV} existingEntities={existingEntities}/>

			{csv && csv.isValid && <section>
				<p style={{opacity: dataset.id ? 1 : 0}} class="updateWarning">Updating existing dataset</p>
				<select class="chooseDataset" onChange={this.onChooseDataset}>
					<option selected={dataset.id == null}>Create new dataset</option>
					{_.map(datasets, (d) =>
						<option value={d.id} selected={d.id == dataset.id}>{d.name}</option>
					)}
				</select>
				<hr/>
				<h3>Dataset name and description</h3>
				<p>The dataset name and description are for our own internal use and do not appear on the charts.<br/>
				<span class="form-section-desc">Dataset name should include a basic description of the variables, followed by the source and year. For example: "Government Revenue Data – ICTD (2016)"</span></p>
				<EditName dataset={dataset}/>
				<hr/>
				<EditDescription dataset={dataset}/>
				<hr/>
				<EditCategory dataset={dataset} categories={categories}/>
				<hr/>

				{dataset.isLoading && <i class="fa fa-spinner fa-spin"></i>}
				{!dataset.isLoading && [
					<EditVariables dataset={dataset}/>,
					<input type="submit" class="btn btn-success" value={dataset.id ? "Update dataset" : "Create dataset"}/>,
					<Modal isOpen={!!dataset.importRequest} contentLabel="Modal" parentSelector={e => document.querySelector('.wrapper')}>
						<ImportProgressModal dataset={dataset}/>
					</Modal>			
				]}
			</section>}
		</form>
	}
}