import { min, max, linkify } from "grapher/utils/Util"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { SourceWithDimension } from "grapher/chart/ChartDimension"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

const formatText = (s: string) => linkify(s).replace(/(?:\r\n|\r|\n)/g, "<br/>")

export interface SourcesTabOptionsProvider {
    adminBaseUrl?: string
    sourcesWithDimension: SourceWithDimension[]
    isAdmin?: boolean
}

@observer
export class SourcesTab extends React.Component<{
    bounds?: Bounds
    options: SourcesTabOptionsProvider
}> {
    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get options() {
        return this.props.options
    }

    private renderSource(sourceWithDimension: SourceWithDimension) {
        const source = sourceWithDimension.source
        const dimension = sourceWithDimension.dimension
        const { column } = dimension

        const editUrl = this.options.isAdmin
            ? `${this.props.options.adminBaseUrl}/admin/datasets/${column.datasetId}`
            : undefined

        const minYear = min(column.times)
        const maxYear = max(column.times)
        let timespan = ""
        if (minYear !== undefined && maxYear !== undefined)
            timespan = `${dimension.column.formatTime(
                minYear
            )} – ${dimension.column.formatTime(maxYear)}`

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
                                        __html: formatText(column.description),
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
                        {dimension.column.unitConversionFactor !== 1 ? (
                            <tr>
                                <td>Unit conversion factor for chart</td>
                                <td>{dimension.column.unitConversionFactor}</td>
                            </tr>
                        ) : null}
                        {source.dataPublishedBy ? (
                            <tr>
                                <td>Data published by</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(
                                            source.dataPublishedBy
                                        ),
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
                                        ),
                                    }}
                                />
                            </tr>
                        ) : null}
                        {source.link ? (
                            <tr>
                                <td>Link</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: formatText(source.link),
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
                            __html: formatText(source.additionalInfo),
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
                        {this.options.sourcesWithDimension.map((source) =>
                            this.renderSource(source)
                        )}
                    </div>
                </div>
            </div>
        )
    }
}
