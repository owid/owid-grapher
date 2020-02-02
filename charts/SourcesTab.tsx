import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as Cookies from "js-cookie"
import { computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { ADMIN_BASE_URL } from "settings"

import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { SourceWithDimension } from "./ChartData"
import { extend } from "./Util"

const linkifyHtml = require("linkifyjs/html")
function linkify(s: string) {
    return linkifyHtml(s).replace(/(?:\r\n|\r|\n)/g, "<br/>")
}
@observer
export class SourcesTab extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    @computed get bounds() {
        return this.props.bounds
    }

    @computed get sources() {
        return this.props.chart.data.sources
    }

    renderSource(source: SourceWithDimension) {
        const { dimension } = source
        const { variable } = dimension

        const editUrl = Cookies.get("isAdmin")
            ? `${ADMIN_BASE_URL}/admin/datasets/${variable.datasetId}`
            : undefined

        return (
            <div key={source.id} className="datasource-wrapper">
                <h2>
                    {variable.name}{" "}
                    {editUrl && (
                        <a href={editUrl} target="_blank">
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </a>
                    )}
                </h2>
                <table className="variable-desc">
                    <tbody>
                        {variable.description ? (
                            <tr>
                                <td>Variable description</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: linkify(variable.description)
                                    }}
                                />
                            </tr>
                        ) : null}
                        {variable.coverage ? (
                            <tr>
                                <td>Variable geographic coverage</td>
                                <td>{variable.coverage}</td>
                            </tr>
                        ) : null}
                        {variable.timespan ? (
                            <tr>
                                <td>Variable time span</td>
                                <td>{variable.timespan}</td>
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
                                        __html: linkify(source.dataPublishedBy)
                                    }}
                                />
                            </tr>
                        ) : null}
                        {source.dataPublisherSource ? (
                            <tr>
                                <td>Data publisher's source</td>
                                <td
                                    dangerouslySetInnerHTML={{
                                        __html: linkify(
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
                                        __html: linkify(source.link)
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
                            __html: linkify(source.additionalInfo)
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
                style={extend(bounds.toCSS(), { position: "absolute" })}
            >
                <div>
                    <h2>Sources</h2>
                    <div>
                        {this.sources.map(source => this.renderSource(source))}
                    </div>
                </div>
            </div>
        )
    }
}
