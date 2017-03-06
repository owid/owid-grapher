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

class Variable {
	@observable overwriteId : ?number
	@observable name : string
	@observable unit : string
	@observable description : string
	@observable coverage : string
	@observable timespan : string
	@observable source : Object
	@observable values : string[]

	constructor({overwriteId = null, name = "", description = "", coverage = "", timespan = "", unit = "", source = null, values = []}) {
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
		return this.id && _.isEmpty(this.existingVariables)
	}

	@computed get sources() {
		const {newVariables, existingVariables} = this
		const sources = _.pluck(existingVariables.concat(newVariables), 'source')		
		return _.filter(sources)
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
	@observable visibleRows : number = 5
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
			<p class="form-section-desc">
				Strongly recommended is a name that combines the measure and the source. For example: "Life expectancy of women at birth – via the World Development Indicators published by the World Bank"
			</p>
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
			<p class="form-section-desc">
				The dataset name and description are for our own internal use and do not appear on the charts.
			</p>
			<textarea value={dataset.description} onInput={this.onInput} placeholder="Optional description for dataset"/>
		</label>
	}
}

const EditCategory = ({categories, dataset}) => {
	const categoriesByParent = _.groupBy(categories, category => category.parent)

	return <label>
		Category
		<p class="form-section-desc">Select an appropriate category for the dataset. Currently used only for internal organization.</p>
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

	render() {
		const {variable, dataset} = this.props
		const {editSource} = this 

		const sourceName = variable.source && (variable.source.id ? variable.source.name : `New: ${variable.source.name}`)

		return <li class={styles.editVariable}>
			<div class="variableProps">
				<label class="name">
					Name
					<input value={variable.name} onInput={e => variable.name = e.target.value} placeholder="Enter variable name"/>
				</label>
				<label class="description">
					Description
					<textarea rows={4} placeholder="Short description of variable" value={variable.description} onInput={e => variable.description = e.target.value}/>
				</label>
				<label>Unit<input value={variable.unit} onInput={e => variable.unit = e.target.value} placeholder="e.g. % or $"/></label>
				<label>Geographic Coverage<input value={variable.coverage} onInput={e => variable.coverage = e.target.value} placeholder="e.g. Global by country"/></label>
				<label>Time Span<input value={variable.timespan} onInput={e => variable.timespan = e.target.value} placeholder="e.g. 1920-1990"/></label>
				<label>Source
					<input onClick={e => this.editSource = true} type="button" value={sourceName || 'Add source'}/>
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
			{editSource && <EditSource variable={variable} dataset={dataset}/>}
		</li>
	}	
}

@observer
class EditVariables extends Component {
	render() {
		const {dataset} = this.props

		return <section class="form-section variables-section">
			<h3>Check Variables</h3>
			<p class="form-section-desc">Here you can configure the variables that will be stored for your dataset. If possible the variable name should be of the format measure + source (e.g. Population density – Clio Infra)</p>

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
		this.source = props.variable.source || {
			name: "",
			description: ""
		}
	}

	componentDidMount() {
		autorun(() => {
			this.source = this.props.variable.source || this.source
		})
	}

	@action.bound onSave(e) {
		e.preventDefault()
		this.props.variable.source = this.source
	}

	render() {
		const {variable, dataset} = this.props
		const {source} = this

		return <form class={styles.editSource} onSubmit={this.onSave}>
			<hr/>
			<h4>Select source</h4>
			<label>
				<span>Source:</span>
				<select>
					<option selected={!source.id}>Create new</option>
					{_.map(dataset.sources, otherSource => 
						<option value={otherSource.id} selected={source.id == otherSource.id}>{otherSource.name}</option>
					)}
				</select>
			</label>
			<label>
				<span>Name:</span>
				<input type="text" required value={source.name} onInput={e => source.name = e.target.value}/>
			</label>
			<label>
				<span>Description:</span>
				<div class="editSourceDescription">
					<textarea required value={source.description} onInput={e => source.description = e.target.value}></textarea>
					<div class="preview" __dangerouslySetInnerHTML={{__html: source.description}}></div>
				</div>
			</label>
			<p class="form-section-desc">
				All provided source information will be shown on associated visualizations.
			</p>
			{source.id && <span class="existing-source-warning text-warning">
				<i class="fa fa-warning"></i>
				You are editing an existing source. Changes may also affect other variables.
			</span>}
			<input type="submit" class="btn btn-success" value="Save"/>
		</form>		
	}	
}

@observer
class EditData extends Component {
	render() {
		const {dataset} = this.props

		if (!dataset.CSV)
			return null
		else if (dataset.isLoading)
			return <i class="fa fa-spinner fa-spin"></i>

		return <div>
		</div>
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

	constructor(filename: string, rows: [][]) {
		this.filename = filename
		this.rows = rows
	}
}

@observer
class CSVSelector extends Component {
	props: {
		onCSV: CSV => void
	}
	
	@observable csv : ?csv = null

	@action.bound onChooseCSV({target}: {target: HTMLInputElement}) {
		const file = target.files[0]
		if (!file) return

		var reader = new FileReader()
		reader.onload = (e) => {
			const csv = e.target.result
			parse(csv, (err, rows) => {
				// TODO error handling
				console.log("Error?", err)
				this.csv = new CSV(file.name, rows)
				this.props.onCSV(this.csv)
			})			
		}
		reader.readAsText(file)
	}

	render() {
		const {csv} = this

		return <section>
			<input type="file" onChange={this.onChooseCSV}/>
			{csv && <DataPreview csv={csv}/>}
		</section>		
	}
}

@observer
export default class Importer extends Component {
	@observable csv = null
	@observable dataset = new Dataset()

	@action.bound onChooseDataset({target}: {target: HTMLSelectElement}) {
		const d = this.props.datasets[target.selectedIndex-1]
		this.dataset = Dataset.fromServer(d)
	}

	@action.bound onCSV(csv : CSV) {
		this.csv = csv
		const match = _.filter(this.props.datasets, d => d.name == csv.basename)[0]
		this.dataset = match ? Dataset.fromServer(match) : this.dataset
	}

	componentDidMount() {
		autorun(() => {
			const {dataset, csv} = this
			if (!dataset || !csv) return

			if (!dataset.name)
				dataset.name = csv.basename

			dataset.newVariables = csv.data.variables
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
		const {datasets, categories} = this.props

		if (App.isDebug) {
			window.Importer = this
			window.dataset = dataset
		}

		if (dataset.subcategoryId == null) {
			dataset.subcategoryId = (_.findWhere(categories, { name: "Uncategorized" })||{}).id
		}

		return <form class={styles.importer} onSubmit={this.onSubmit}>
			<h2>Choose CSV file to import</h2>
			<CSVSelector onCSV={this.onCSV}/>			

			{csv && <section>
				<h3>Choose your dataset</h3>
				<select onChange={this.onChooseDataset}>
					<option selected={dataset.id == null}>Create new dataset</option>
					{_.map(datasets, (d) =>
						<option value={d.id} selected={d.id == dataset.id}>{d.name}</option>
					)}
				</select>
				<EditName dataset={dataset}/>
				<EditDescription dataset={dataset}/>
				<EditCategory dataset={dataset} categories={categories}/>

				<EditVariables dataset={dataset}/>

				<input type="submit" class="btn btn-success" value="Save dataset"/>

				<Modal isOpen={!!dataset.importRequest} contentLabel="Modal" parentSelector={e => document.querySelector('.wrapper')}>
					<ImportProgressModal dataset={dataset}/>
				</Modal>			
			</section>}
		</form>
	}
}