import {extend} from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'

@observer
export default class DataTab extends React.Component<{ bounds: Bounds, csvUrl: string }, undefined> {
	@computed get bounds() {
		return this.props.bounds
	}

	@computed get csvUrl() {
		return this.props.csvUrl
	}

	@computed get csvFilename() {
		const m = this.csvUrl.match(/\/([^\/]*)$/)
		return m && m[1]
	}

	render() {
		const { bounds, csvUrl, csvFilename } = this

		return <div className="dataTab" style={extend(bounds.toCSS(), { position: 'absolute' })}>
			<div>
				<p>Download a CSV file containing all data used in this visualization:</p>
				<a href={csvUrl} className="btn btn-primary" target="_blank"><i className="fa fa-download"></i> {csvFilename}</a>
			</div>
		</div>
	}
}
