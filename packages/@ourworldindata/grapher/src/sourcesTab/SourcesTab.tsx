import {
    Bounds,
    DEFAULT_BOUNDS,
    SimpleMarkdownText,
    OwidOrigin,
    uniq,
    excludeNullish,
} from "@ourworldindata/utils"
import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn, OwidColumnDef } from "@ourworldindata/core-table"

export interface SourcesTabManager {
    adminBaseUrl?: string
    columnsWithSources: CoreColumn[]
    showAdminControls?: boolean
}

// TODO: remove this component once all backported indicators
// etc have switched from HTML to markdown for their sources
const HtmlOrMarkdownText = (props: { text: string }): JSX.Element => {
    // check the text for closing a, li or p tags. If
    // one is found, render using dangerouslySetInnerHTML,
    // othewise use SimpleMarkdownText
    const { text } = props
    const htmlRegex = /<\/(a|li|p)>/
    const match = text.match(htmlRegex)
    if (match) {
        return <span dangerouslySetInnerHTML={{ __html: text }} />
    } else {
        return <SimpleMarkdownText text={text} />
    }
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
        // NOTE: Some decisions about which texts are shown (e.g. descriptionShort is
        // preferred over the long description if it exists) are
        // made when the CoreColumn is filled from the Variable metadata
        // in columnDefFromOwidVariable in packages/@ourworldindata/grapher/src/core/LegacyToOwidTable.ts
        const { slug, source, def } = column
        const { datasetId, coverage } = def as OwidColumnDef

        // there will not be a datasetId for explorers that define the FASTT in TSV
        const editUrl =
            this.manager.showAdminControls && datasetId
                ? `${this.props.manager.adminBaseUrl}/admin/datasets/${datasetId}`
                : undefined

        const { minTime, maxTime } = column
        let timespan = column.def.timespanFromMetadata
        if (
            (timespan === undefined || timespan === "") &&
            minTime !== undefined &&
            maxTime !== undefined
        )
            timespan = `${column.formatTime(minTime)} – ${column.formatTime(
                maxTime
            )}`

        const title =
            column.def.titlePublic && column.def.titlePublic !== ""
                ? column.def.titlePublic
                : column.name

        const retrievedDate =
            source.retrievedDate ??
            (column.def.origins && column.def.origins.length
                ? column.def.origins[0].dateAccessed
                : undefined)

        const citationFull =
            column.def.origins && column.def.origins.length
                ? excludeNullish(
                      uniq(
                          column.def.origins.map(
                              (origin: OwidOrigin) => origin.citationFull
                          )
                      )
                  )
                : []

        const publishedByArray = [
            ...(source.dataPublishedBy ? [source.dataPublishedBy] : []),
            ...citationFull,
        ]

        return (
            <div key={slug} className="datasource-wrapper">
                <h2>
                    {title}{" "}
                    {editUrl && (
                        <a href={editUrl} target="_blank" rel="noopener">
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </a>
                    )}
                </h2>
                <table className="variable-desc">
                    <tbody>
                        {column.def.descriptionShort ? (
                            <tr>
                                <td>Variable description</td>
                                <td>
                                    <SimpleMarkdownText
                                        text={column.def.descriptionShort}
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {!column.def.descriptionShort && column.description ? (
                            // Show the description field only if we don't have a
                            // metadata V2 shortDescription
                            <tr>
                                <td>Variable description</td>
                                <td>
                                    <SimpleMarkdownText
                                        text={column.description}
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {column.def.descriptionKey &&
                        column.def.descriptionKey.length === 1 ? (
                            <tr>
                                <td>Key information</td>
                                <td>
                                    <SimpleMarkdownText
                                        text={column.def.descriptionKey[0]}
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {column.def.descriptionKey &&
                        column.def.descriptionKey.length > 1 ? (
                            <tr>
                                <td>Key information</td>
                                <td>
                                    <ul>
                                        {column.def.descriptionKey.map(
                                            (info: string, index: number) => (
                                                <li key={index}>
                                                    <SimpleMarkdownText
                                                        text={info}
                                                    />
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </td>
                            </tr>
                        ) : null}
                        {column.def.descriptionProcessing ? (
                            <tr>
                                <td>Processing notes</td>
                                <td>
                                    <SimpleMarkdownText
                                        text={column.def.descriptionProcessing}
                                    />
                                </td>
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
                        {publishedByArray.length === 1 ? (
                            <tr>
                                <td>Data published by</td>
                                <td>
                                    <SimpleMarkdownText
                                        text={publishedByArray[0]}
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {publishedByArray.length > 1 ? (
                            <tr>
                                <td>Data published by</td>
                                <td>
                                    <ul>
                                        {publishedByArray.map(
                                            (
                                                citation: string,
                                                index: number
                                            ) => (
                                                <li key={index}>
                                                    <SimpleMarkdownText
                                                        text={citation}
                                                    />
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </td>
                            </tr>
                        ) : null}
                        {source.dataPublisherSource ? (
                            <tr>
                                <td>Data publisher's source</td>
                                <td>
                                    <HtmlOrMarkdownText
                                        text={source.dataPublisherSource}
                                    />
                                </td>
                            </tr>
                        ) : null}
                        {source.link ? (
                            <tr>
                                <td>Link</td>
                                <td>
                                    <HtmlOrMarkdownText text={source.link} />
                                </td>
                            </tr>
                        ) : null}
                        {retrievedDate ? (
                            <tr>
                                <td>Retrieved</td>
                                <td>{retrievedDate}</td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
                {source.additionalInfo && (
                    <p key={"additionalInfo"}>
                        <HtmlOrMarkdownText text={source.additionalInfo} />
                    </p>
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
