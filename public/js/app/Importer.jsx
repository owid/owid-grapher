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
import {bind} from 'decko'

@observer
export default class Importer extends Component {
	@observable dataset = null	

	@bind @action onDatasetChange({target}: {target: HTMLSelectElement}) {
		this.dataset = this.props.datasets[target.selectedIndex-1]
	}

	render() {
		const {dataset} = this
		const {datasets} = this.props

		return <div>
			<h2>Import</h2>
			<section class="form-section dataset-section">
				<h3>Choose your dataset</h3>
				<select class="form-control" onChange={this.onDatasetChange}>
					<option value="" selected>Create new dataset</option>
					{_.map(datasets, (dataset) =>
						<option>{dataset.name}</option>
					)}
				</select>
				<div class="form-section-content">
					<label>
						Name
						<input type="text" class="form-control" placeholder="Short name for your dataset" value={dataset&&dataset.name} required/>
					</label>
					<p class="form-section-desc">
						Strongly recommended is a name that combines the measure and the source. For example: "Life expectancy of women at birth – via the World Development Indicators published by the World Bank"
					</p>
					<label>
						Description
						<textarea class="form-control dataset-description" placeholder="Optional description for dataset" value={dataset&&dataset.description}/>
					</label>					
					<p class="form-section-desc">
						The dataset name and description are for our own internal use and do not appear on the charts.
					</p>
				</div>
			</section>	
			<section class="form-section upload-section">
				<div class="form-section-header">
					<h3>Upload CSV file with data</h3>
				</div>
				<div class="form-section-content">
					<div class="file-picker-wrapper">
						<input type="file" autocomplete="off"/>
						<a href="#" title="Remove uploaded file" class="remove-uploaded-file-btn"><span class="visuallyhidden">Remove uploaded file</span><i class="fa fa-remove"></i></a>
					</div>
					<div class="csv-import-result">
						<div id="csv-import-table-wrapper" class="csv-import-table-wrapper"></div>
					</div>
				</div>
			</section>
		</div>
	}
}