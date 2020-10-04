import { min, max, linkify } from "grapher/utils/Util"
import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { OwidColumnSpec } from "coreTable/OwidTable"
import { AbstractCoreColumn } from "coreTable/CoreTable"

const formatText = (s: string) => linkify(s).replace(/(?:\r\n|\r|\n)/g, "<br/>")

export interface SourcesTabManager {
    adminBaseUrl?: string
    columnsWithSources: AbstractCoreColumn[]
    isAdmin?: boolean
}

@observer
export class SourcesTab extends React.Component<{
    bounds?: Bounds
    manager: SourcesTabManager
}> {
    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get manager() {
        return this.props.manager
    }

    private renderSource(column: AbstractCoreColumn) {
        const spec = column.spec as OwidColumnSpec
        const source = spec.source!
        const { table } = column

        const editUrl = this.manager.isAdmin
            ? `${this.props.manager.adminBaseUrl}/admin/datasets/${spec.datasetId}`
            : undefined

        const minYear = min(column.times)
        const maxYear = max(column.times)
        let timespan = ""
        if (minYear !== undefined && maxYear !== undefined)
            timespan = `${table.timeColumn?.formatValue(
                minYear
            )} – ${table.timeColumn?.formatValue(maxYear)}`

        return (
            <div key={spec.slug} className="datasource-wrapper">
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
                        {spec.coverage ? (
                            <tr>
                                <td>Variable geographic coverage</td>
                                <td>{spec.coverage}</td>
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

    render() {
        const { bounds } = this
        // todo: cleanup the Owidcolumn typings
        const cols = this.manager.columnsWithSources.filter(
            (col) => (col.spec as OwidColumnSpec).source
        )

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
