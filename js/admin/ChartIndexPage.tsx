import Admin from './Admin'
import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'
import { Modal, LoadingBlocker, TextField } from './Forms'
import Link from './Link'
import AdminSidebar from './AdminSidebar'
import FuzzySearch from '../charts/FuzzySearch'
import { uniq } from '../charts/Util'
const timeago = require('timeago.js')()
const fuzzysort = require("fuzzysort")

interface ChartMeta {
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
    variables: { id: number, name: string }[]

    titleSearch: any
    variableSearch: any
}

interface Searchable {
    chart: ChartMeta
    term: string
}

function showChartType(chart: ChartMeta) {
    const displayNames: {[key: string]: string} = {
        LineChart: "Line Chart",
        ScatterPlot: "Scatter Plot",
        StackedArea: "Stacked Area",
        DiscreteBar: "Discrete Bar",
        SlopeChart: "Slope Chart"
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
class ChartRow extends React.Component<{ chart: ChartMeta, highlight: (text: string) => any }> {
    context: { admin: Admin }

    render() {
        const {chart, highlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>
                <a className="star-toggle" title="Show this chart on the front page of the website.">
                    {chart.isStarred ? <i className="fa fa-star"/> : <i className="fa fa-star-o"/>}
                </a>
            </td>
            {chart.isPublished ? <td>
                <a href={`${admin.grapherRoot}/${chart.slug}`}>{highlight(chart.title)}</a>
            </td> : <td>
                <span style={{ color: 'red' }}>Draft: </span> {highlight(chart.title)}
            </td>}
            <td style={{"min-width": "120px"}}>{showChartType(chart)}</td>
            <td>{chart.variables.map(v => [
                <Link to={`/variables/${v.id}`} native>{highlight(v.name)}</Link>,
                <br/>
            ])}</td>
            <td>{chart.internalNotes}</td>
            <td>{timeago.format(chart.lastEditedAt)} by {chart.lastEditedBy}</td>
            <td>
                <Link to={`/charts/${chart.id}/edit`} className="btn btn-primary">Edit</Link>
            </td>
            <td>
                <button className="btn btn-danger">Delete</button>
            </td>
        </tr>
    }
}

@observer
export default class ChartIndexPage extends React.Component {
    context: { admin: Admin }

    @observable searchInput?: string
    @observable.ref searchIndex: Searchable[] = []

    @observable rowOffset: number = 0
    @observable numVisibleRows: number = 20
    @observable rowHeight: number = 32
    scrollElement: HTMLDivElement

    @computed get chartsToShow(): ChartMeta[] {
        if (this.searchInput) {
            const results = fuzzysort.go(this.searchInput, this.searchIndex, {
                key: 'term'
            })
            return uniq(results.map((result: any) => result.obj.chart))
        } else {
            return uniq(this.searchIndex.map(o => o.chart))
        }
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.rowOffset = 0
        this.scrollElement.scrollTop = 0
    }

    @computed get numTotalRows(): number {
        return this.chartsToShow.length
    }

    @action.bound onScroll(ev: React.UIEvent<HTMLDivElement>) {
        const { scrollTop, scrollHeight } = ev.currentTarget
        const { numTotalRows } = this

        const rowOffset = Math.round(scrollTop / scrollHeight * numTotalRows)
        ev.currentTarget.scrollTop = Math.round(rowOffset / numTotalRows * scrollHeight)

        this.rowOffset = rowOffset
    }

    render() {
        const {chartsToShow, searchInput, numVisibleRows, rowHeight, rowOffset, numTotalRows} = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html = fuzzysort.highlight(fuzzysort.single(this.searchInput, text)) || text
                return <span dangerouslySetInnerHTML={{__html: html}}/>
            } else
                return text
        }

        return <main className="ChartIndexPage">
            <AdminSidebar/>
            <div>
                <TextField placeholder="Search..." value={searchInput} onValue={this.onSearchInput} autofocus/>
                <table className="table">
                    <thead>
                        <tr>
                            <th><i className="fa fa-star"/></th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Variables</th>
                            <th>Notes</th>
                            <th>Last Updated</th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                        <tbody>
                        {chartsToShow.slice(rowOffset, rowOffset + numVisibleRows).map(chart => <ChartRow chart={chart} highlight={highlight}/>)}
                    </tbody>
                </table>
            </div>
        </main>
    }

    async getData() {
        const data: { charts: ChartMeta[] } = await this.context.admin.getJSON("/charts.json")
        const searchIndex: Searchable[] = []
        for (const chart of data.charts) {
            searchIndex.push({
                chart: chart,
                term: fuzzysort.prepare(chart.title)
            })

            for (const variable of chart.variables) {
                searchIndex.push({
                    chart: chart,
                    term: fuzzysort.prepare(variable.name)
                })
            }
        }

        runInAction(() => this.searchIndex = searchIndex)
    }
    componentDidMount() { this.getData() }
}
