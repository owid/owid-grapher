import { toString, includes, flatten, uniq, sortBy, extend } from './Util'
import Bounds from './Bounds'
import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from './ChartConfig'

function csvEscape(value: any): string {
    const valueStr = toString(value)
    if (includes(valueStr, ","))
        return '"' + value.replace(/\"/g, "\"\"") + '"'
    else
        return value
}

// Client-side data export from chart
@observer
export default class DataTab extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    @computed get bounds() {
        return this.props.bounds
    }

    // Here's where the actual CSV is made
    @computed get csvUrl() {
        const { chart } = this.props
        const { vardata } = chart

        const dimensions = chart.data.filledDimensions.filter(d => d.property !== 'color')
        const entitiesUniq = sortBy(uniq(flatten(dimensions.map(d => d.entitiesUniq)))) as string[]
        const yearsUniq = sortBy(uniq(flatten(dimensions.map(d => d.yearsUniq)))) as number[]

        const rows: string[] = []

        const titleRow = ["Entity", "Code", "Year"]
        dimensions.forEach(dim => {
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        })
        rows.push(titleRow.join(","))

        entitiesUniq.forEach(entity => {
            yearsUniq.forEach(year => {
                const row = [entity, vardata.entityMetaByKey[entity].code || "", year]

                let rowHasSomeValue = false
                dimensions.forEach(dim => {
                    const valueByYear = dim.valueByEntityAndYear.get(entity)
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
        return "data:text/csv;charset=utf-8," + encodeURIComponent(rows.join("\n"))
    }

    @computed get csvFilename() {
        return this.props.chart.data.slug + ".csv"
    }

    render() {
        const { bounds, csvUrl, csvFilename } = this

        return <div className="dataTab" style={extend(bounds.toCSS(), { position: 'absolute' })}>
            <div>
                <p>Download a CSV file containing all data used in this visualization:</p>
                <a href={csvUrl} download={csvFilename} className="btn btn-primary" target="_blank"><i className="fa fa-download"></i> {csvFilename}</a>
            </div>
        </div>
    }
}
