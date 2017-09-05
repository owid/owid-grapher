import * as _ from 'lodash'
import * as d3 from 'd3'
import Bounds from './Bounds'
import * as React from 'react'
import {computed} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'

declare var Global: { rootUrl: string }

function csvEscape(value: any): string {
	const valueStr = _.toString(value)
	if (_.includes(valueStr, ","))
		return '"' + value.replace(/\"/g, "\"\"") + '"'
	else
		return value
}

@observer
export default class DataTab extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
	@computed get bounds() {
		return this.props.bounds
	}

	@computed get csvUrl() {
		const {chart} = this.props
		const {vardata} = chart

		const dimensions = _.filter(chart.data.filledDimensions, d => d.property != 'color')
		const entitiesUniq = _(dimensions).map(d => d.variable.entitiesUniq).flatten().uniq().sort().value() as string[]
		const yearsUniq = _(dimensions).map(d => d.variable.yearsUniq).flatten().uniq().sort().value() as number[]

		const rows: string[] = []

		const titleRow = ["Entity", "Code", "Year"]
		dimensions.forEach(dim => {
			titleRow.push(dim.variable.name)
		})
		rows.push(titleRow.join(","))

		entitiesUniq.forEach(entity => {
			yearsUniq.forEach(year => {
				const row = [entity, vardata.entityMetaByKey[entity].code||"", year]
				
				let rowHasSomeValue = false
				dimensions.forEach(dim => {
					const valueByYear = dim.variable.valueByEntityAndYear.get(entity)
					const value = valueByYear ? valueByYear.get(year) : null

					if (value == null)
						row.push("")
					else {
						row.push(value)
						rowHasSomeValue = true
					}
				})

				// Only add rows which actually have some data in them
				if (rowHasSomeValue)
					rows.push(row.map(csvEscape).join(","))
			})
		})
		return "data:text/csv;charset=utf-8,"+encodeURIComponent(rows.join("\n"))
	}

	@computed get csvFilename() {
		return this.props.chart.data.slug + ".csv"
	}

	render() {
		const {bounds, csvUrl, csvFilename} = this

		return <div className="dataTab" style={_.extend(bounds.toCSS(), { position: 'absolute' })}>
			<div>
				<p>Download a CSV file containing all data used in this visualization:</p>
				<a href={csvUrl} download={csvFilename} className="btn btn-primary" target="_blank"><i className="fa fa-download"></i> {csvFilename}</a>
			</div>
		</div>
	}
}
