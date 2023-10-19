import {
    Bounds,
    DEFAULT_BOUNDS,
    SimpleMarkdownText,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    DATAPAGE_FAQS_SECTION_ID,
    dayjs,
} from "@ourworldindata/utils"
import React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { faArrowRight, faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn, CoreColumnDef } from "@ourworldindata/core-table"
import { Modal } from "./Modal"

export interface SourcesModalManager {
    adminBaseUrl?: string
    columnsWithSources: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    tabBounds?: Bounds
    canonicalUrl?: string
    isEmbeddedInADataPage?: boolean
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

    @computed private get editBaseUrl(): string | undefined {
        if (!this.manager.showAdminControls) return undefined
        return `${this.props.manager.adminBaseUrl}/admin/datasets`
    }

    @action private onDismiss(): void {
        this.manager.isSourcesModalOpen = false
    }

    render(): JSX.Element {
        const columns = this.manager.columnsWithSources
        return (
            <Modal
                title="Sources"
                onDismiss={this.onDismiss}
                bounds={this.modalBounds}
            >
                <div className="SourcesModalContent">
                    {columns.map((column) => (
                        <Sources
                            key={column.slug}
                            column={column}
                            canonicalUrl={this.manager.canonicalUrl}
                            editBaseUrl={this.editBaseUrl}
                        />
                    ))}
                </div>
            </Modal>
        )
    }
}

interface DisplayOrigin {
    title: string
    description: string
    retrievedOn?: string
    retrievedFrom?: string
}

@observer
export class Sources extends React.Component<{
    column: CoreColumn
    canonicalUrl?: string
    editBaseUrl?: string
    isEmbeddedInADataPage?: boolean
}> {
    // NOTE: Some decisions about which texts are shown (e.g. descriptionShort is
    // preferred over the long description if it exists) are
    // made when the CoreColumn is filled from the Variable metadata
    // in columnDefFromOwidVariable in packages/@ourworldindata/grapher/src/core/LegacyToOwidTable.ts

    @computed private get def(): CoreColumnDef {
        return this.props.column.def
    }

    @computed private get title(): string {
        return (
            this.def.presentation?.titlePublic ||
            this.def.display?.name ||
            this.def.name ||
            ""
        )
    }

    @computed private get editUrl(): string | undefined {
        // there will not be a datasetId for explorers that define the FASTT in TSV
        if (!this.props.editBaseUrl || !this.def.datasetId) return undefined
        return `${this.props.editBaseUrl}/${this.def.datasetId}`
    }

    @computed private get description(): string[] | undefined {
        if (this.def.descriptionKey && this.def.descriptionKey.length > 0)
            return this.def.descriptionKey
        return undefined
    }

    @computed private get sourceProcessedText(): string | undefined {
        if (!this.def.owidProcessingLevel) return undefined
        return this.def.owidProcessingLevel === "minor"
            ? `Processed by Our World In Data`
            : `Adapted by Our World In Data`
    }

    @computed private get hasDatapage(): boolean {
        return (
            this.props.isEmbeddedInADataPage ||
            (this.def.owidSchemaVersion !== undefined &&
                this.def.owidSchemaVersion > 1)
        )
    }

    @computed private get datapageHasFAQSection(): boolean {
        return (
            this.hasDatapage && (this.def.presentation?.faqs?.length ?? 0) > 0
        )
    }

    @computed private get hasKeyInformation(): boolean {
        return (
            !!this.def.presentation?.attributionWithFallback ||
            !!this.def.timespan ||
            !!this.def.lastUpdated ||
            !!this.def.nextUpdate
        )
    }

    @computed private get displayOrigins(): DisplayOrigin[] {
        const origins: DisplayOrigin[] = []
        if (this.def.origins) {
            for (const origin of this.def.origins) {
                const title =
                    origin.producer ??
                    origin.descriptionSnapshot ??
                    origin.description
                if (title && origin.description) {
                    origins.push({
                        title,
                        description: origin.description,
                        retrievedOn: dayjs(origin.dateAccessed).format(
                            "MMMM D, YYYY"
                        ),
                        retrievedFrom: origin.urlDownload,
                    })
                }
            }
        }
        if (this.def.source?.name && this.def.source?.additionalInfo) {
            origins.push({
                title: this.def.source.name,
                description: this.def.source.additionalInfo,
                retrievedOn: this.def.source.retrievedDate,
                retrievedFrom: this.def.source.link,
            })
        }
        return origins
    }

    render(): JSX.Element {
        return (
            <div className="sources">
                <h2>
                    {this.title}{" "}
                    {this.editUrl && (
                        <a href={this.editUrl} target="_blank" rel="noopener">
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </a>
                    )}
                </h2>

                {/* ---- Key information ---- */}

                {this.hasKeyInformation && (
                    <div className="key-info">
                        {this.def.presentation?.attributionWithFallback && (
                            <div className="key-data">
                                <div className="key-data__title">Source</div>
                                <div>
                                    {
                                        this.def.presentation
                                            .attributionWithFallback
                                    }
                                    {this.sourceProcessedText &&
                                        this.hasDatapage && (
                                            <div>
                                                <a
                                                    className="link__learn-more"
                                                    href={`${this.props.canonicalUrl}#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                                                >
                                                    {this.sourceProcessedText}
                                                </a>
                                            </div>
                                        )}
                                </div>
                            </div>
                        )}
                        {this.def.timespan && (
                            <div className="key-data">
                                <div className="key-data__title">
                                    Date range
                                </div>
                                <div>{this.def.timespan}</div>
                            </div>
                        )}
                        {this.def.lastUpdated && (
                            <div className="key-data">
                                <div className="key-data__title">
                                    Last updated
                                </div>
                                <div>{this.def.lastUpdated}</div>
                            </div>
                        )}
                        {this.def.nextUpdate && (
                            <div className="key-data">
                                <div className="key-data__title">
                                    Next expected update
                                </div>
                                <div>{this.def.nextUpdate}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- Description ---- */}

                {this.description && this.description.length > 0 && (
                    <>
                        <h3>What you should know about this indicator:</h3>

                        <ul>
                            {this.description.map(
                                (text: string, index: number) => (
                                    <li key={index}>
                                        <HtmlOrMarkdownText text={text} />
                                    </li>
                                )
                            )}
                        </ul>

                        {this.datapageHasFAQSection && (
                            <a
                                href={`${this.props.canonicalUrl}#${DATAPAGE_FAQS_SECTION_ID}`}
                                className="link__learn-more"
                            >
                                Learn more in the FAQs
                                <FontAwesomeIcon icon={faArrowRight} />
                            </a>
                        )}
                    </>
                )}

                {/* ---- Origins ---- */}

                {this.displayOrigins && this.displayOrigins.length > 0 && (
                    <>
                        <h3>This data is based on the following sources:</h3>

                        {this.displayOrigins.map(
                            ({
                                title,
                                description,
                                retrievedOn,
                                retrievedFrom,
                            }) => (
                                <div key={title} className="origin">
                                    <h4>{title}</h4>
                                    <p className="origin__description">
                                        <HtmlOrMarkdownText
                                            text={description}
                                        />
                                    </p>
                                    {(retrievedOn || retrievedFrom) && (
                                        <div className="origin__key-info">
                                            {retrievedOn && (
                                                <div className="origin__key-data">
                                                    <div className="origin__key-data__title">
                                                        Retrieved on
                                                    </div>
                                                    <div className="origin__key-data__content">
                                                        {retrievedOn}
                                                    </div>
                                                </div>
                                            )}
                                            {retrievedFrom && (
                                                <div className="origin__key-data">
                                                    <div className="origin__key-data__title">
                                                        Retrieved from
                                                    </div>
                                                    <div className="origin__key-data__content">
                                                        {/* rendered as markdown since it can contain multiple links */}
                                                        <SimpleMarkdownText
                                                            text={retrievedFrom}
                                                        />{" "}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {this.hasDatapage && (
                            <a
                                href={`${this.props.canonicalUrl}#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                                className="link__learn-more"
                            >
                                More about the sources
                                <FontAwesomeIcon icon={faArrowRight} />
                            </a>
                        )}
                    </>
                )}

                {/* ---- Processing ---- */}

                <h4 style={{ marginTop: "2em" }}>
                    How we process data at Our World in Data:
                </h4>

                <p>
                    All data and visualizations on Our World in Data rely on
                    data sourced from one or several original data providers.
                    Preparing this original data involves several processing
                    steps. Depending on the data, this can include standardizing
                    country names and world region definitions, converting
                    units, calculating derived indicators such as per capita
                    measures, as well as adding or adapting metadata such as the
                    name or the description given to an indicator.
                </p>

                <p>
                    At the link below you can find a detailed description of the
                    structure of our data pipeline, including links to all the
                    code used to prepare data across Our World in Data.
                </p>

                <a
                    href="https://docs.owid.io/projects/etl/"
                    target="_blank"
                    rel="nopener noreferrer"
                    className="link__learn-more"
                >
                    Read about our data pipeline
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>

                {this.def.descriptionProcessing && (
                    <div className="call-out">
                        <h5>
                            Notes on our processing steps for this indicator
                        </h5>
                        <p>
                            <HtmlOrMarkdownText
                                text={this.def.descriptionProcessing}
                            />
                        </p>
                    </div>
                )}
            </div>
        )
    }
}
