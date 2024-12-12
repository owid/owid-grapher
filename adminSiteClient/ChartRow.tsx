import React from "react"
import { observer } from "mobx-react"
import { action, runInAction } from "mobx"
import * as lodash from "lodash"
import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import {
    BAKED_GRAPHER_EXPORTS_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { ChartListItem, showChartType } from "./ChartList.js"
import { TaggableType, DbChartTagJoin } from "@ourworldindata/utils"

@observer
export class ChartRow extends React.Component<{
    chart: ChartListItem
    searchHighlight?: (text: string) => string | React.ReactElement
    availableTags: DbChartTagJoin[]
    onDelete: (chart: ChartListItem) => void
    showInheritanceColumn?: boolean
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    async saveTags(tags: DbChartTagJoin[]) {
        const { chart } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/charts/${chart.id}/setTags`,
            { tags },
            "POST"
        )
        if (json.success) {
            runInAction(() => (chart.tags = tags))
        }
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        void this.saveTags(tags)
    }

    render() {
        const { chart, searchHighlight, availableTags, showInheritanceColumn } =
            this.props

        const highlight = searchHighlight || lodash.identity

        return (
            <tr>
                <td style={{ minWidth: "140px", width: "12.5%" }}>
                    {chart.isPublished ? (
                        <a href={`${BAKED_GRAPHER_URL}/${chart.slug}`}>
                            <img
                                src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chart.slug}.svg`}
                                className="chartPreview"
                            />
                        </a>
                    ) : null}
                </td>
                <td style={{ minWidth: "180px" }}>
                    {chart.isPublished ? (
                        <a href={`${BAKED_GRAPHER_URL}/${chart.slug}`}>
                            {highlight(chart.title ?? "")}
                        </a>
                    ) : (
                        <span>
                            <span style={{ color: "red" }}>Draft: </span>{" "}
                            {highlight(chart.title ?? "")}
                        </span>
                    )}{" "}
                    {chart.variantName ? (
                        <span style={{ color: "#aaa" }}>
                            ({highlight(chart.variantName)})
                        </span>
                    ) : undefined}
                    {chart.internalNotes && (
                        <div className="internalNotes">
                            {highlight(chart.internalNotes)}
                        </div>
                    )}
                </td>
                <td style={{ minWidth: "100px" }}>{chart.id}</td>
                <td style={{ minWidth: "100px" }}>{showChartType(chart)}</td>
                {showInheritanceColumn && <InheritanceStatus chart={chart} />}
                <td style={{ minWidth: "340px" }}>
                    <EditableTags
                        tags={chart.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                        hasKeyChartSupport
                        hasSuggestionsSupport
                        taggable={{ type: TaggableType.Charts, id: chart.id }}
                    />
                </td>
                <td>
                    <Timeago
                        time={chart.publishedAt}
                        by={highlight(chart.publishedBy)}
                    />
                </td>
                <td>
                    <Timeago
                        time={chart.lastEditedAt}
                        by={highlight(chart.lastEditedBy)}
                    />
                </td>
                <td>{chart.pageviewsPerDay?.toLocaleString() ?? "0"}</td>
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

function InheritanceStatus({ chart }: { chart: ChartListItem }) {
    // if no information is available, return an empty cell
    if (
        chart.hasParentIndicator === undefined ||
        chart.isInheritanceEnabled === undefined
    )
        return <td></td>

    // if the chart doesn't have a parent, inheritance doesn't apply
    if (!chart.hasParentIndicator) return <td>n/a</td>

    return chart.isInheritanceEnabled ? <td>enabled</td> : <td>disabled</td>
}
