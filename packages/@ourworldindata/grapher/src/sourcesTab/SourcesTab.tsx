import { Bounds, DEFAULT_BOUNDS, linkify } from "@ourworldindata/utils"
import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn } from "@ourworldindata/core-table"
import { OwidColumnDef } from "@ourworldindata/core-table"

const formatText = (s: string): string =>
    linkify(s).replace(/(?:\r\n|\r|\n)/g, "<br/>")

export interface SourcesTabManager {
    adminBaseUrl?: string
    columnsWithSources: CoreColumn[]
    showAdminControls?: boolean
}

@observer
export class SourcesTab extends React.Component<{
    bounds?: Bounds
    manager: SourcesTabManager
}> {
    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get manager(): SourcesTabManager {
        return this.props.manager
    }

    private renderSource(column: CoreColumn): JSX.Element {
        const { slug, source, def } = column
        const { datasetId, coverage } = def as OwidColumnDef

        const editUrl = this.manager.showAdminControls
            ? `${this.props.manager.adminBaseUrl}/admin/datasets/${datasetId}`
            : undefined

        const { minTime, maxTime } = column
        let timespan = ""
        if (minTime !== undefined && maxTime !== undefined)
            timespan = `${column.formatTime(minTime)} – ${column.formatTime(
                maxTime
            )}`

        return (
            <div key={slug} className="datasource-wrapper">
                <h2>
                    {column.name}{" "}
                    {editUrl && (
                        <a href={editUrl} target="_blank" rel="noopener">
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
                        {coverage ? (
                            <tr>
                                <td>Variable geographic coverage</td>
                                <td>{coverage}</td>
                            </tr>
                        ) : null}
                        {timespan ? (
                            <tr>
                                <td>Variable time span</td>
                                <td>{timespan}</td>
                            </tr>
                        ) : null}
                        {column.unitConversionFactor !== 1 ? (
                            <tr>
                                <td>Unit conversion factor for chart</td>
                                <td>{column.unitConversionFactor}</td>
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

    render(): JSX.Element {
        const { bounds } = this
        const cols = this.manager.columnsWithSources

        return (
            <div
                className="sourcesTab"
                style={{ ...bounds.toCSS(), position: "absolute" }}
            >
                <div>
                    <h2>Sources</h2>
                    <div>{cols.map((col) => this.renderSource(col))}</div>
                </div>
            </div>
        )
    }
}
