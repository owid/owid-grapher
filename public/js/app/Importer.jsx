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
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'

import parse from 'csv-parse'
import {NullElement} from './Util'

class Dataset {
	@observable name : string
	@observable description : string
	@observable subcategoryId : number
	@observable.shallow csvData : [][] = []

	@computed get importData() : Object {
		const variables = []
		const entities = []
		const years = []

		const headingRow = this.csvData[0]

		for (let name of headingRow.slice(2))
			variables.push({name, values: []})

		for (let i = 1; i < this.csvData.length; i++) {
			const row = this.csvData[i]
			const entity = row[0], year = row[1]

			row.slice(2).forEach((value, i) => {
				variables[i].values.push(value)
			})
		}

		return {variables, entities, years}
	}

	@computed get validationResults() : Object[] {
		return []
	}

	@computed get initialVariables() : Object[] {
		
	}

	constructor({name = "", description = "", subcategoryId = 0} : {name: string, description: string, subcategoryId: number} = {}) {
		this.name = name
		this.description = description
		this.subcategoryId = subcategoryId
	}
}

@observer
class DataPreview extends Component {
	@observable rowOffset : number = 0
	@observable visibleRows : number = 5
	@computed get numRows() : number {
		return this.props.data.length
	}

	@action.bound onScroll({target} : {target: HTMLElement}) {
		const {scrollTop, scrollHeight} = target
		const {numRows} = this

		const rowOffset = Math.round(scrollTop/scrollHeight * this.props.data.length)
		target.scrollTop = Math.round(rowOffset/numRows * scrollHeight)

		this.rowOffset = rowOffset
	}

	render() {
		const {data} = this.props
		const {rowOffset, visibleRows, numRows} = this
		const height = 50

		return <div style={{height: height*visibleRows, 'overflow-y': 'scroll'}} onScroll={this.onScroll}>
			<div style={{height: height*numRows, 'padding-top': height*rowOffset}}>
				<table class="table" style={{background: 'white'}}>
				    {_.map(data.slice(rowOffset, rowOffset+visibleRows), (row, i) =>
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
	render() {
		return <section class="form-section variables-section">
			<div class="form-section-header">
				<h3>Check Variables</h3>
			</div>
			<div class="form-section-content">
				<p class="form-section-desc">Here you can configure the variables that will be stored for your dataset. If possible the variable name should be of the format measure + source (e.g. Population density – Clio Infra)</p>
			</div>
		</section>
	}
}

@observer
export default class Importer extends Component {
	@observable dataset = new Dataset()

	@action.bound onChooseDataset({target}: {target: HTMLSelectElement}) {
		const d = this.props.datasets[target.selectedIndex-1]
		this.dataset = new Dataset({name: d.name, description: d.description, subcategoryId: d.fk_dst_subcat_id})
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
			<DataPreview data={dataset.csvData}/>
			<EditVariables dataset={dataset}/>
		</div>
	}
}