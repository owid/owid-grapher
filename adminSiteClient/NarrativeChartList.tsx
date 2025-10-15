import * as React from "react"
import { observer } from "mobx-react"
import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import { NarrativeChartListItem } from "./DatasetEditPage.js"

interface NarrativeChartListProps {
    narrativeCharts: NarrativeChartListItem[]
}

function makeParentUrl(
    parentChartId: number | null,
    parentCatalogPath: string | null,
    queryParamsForParentChart: string
): string | null {
    if (parentChartId) {
        return `/charts/${parentChartId}/edit`
    }
    if (parentCatalogPath) {
        try {
            const searchParams = new URLSearchParams(
                JSON.parse(queryParamsForParentChart)
            )
            return `/grapher/${encodeURIComponent(parentCatalogPath)}?${searchParams.toString()}`
        } catch {
            return null
        }
    }
    return null
}

@observer
export class NarrativeChartList extends React.Component<NarrativeChartListProps> {
    override render() {
        const { narrativeCharts } = this.props

        if (narrativeCharts.length === 0) {
            return (
                <p className="text-muted">
                    No narrative charts use variables from this dataset.
                </p>
            )
        }

        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Preview</th>
                        <th>Name</th>
                        <th>Title</th>
                        <th>Parent Chart</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {narrativeCharts.map((chart) => {
                        const parentUrl = makeParentUrl(
                            chart.parentChartId,
                            chart.parentCatalogPath,
                            chart.queryParamsForParentChart
                        )
                        const parentType = chart.parentChartId
                            ? "chart"
                            : "multiDim"

                        return (
                            <tr key={chart.id}>
                                <td style={{ width: 150 }}>
                                    <img
                                        src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/by-uuid/${chart.chartConfigId}.svg`}
                                        style={{ maxWidth: 140, maxHeight: 100 }}
                                        alt={chart.title}
                                    />
                                </td>
                                <td>{chart.name}</td>
                                <td>{chart.title}</td>
                                <td>
                                    {parentUrl ? (
                                        parentType === "chart" ? (
                                            <Link to={parentUrl}>
                                                {chart.parentTitle}
                                            </Link>
                                        ) : (
                                            <a
                                                href={`/admin${parentUrl}`}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                {chart.parentTitle}
                                            </a>
                                        )
                                    ) : (
                                        chart.parentTitle
                                    )}
                                </td>
                                <td>
                                    <Timeago
                                        time={chart.updatedAt}
                                        by={chart.lastEditedByUser}
                                    />
                                </td>
                                <td>
                                    <Link
                                        to={`/narrative-charts/${chart.id}/edit`}
                                        className="btn btn-primary btn-sm"
                                    >
                                        Edit
                                    </Link>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        )
    }
}
