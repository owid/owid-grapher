import React from "react"
import { observer } from "mobx-react"
import { runInAction, observable } from "mobx"
import { bind } from "decko"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartTypeName, GrapherInterface } from "@ourworldindata/types"
import { startCase, ChartTagJoin } from "@ourworldindata/utils"
import { References, getFullReferencesCount } from "./ChartEditor.js"
import { ChartRow } from "./ChartRow.js"

// These properties are coming from OldChart.ts
export interface ChartListItem {
    // the first few entries mirror GrapherInterface, so take the types from there
    id: GrapherInterface["id"]
    title: GrapherInterface["title"]
    slug: GrapherInterface["slug"]
    type: GrapherInterface["type"]
    internalNotes: GrapherInterface["internalNotes"]
    variantName: GrapherInterface["variantName"]
    isPublished: GrapherInterface["isPublished"]
    tab: GrapherInterface["tab"]
    hasChartTab: GrapherInterface["hasChartTab"]
    hasMapTab: GrapherInterface["hasMapTab"]

    lastEditedAt: string
    lastEditedBy: string
    publishedAt: string
    publishedBy: string
    isExplorable: boolean

    tags: ChartTagJoin[]
}

@observer
export class ChartList extends React.Component<{
    charts: ChartListItem[]
    searchHighlight?: (text: string) => string | JSX.Element
    onDelete?: (chart: ChartListItem) => void
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable availableTags: ChartTagJoin[] = []

    async fetchRefs(grapherId: number | undefined): Promise<References> {
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/charts/${grapherId}.references.json`
                  )
        return json.references
    }

    @bind async onDeleteChart(chart: ChartListItem) {
        const refs = await this.fetchRefs(chart.id)
        if (getFullReferencesCount(refs) > 0) {
            window.alert(
                `Cannot delete chart ${
                    chart.slug
                } because it is used in ${getFullReferencesCount(
                    refs
                )} places. See the references tab in the chart editor for details.`
            )
            return
        }
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
                        <th>Id</th>
                        <th>Type</th>
                        <th>Tags</th>
                        <th>Published</th>
                        <th>Last Updated</th>
                        <th></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {charts.map((chart) => (
                        <ChartRow
                            chart={chart}
                            key={chart.id}
                            availableTags={availableTags}
                            searchHighlight={searchHighlight}
                            onDelete={this.onDeleteChart}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}

export function showChartType(chart: ChartListItem) {
    const chartType = chart.type ?? ChartTypeName.LineChart
    const displayType = ChartTypeName[chartType]
        ? startCase(ChartTypeName[chartType])
        : "Unknown"

    if (chart.tab === "map") {
        if (chart.hasChartTab) return `Map + ${displayType}`
        else return "Map"
    } else {
        if (chart.hasMapTab) return `${displayType} + Map`
        else return displayType
    }
}
