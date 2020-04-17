import * as React from "react"
import { observer } from "mobx-react"
import { action, runInAction, observable } from "mobx"
import { format } from "timeago.js"
import * as _ from "lodash"

import { Link } from "./Link"
import { Tag } from "./TagBadge"
import { bind } from "decko"
import { EditableTags } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { BAKED_GRAPHER_URL } from "settings"
import { ChartTypeDefsByKey } from "charts/ChartType"

export interface ChartListItem {
    id: number
    slug: string
    title: string
    tab: string
    hasChartTab: boolean
    hasMapTab: boolean
    isPublished: boolean
    isStarred: boolean
    variantName: string
    internalNotes: string
    type: string
    lastEditedAt: string
    lastEditedBy: string
    publishedAt: string
    publishedBy: string
    tags: Tag[]
}

function showChartType(chart: ChartListItem) {
    const chartTypeDefs = ChartTypeDefsByKey[chart.type]
    const displayType = (chartTypeDefs && chartTypeDefs.label) || "Unknown"

    if (chart.tab === "map") {
        if (chart.hasChartTab) return `Map + ${displayType}`
        else return "Map"
    } else {
        if (chart.hasMapTab) return `${displayType} + Map`
        else return displayType
    }
}

@observer
class ChartRow extends React.Component<{
    chart: ChartListItem
    searchHighlight?: (text: string) => any
    availableTags: Tag[]
    onDelete: (chart: ChartListItem) => void
    onStar: (chart: ChartListItem) => void
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    async saveTags(tags: Tag[]) {
        const { chart } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}/setTags`,
            { tagIds: tags.map(t => t.id) },
            "POST"
        )
        if (json.success) {
            runInAction(() => (chart.tags = tags))
        }
    }

    @action.bound onSaveTags(tags: Tag[]) {
        this.saveTags(tags)
    }

    render() {
        const { chart, searchHighlight, availableTags } = this.props

        const highlight = searchHighlight || _.identity

        return (
            <tr>
                <td>
                    {chart.isPublished && (
                        <a href={`${BAKED_GRAPHER_URL}/${chart.slug}`}>
                            <img
                                src={`${BAKED_GRAPHER_URL}/exports/${chart.slug}.svg`}
                                className="chartPreview"
                            />
                        </a>
                    )}
                </td>
                {chart.isPublished ? (
                    <td>
                        <a href={`${BAKED_GRAPHER_URL}/${chart.slug}`}>
                            {highlight(chart.title)}
                        </a>{" "}
                        {chart.variantName ? (
                            <span style={{ color: "#aaa" }}>
                                ({highlight(chart.variantName)})
                            </span>
                        ) : (
                            undefined
                        )}
                    </td>
                ) : (
                    <td>
                        <span style={{ color: "red" }}>Draft: </span>{" "}
                        {highlight(chart.title)}{" "}
                        {chart.variantName ? (
                            <span style={{ color: "#aaa" }}>
                                ({highlight(chart.variantName)})
                            </span>
                        ) : (
                            undefined
                        )}
                    </td>
                )}
                <td style={{ minWidth: "120px" }}>{showChartType(chart)}</td>
                <td>{highlight(chart.internalNotes)}</td>
                <td style={{ minWidth: "380px" }}>
                    <EditableTags
                        tags={chart.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                    />
                </td>
                <td>
                    {chart.publishedAt && format(chart.publishedAt)}
                    {chart.publishedBy && (
                        <span> by {highlight(chart.publishedBy)}</span>
                    )}
                </td>
                <td>
                    {format(chart.lastEditedAt)} by{" "}
                    {highlight(chart.lastEditedBy)}
                </td>
                <td>
                    <Link
                        to={`/charts/${chart.id}/edit`}
                        className="btn btn-primary"
                    >
                        Edit
                    </Link>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() => this.props.onDelete(chart)}
                    >
                        Delete
                    </button>
                </td>
            </tr>
        )
    }
}

@observer
export class ChartList extends React.Component<{
    charts: ChartListItem[]
    searchHighlight?: (text: string) => any
    onDelete?: (chart: ChartListItem) => void
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable availableTags: Tag[] = []

    @bind async onDeleteChart(chart: ChartListItem) {
        if (
            !window.confirm(
                `Delete the chart ${chart.slug}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            if (this.props.onDelete) this.props.onDelete(chart)
            else
                runInAction(() =>
                    this.props.charts.splice(
                        this.props.charts.indexOf(chart),
                        1
                    )
                )
        }
    }

    @bind async onStar(chart: ChartListItem) {
        if (chart.isStarred) return

        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}/star`,
            {},
            "POST"
        )
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

    @bind async getTags() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => (this.availableTags = json.tags))
    }

    componentDidMount() {
        this.getTags()
    }

    render() {
        const { charts, searchHighlight } = this.props
        const { availableTags } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th></th>
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
                    {charts.map(chart => (
                        <ChartRow
                            chart={chart}
                            key={chart.id}
                            availableTags={availableTags}
                            searchHighlight={searchHighlight}
                            onDelete={this.onDeleteChart}
                            onStar={this.onStar}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
