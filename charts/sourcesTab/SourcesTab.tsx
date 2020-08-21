import { min, max, linkify } from "../utils/Util"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { ChartConfig } from "charts/core/ChartConfig"
import * as Cookies from "js-cookie"
import { ADMIN_BASE_URL } from "settings"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SourceWithDimension } from "charts/core/ChartData"

function formatText(s: string) {
    return linkify(s).replace(/(?:\r\n|\r|\n)/g, "<br/>")
}

@observer
export class SourcesTab extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    @computed private get bounds() {
        return this.props.bounds
    }

    @computed private get sourcesWithDimensions() {
        return this.props.chart.sourcesWithDimension
    }

    private renderSource(sourceWithDimension: SourceWithDimension) {
        const source = sourceWithDimension.source
        const dimension = sourceWithDimension.dimension
        const { column } = dimension

        const editUrl = Cookies.get("isAdmin")
            ? `${ADMIN_BASE_URL}/admin/datasets/${column.datasetId}`
            : undefined

        const minYear = min(column.years)
        const maxYear = max(column.years)
        let timespan = ""
        if (minYear !== undefined && maxYear !== undefined)
            timespan = `${dimension.formatYear(
                minYear
            )} – ${dimension.formatYear(maxYear)}`

        return (
            <div key={source.id} className="datasource-wrapper">
                <h2>
                    {column.name}{" "}
                    {editUrl && (
                        <a href={editUrl} target="_blank">
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </a>
                    )}
                </h2>
                <table className="variable-desc">
                    <tbody>
                        {column.description ? (
                            <tr>
                                <td>Variable description</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(column.description)
                                    }}
                                />
                            </tr>
                        ) : null}
                        {column.coverage ? (
                            <tr>
                                <td>Variable geographic coverage</td>
                                <td>{column.coverage}</td>
                            </tr>
                        ) : null}
                        {timespan ? (
                            <tr>
                                <td>Variable time span</td>
                                <td>{timespan}</td>
                            </tr>
                        ) : null}
                        {dimension.unitConversionFactor !== 1 ? (
                            <tr>
                                <td>Unit conversion factor for chart</td>
                                <td>{dimension.unitConversionFactor}</td>
                            </tr>
                        ) : null}
                        {source.dataPublishedBy ? (
                            <tr>
                                <td>Data published by</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(
                                            source.dataPublishedBy
                                        )
                                    }}
                                />
                            </tr>
                        ) : null}
                        {source.dataPublisherSource ? (
                            <tr>
                                <td>Data publisher's source</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(
                                            source.dataPublisherSource
                                        )
                                    }}
                                />
                            </tr>
                        ) : null}
                        {source.link ? (
                            <tr>
                                <td>Link</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(source.link)
                                    }}
                                />
                            </tr>
                        ) : null}
                        {source.retrievedDate ? (
                            <tr>
                                <td>Retrieved</td>
                                <td>{source.retrievedDate}</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
                {source.additionalInfo && (
                    <p
                        dangerouslySetInnerHTML={{
                            __html: formatText(source.additionalInfo)
                        }}
                    />
                )}
            </div>
        )
    }

    render() {
        const { bounds } = this

        return (
            <div
                className="sourcesTab"
                style={{ ...bounds.toCSS(), position: "absolute" }}
            >
                <div>
                    <h2>Sources</h2>
                    <div>
                        {this.sourcesWithDimensions.map(source =>
                            this.renderSource(source)
                        )}
                    </div>
                </div>
            </div>
        )
    }
}
