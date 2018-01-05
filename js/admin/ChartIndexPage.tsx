import Admin from './Admin'
import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
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
    publishedAt: string
    publishedBy: string
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
class ChartRow extends React.Component<{ chart: ChartMeta, highlight: (text: string) => any, onDelete: (chart: ChartMeta) => void, onToggleStar: (chart: ChartMeta) => void }> {
    context: { admin: Admin }

    render() {
        const {chart, highlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>
                <a title="Show this chart on the front page of the website." onClick={_ => this.props.onToggleStar(chart)}>
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
            <td>{chart.publishedAt && timeago.format(chart.publishedAt)}{chart.publishedBy && <span> by {chart.lastEditedBy}</span>}</td>
            <td>{timeago.format(chart.lastEditedAt)} by {chart.lastEditedBy}</td>
            <td>
                <Link to={`/charts/${chart.id}/edit`} className="btn btn-primary">Edit</Link>
            </td>
            <td>
                <button className="btn btn-danger" onClick={_ => this.props.onDelete(chart)}>Delete</button>
            </td>
        </tr>
    }
}

@observer
export default class ChartIndexPage extends React.Component {
    context: { admin: Admin }

    @observable searchInput?: string
    @computed get wantsSearch(): boolean { return !!this.searchInput }
    @observable maxVisibleCharts = 50
    @observable charts: ChartMeta[] = []
    @observable numTotalCharts: number = 0

    @computed get searchIndex(): Searchable[] {
        const searchIndex: Searchable[] = []
        for (const chart of this.charts) {
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

        return searchIndex
    }

    @computed get chartsToShow(): ChartMeta[] {
        const {searchInput, searchIndex, maxVisibleCharts} = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: 'term'
            })
            return uniq(results.map((result: any) => result.obj.chart))
        } else {
            return this.charts.slice(0, maxVisibleCharts)
        }
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
        this.maxVisibleCharts += 100
    }

    @action.bound async onDeleteChart(chart: ChartMeta) {
        if (!window.confirm(`Delete the chart ${chart.slug}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`charts/${chart.id}`, {}, "DELETE")

        if (json.success) {
            runInAction(() => this.charts.splice(this.charts.indexOf(chart), 1))
        }
    }

    @action.bound async onToggleStar(chart: ChartMeta) {
        const json = await this.context.admin.requestJSON(`charts/${chart.id}/${chart.isStarred ? 'unstar' : 'star'}`, {}, 'POST')
        if (json.success) {
            runInAction(() => {
                for (const otherChart of this.charts) {
                    if (otherChart === chart) {
                        otherChart.isStarred = true
                    } else if (otherChart.isStarred) {
                        otherChart.isStarred = false
                    }
                }
            })
        }
    }

    @computed get isSearchReady(): boolean {
        return this.charts.length >= this.numTotalCharts
    }

    @computed get needsMoreData(): boolean {
        return !!(this.maxVisibleCharts > this.charts.length || (this.wantsSearch && !this.isSearchReady))
    }

    render() {
        const {chartsToShow, searchInput, numTotalCharts, isSearchReady} = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html = fuzzysort.highlight(fuzzysort.single(this.searchInput, text)) || text
                return <span dangerouslySetInnerHTML={{__html: html}}/>
            } else
                return text
        }

        return <main className="ChartIndexPage">
            <div className="topRow">
                <span>Showing {chartsToShow.length} of {numTotalCharts} charts</span>
                <TextField placeholder="Search all charts..." value={searchInput} onValue={this.onSearchInput} autofocus/>
            </div>
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th><i className="fa fa-star"/></th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Variables</th>
                        <th>Notes</th>
                        <th>Published</th>
                        <th>Last Updated</th>
                        <th></th>
                        <th></th>
                    </tr>
                </thead>
                    <tbody>
                    {chartsToShow.map(chart => <ChartRow chart={chart} highlight={highlight} onDelete={this.onDeleteChart} onToggleStar={this.onToggleStar}/>)}
                </tbody>
            </table>
            {!searchInput && <button className="btn btn-secondary" onClick={this.onShowMore}>Show more charts...</button>}
        </main>
    }

    async getData() {
        const {admin} = this.context
        if (admin.currentRequests.length > 0)
            return

        const json = await admin.getJSON("/charts.json" + (this.wantsSearch ? "" : `?limit=${this.maxVisibleCharts}`))
        runInAction(() => {
            this.charts = json.charts
            this.numTotalCharts = json.numTotalCharts
        })
    }

    dispose: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.needsMoreData,
            () => {
                if (this.needsMoreData)
                    this.getData()
            }
        )
        this.getData()
     }

     componentWillUnmount() {
         this.dispose()
     }
}
