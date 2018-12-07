import * as React from 'react'
import {observer} from 'mobx-react'
import { action, runInAction } from 'mobx'
const timeago = require('timeago.js')()
import * as _ from 'lodash'

import Admin from './Admin'
import Link from './Link'
import TagBadge, { Tag } from './TagBadge'
import { TagEditor } from './Forms'

export interface ChartListItem {
    id: number
    slug: string
    title: string
    tab: string
    hasChartTab: boolean
    hasMapTab: boolean
    isPublished: boolean
    isStarred: boolean
    internalNotes: string
    type: string
    lastEditedAt: string
    lastEditedBy: string
    publishedAt: string
    publishedBy: string
    tags: Tag[]
}

function showChartType(chart: ChartListItem) {
    const displayNames: {[key: string]: string} = {
        LineChart: "Line Chart",
        ScatterPlot: "Scatter Plot",
        StackedArea: "Stacked Area",
        DiscreteBar: "Discrete Bar",
        SlopeChart: "Slope Chart",
        StackedBar: "Stacked Bar"
    }

    const displayType = displayNames[chart.type] || "Unknown"

    if (chart.tab === "map") {
        if (chart.hasChartTab)
            return `Map + ${displayType}`
        else
            return "Map"
    } else {
        if (chart.hasMapTab)
            return `${displayType} + Map`
        else
            return displayType
    }
}

@observer
class ChartRow extends React.Component<{ chart: ChartListItem, searchHighlight?: (text: string) => any, onDelete: (chart: ChartListItem) => void, onStar: (chart: ChartListItem) => void }> {
    context!: { admin: Admin }

    render() {
        const {chart, searchHighlight} = this.props
        const {admin} = this.context

        const highlight = searchHighlight || _.identity

        return <tr>
            <td>
                <a title="Show this chart on the front page of the website." onClick={() => this.props.onStar(chart)}>
                    {chart.isStarred ? <i className="fa fa-star"/> : <i className="fa fa-star-o"/>}
                </a>
            </td>
            {chart.isPublished ? <td>
                <a href={`${admin.grapherRoot}/${chart.slug}`}>{highlight(chart.title)}</a>
            </td> : <td>
                <span style={{ color: 'red' }}>Draft: </span> {highlight(chart.title)}
            </td>}
            <td style={{minWidth: "120px"}}>{showChartType(chart)}</td>
            <td>{highlight(chart.internalNotes)}</td>
            <td style={{minWidth: "240px"}}><TagEditor tags={chart.tags}/></td>
            <td>{chart.publishedAt && timeago.format(chart.publishedAt)}{chart.publishedBy && <span> by {highlight(chart.publishedBy)}</span>}</td>
            <td>{timeago.format(chart.lastEditedAt)} by {highlight(chart.lastEditedBy)}</td>
            <td>
                <Link to={`/charts/${chart.id}/edit`} className="btn btn-primary">Edit</Link>
            </td>
            <td>
                <button className="btn btn-danger" onClick={() => this.props.onDelete(chart)}>Delete</button>
            </td>
        </tr>
    }
}

@observer
export default class ChartList extends React.Component<{ charts: ChartListItem[], searchHighlight?: (text: string) => any, onDelete?: (chart: ChartListItem) => void }> {
    @action.bound async onDeleteChart(chart: ChartListItem) {
        if (!window.confirm(`Delete the chart ${chart.slug}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`/api/charts/${chart.id}`, {}, "DELETE")

        if (json.success) {
            if (this.props.onDelete)
                this.props.onDelete(chart)
            else
                runInAction(() => this.props.charts.splice(this.props.charts.indexOf(chart), 1))
        }
    }

    @action.bound async onStar(chart: ChartListItem) {
        if (chart.isStarred) return

        const json = await this.context.admin.requestJSON(`/api/charts/${chart.id}/star`, {}, 'POST')
        if (json.success) {
            runInAction(() => {
                for (const otherChart of this.props.charts) {
                    if (otherChart === chart) {
                        otherChart.isStarred = true
                    } else if (otherChart.isStarred) {
                        otherChart.isStarred = false
                    }
                }
            })
        }
    }

    render() {
        const {charts, searchHighlight} = this.props
        return <table className="table table-bordered">
            <thead>
                <tr>
                    <th><i className="fa fa-star"/></th>
                    <th>Chart</th>
                    <th>Type</th>
                    <th>Notes</th>
                    <th>Tags</th>
                    <th>Published</th>
                    <th>Last Updated</th>
                    <th></th>
                    <th></th>
                </tr>
            </thead>
                <tbody>
                {charts.map(chart => <ChartRow chart={chart} searchHighlight={searchHighlight} onDelete={this.onDeleteChart} onStar={this.onStar}/>)}
            </tbody>
        </table>
    }
}
