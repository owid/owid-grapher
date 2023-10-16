import {
    Bounds,
    DEFAULT_BOUNDS,
    OwidOrigin,
    uniq,
    excludeNullish,
} from "@ourworldindata/utils"
import { SimpleMarkdownText } from "@ourworldindata/components"
import React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn, OwidColumnDef } from "@ourworldindata/core-table"
import { Modal } from "./Modal"

export interface SourcesModalManager {
    adminBaseUrl?: string
    columnsWithSourcesExtensive: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    tabBounds?: Bounds
}

// TODO: remove this component once all backported indicators
// etc have switched from HTML to markdown for their sources
const HtmlOrMarkdownText = (props: { text: string }): JSX.Element => {
    // check the text for closing a, li or p tags. If
    // one is found, render using dangerouslySetInnerHTML,
    // otherwise use SimpleMarkdownText
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
export class SourcesModal extends React.Component<{
    manager: SourcesModalManager
}> {
    @computed private get manager(): SourcesModalManager {
        return this.props.manager
    }

    @computed private get tabBounds(): Bounds {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 740
        // using 15px instead of 16px to make sure the modal fully covers the OWID logo in the header
        const padWidth = Math.max(15, (this.tabBounds.width - maxWidth) / 2)
        return this.tabBounds.padHeight(15).padWidth(padWidth)
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

        const title = column.displayName

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

        const sourceLink =
            source?.link ??
            (column.def.origins && column.def.origins.length > 0
                ? column.def.origins[0].urlMain
                : undefined)

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
                                        text={column.def.descriptionShort.trim()}
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
                                        text={column.description.trim()}
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
                        {sourceLink ? (
                            <tr>
                                <td>Link</td>
                                <td>
                                    <HtmlOrMarkdownText text={sourceLink} />
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
        const cols = this.manager.columnsWithSourcesExtensive
        return (
            <Modal
                title="Sources"
                onDismiss={action(
                    () => (this.manager.isSourcesModalOpen = false)
                )}
                bounds={this.modalBounds}
            >
                <div className="SourcesModalContent">
                    {cols.map((col) => this.renderSource(col))}
                </div>
            </Modal>
        )
    }
}
