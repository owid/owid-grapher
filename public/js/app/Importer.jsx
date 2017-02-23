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

class Dataset {
	@observable id : number
	@observable name : string
	@observable description : string
	@observable subcategoryId : number
	@observable.shallow csvData : [][] = null
	@observable existingVariables : Object[] = null

	@computed get importData() : Object {
		const {csvData} = this

		const variables = []
		const entities = []
		const years = []

		const headingRow = csvData[0]

		for (let name of headingRow.slice(2))
			variables.push({name, values: [], overwriteId: 'create-new'})

		for (let i = 1; i < csvData.length; i++) {
			const row = csvData[i]
			const entity = row[0], year = row[1]

			row.slice(2).forEach((value, i) => {
				variables[i].values.push(value)
			})
		}

		console.log(variables)

		return {variables, entities, years}
	}

	@computed get newVariables() {
		return this.importData.variables
	}

	/*@computed get isLoading() {
		return this.id && this.csvData != null && this.existingVariables == null
	}

	@computed get sources() {
		if (this.existingVariables == null) return null
		_(this.existingVariables.concat(this.newVariables)).pluck('source').filter().uniq()
	}

	@computed get variables() {

	}

	// Populates all unsourced variables with the first available source
	@bind setDefaultSources() {
		const {sources, variables} = this

		if (!sources) return

		for (variable of variables) {
			if (!variable.source)
				variable.source = sources[0]
		}
	}*/

	save() {
		var requestData = {
			dataset: App.DatasetModel.toJSON(),
			entityKey: importData.entityKey,
			years: importData.years,
			entities: importData.entities,
			variables: variables
		};		

		App.postJSON('/import/variables', {
			id: this.id,
			name: this.name,
			description: this.description,
			subcategoryId: this.subcategoryId			
		})
	}

	constructor({id = null, name = "", description = "", subcategoryId = 0} : {name: string, description: string, subcategoryId: number} = {}) {
		this.id = id
		this.name = name
		this.description = description
		this.subcategoryId = subcategoryId

		/*autorun(() => {
			if (this.csvData == null || this.id == null) return; 

			App.fetchJSON(`/datasets/${this.id}.json`).then(data => {
				// todo error handling
				this.existingVariables = data.variables
			})
		})*/
	}
}

@observer
class DataPreview extends Component {
	@observable rowOffset : number = 0
	@observable visibleRows : number = 5
	@computed get numRows() : number {
		return this.props.dataset.csvData.length
	}

	@action.bound onScroll({target} : {target: HTMLElement}) {
		const {scrollTop, scrollHeight} = target
		const {numRows} = this

		const rowOffset = Math.round(scrollTop/scrollHeight * this.props.dataset.csvData.length)
		target.scrollTop = Math.round(rowOffset/numRows * scrollHeight)

		this.rowOffset = rowOffset
	}

	render() {
		const {csvData} = this.props.dataset
		const {rowOffset, visibleRows, numRows} = this
		const height = 50

		return <div style={{height: height*visibleRows, 'overflow-y': 'scroll'}} onScroll={this.onScroll}>
			<div style={{height: height*numRows, 'padding-top': height*rowOffset}}>
				<table class="table" style={{background: 'white'}}>
				    {_.map(csvData.slice(rowOffset, rowOffset+visibleRows), (row, i) =>
				    	<tr>
				    		<td>{rowOffset+i}</td>
				    		{_.map(row, cell => <td style={{height: height}}>{cell}</td>)}
				    	</tr>
				    )}
				</table>
			</div>
		</div>
	}
}

const EditName = ({dataset}) => 
	<label>
		Name
		<p class="form-section-desc">
			Strongly recommended is a name that combines the measure and the source. For example: "Life expectancy of women at birth – via the World Development Indicators published by the World Bank"
		</p>
		<input type="text" class="form-control" placeholder="Short name for your dataset" value={dataset.name} required/>
	</label>

const EditDescription = ({dataset}) =>
	<label>
		Description
		<p class="form-section-desc">
			The dataset name and description are for our own internal use and do not appear on the charts.
		</p>
		<textarea onInput={e => dataset.description = e.target.value} class="form-control dataset-description" placeholder="Optional description for dataset" value={dataset.description}/>
	</label>

const EditCategory = ({categories, dataset}) => {
	const categoriesByParent = _.groupBy(categories, category => category.parent)

	return <label>
		Category
		<p class="form-section-desc">Select an appropriate category for the dataset. Currently used only for internal organization.</p>
		<select class="form-control" onChange={e => dataset.subcategoryId = e.target.value} value={dataset.subcategoryId}>	
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
class EditVariables extends Component {
	@observable editSourceForVariable = null

	render() {
		const {oldVariables, newVariables} = this.props.dataset
		const {editSourceForVariable} = this

		return <section class="form-section variables-section">
			<h3>Check Variables</h3>
			<p class="form-section-desc">Here you can configure the variables that will be stored for your dataset. If possible the variable name should be of the format measure + source (e.g. Population density – Clio Infra)</p>

			<ol>
				{_.map(newVariables, variable => 
					<li class="variable-item clearfix">
						<label>Name<input class="form-control" value={variable.name} placeholder="Enter variable name"/></label>
						<label>Unit<input class="form-control" value={variable.unit} placeholder="e.g. % or $"/></label>
						<label>Geographic Coverage<input class="form-control" value={variable.coverage} placeholder="e.g. Global by country"/></label>
						<label>Time Span<input class="form-control" value={variable.timespan} placeholder="e.g. 1920-1990"/></label>
						<label>Source
							<input onClick={e => this.editSourceForVariable = variable} type="button" value={variable.source ? variable.source.name : 'Add source'}/>
						</label>
						<label>Action
							<select class="action" value={variable.overwriteId}>
								<option value="create-new">Create new variable</option>
								{/*_.map(oldVariables, old => 
									<option value={old.id}>Overwrite {old.name}</option>
								)*/}							
							</select>
						</label>
					</li>
				)}
			</ol>
			{editSourceForVariable && <EditSourceModal variable={editSourceForVariable}/>}
		</section>
	}
}

@observer
class EditSourceModal extends Component {
	componentDidMount() {
		$(this.base).modal()
	}

	componentWillUnmount() {

	}

	render() {
		return <div class="modal fade source-selector" role="dialog">
			<div class="modal-dialog modal-lg">
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" data-dismiss="modal" aria-label="Close">
							<span aria-hidden="true">&times;</span>
						</button>
						<h4 class="modal-title">Select source</h4>
					</div>
					<div class="modal-body">
						<label>
							<span>Source:</span>
							<select class="form-control source"></select>
						</label>
						<label class="source-name">
							<span>Name:</span>
							<input class="form-control required" type="text"/>
						</label>
						<label>
							<span>Description:</span>
							<textarea class="form-control source-editor required" type="text" name="source_description"></textarea>
							<span class="sources-default" style="display:none;"></span>
						</label>				
						<p class="form-section-desc">
							All provided source information will be shown on associated visualizations.
						</p>
					</div>
					<div class="modal-footer">
						<span class="existing-source-warning text-warning">
							<i class="fa fa-warning"></i>
							You are editing an existing source. Changes may also affect other variables.
						</span>
						<button class="btn btn-success">Save</button>
					</div>
				</div>
			</div>
		</div>		
	}	
}

@observer
class EditData extends Component {
	render() {
		const {dataset} = this.props

		if (!dataset.csvData)
			return null
		else if (dataset.isLoading)
			return <i class="fa fa-spinner fa-spin"></i>

		return <div>
			<DataPreview dataset={dataset}/>
			<EditVariables dataset={dataset}/>

			<section class="submit-section">
				<input type="submit" class="btn btn-success" value="Save dataset" onClick={dataset.save}/>
			</section>
		</div>
	}	
}

@observer
export default class Importer extends Component {
	@observable dataset = new Dataset()

	@action.bound onChooseDataset({target}: {target: HTMLSelectElement}) {
		const d = this.props.datasets[target.selectedIndex-1]
		this.dataset = new Dataset({id: d.id, name: d.name, description: d.description, subcategoryId: d.fk_dst_subcat_id})
	}

	@action.bound onUploadCSV({target}: {target: HTMLInputElement}) {
		const file = target.files[0]
		if (!file) return

		var reader = new FileReader()
		reader.onload = (e) => {
			const csv = e.target.result
			parse(csv, (err, data) => {
				// TODO error handling
				console.log(err)
				this.dataset.csvData = data
			})			
		}
		reader.readAsText(file)	
	}

	render() {
		if (App.isDebug) window.Importer = this

		const {dataset} = this
		const {datasets, categories} = this.props

		return <div>
			<h2>Import</h2>
			<section class="form-section dataset-section">
				<h3>Choose your dataset</h3>
				<select class="form-control" onChange={this.onChooseDataset}>
					<option value="" selected>Create new dataset</option>
					{_.map(datasets, (dataset) =>
						<option>{dataset.name}</option>
					)}
				</select>
				<EditName dataset={dataset}/>
				<EditDescription dataset={dataset}/>
				<EditCategory dataset={dataset} categories={categories}/>
			</section>
			<section class="form-section upload-section">
				<div class="form-section-header">
					<h3>Upload CSV file with data</h3>
				</div>
				<div class="form-section-content">
					<div class="file-picker-wrapper">
						<input type="file" onChange={this.onUploadCSV}/>
						<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
					</div>
					<div class="csv-import-result">
						<div id="csv-import-table-wrapper" class="csv-import-table-wrapper"></div>
					</div>
				</div>
			</section>

			<EditData dataset={dataset}/>
		</div>
	}
}