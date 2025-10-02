import * as _ from "lodash-es"
import dayjs from "dayjs"
import { useState, useMemo, useCallback } from "react"

import {
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    IndicatorSources,
    IndicatorProcessing,
    CodeSnippet,
    DataCitation,
    DownloadIconFullDataset,
    DownloadIconSelected,
    RadioButton,
    ExpandableToggle,
} from "@ourworldindata/components"
import {
    FaqEntryData,
    OwidOrigin,
    PrimaryTopic,
    OwidSource,
    IndicatorTitleWithFragments,
    OwidProcessingLevel,
    ArchiveContext,
    OwidColumnDef,
} from "@ourworldindata/types"
import {
    prepareSourcesForDisplay,
    getCitationShort,
    getCitationLong,
    excludeUndefined,
    getPhraseForArchivalDate,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
    makeDownloadCodeExamples,
} from "@ourworldindata/utils"
import {
    CsvDownloadType,
    createCsvBlobLocally,
    getDownloadUrl,
    getNonRedistributableInfo,
} from "@ourworldindata/grapher"
import type {
    DataDownloadContextBase,
    DataDownloadContextServerSide,
    DataDownloadContextClientSide,
} from "@ourworldindata/grapher"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import {
    BlankOwidTable,
    CoreColumn,
    OwidTable,
} from "@ourworldindata/core-table"
interface DownloadButtonProps {
    title: string
    description: string
    onClick: () => void
    icon?: React.ReactElement
    tracking?: string
}

function DownloadButton(props: DownloadButtonProps): React.ReactElement {
    return (
        <button
            className="downloads__download-button"
            onClick={props.onClick}
            data-track-note={props.tracking}
        >
            {props.icon && (
                <div className="downloads__option-icon">{props.icon}</div>
            )}
            <div className="downloads__download-button-content">
                <h4>{props.title}</h4>
                <p className="downloads__download-button-description">
                    {props.description}
                </p>
            </div>
            <div className="downloads__download-icon">
                <FontAwesomeIcon icon={faDownload} />
            </div>
        </button>
    )
}

const CodeExamplesBlock = (props: { csvUrl: string; metadataUrl: string }) => {
    const code = makeDownloadCodeExamples(props.csvUrl, props.metadataUrl)

    return (
        <div className="downloads-section">
            <ExpandableToggle
                label="Code examples"
                alwaysVisibleDescription={
                    <p className="citation__paragraph">
                        Examples of how to load this data into different data
                        analysis tools.
                    </p>
                }
                content={
                    <div className="downloads__code-blocks">
                        {Object.entries(code).map(([name, snippet]) => (
                            <div key={name}>
                                <h5 className="downloads__code-label">
                                    {name}
                                </h5>
                                <CodeSnippet code={snippet} theme="light" />
                            </div>
                        ))}
                    </div>
                }
            />
        </div>
    )
}

const ApiAndCodeExamplesSection = (props: {
    downloadCtxBase: DataDownloadContextBase
    firstYColDef?: OwidColumnDef
}) => {
    const [onlyVisible, setOnlyVisible] = useState(false)
    const [shortColNames, setShortColNames] = useState(true)

    const exLongName = props.firstYColDef?.name
    const exShortName = props.firstYColDef?.shortName

    // Some charts, like pre-ETL ones or csv-based explorers, don't have short names available for their variables
    const shortNamesAvailable = !!exShortName

    const downloadCtx: DataDownloadContextServerSide = useMemo(
        () => ({
            ...props.downloadCtxBase,
            csvDownloadType: onlyVisible
                ? CsvDownloadType.CurrentSelection
                : CsvDownloadType.Full,
            shortColNames,
        }),
        [props.downloadCtxBase, onlyVisible, shortColNames]
    )

    const csvUrl = useMemo(
        () => getDownloadUrl("csv", downloadCtx),
        [downloadCtx]
    )
    const metadataUrl = useMemo(
        () => getDownloadUrl("metadata.json", downloadCtx),
        [downloadCtx]
    )

    return (
        <>
            <div className="downloads-section">
                <h4 className="citation__how-to-header">Data API</h4>
                <p className="citation__paragraph">
                    Use these URLs to programmatically access this chart's data
                    and configure your requests with the options below.{" "}
                    <a
                        className="reuse__link"
                        href="https://docs.owid.io/projects/etl/api/"
                        data-track-note="chart_download_modal_api_docs"
                    >
                        Our documentation provides more information
                    </a>{" "}
                    on how to use the API, and you can find a few code examples
                    below.
                </p>

                <section className="downloads__config-list">
                    <RadioButton
                        label="Download full data, including all entities and time points"
                        group="onlyVisible"
                        checked={!onlyVisible}
                        onChange={() => setOnlyVisible(false)}
                    />
                    <RadioButton
                        label="Download only the currently selected data visible in the chart"
                        group="onlyVisible"
                        checked={onlyVisible}
                        onChange={() => setOnlyVisible(true)}
                    />
                </section>
                {shortNamesAvailable && (
                    <section className="downloads__config-list">
                        <div>
                            <RadioButton
                                label="Long column names"
                                group="shortColNames"
                                checked={!shortColNames}
                                onChange={() => setShortColNames(false)}
                            />
                            <p>
                                e.g. <code>{exLongName}</code>
                            </p>
                        </div>
                        <div>
                            <RadioButton
                                label="Shortened column names"
                                group="shortColNames"
                                checked={shortColNames}
                                onChange={() => setShortColNames(true)}
                            />
                            <p>
                                e.g.{" "}
                                <code style={{ wordBreak: "break-all" }}>
                                    {exShortName}
                                </code>
                            </p>
                        </div>
                    </section>
                )}
                <section className="downloads__api-urls">
                    <div>
                        <h5 className="downloads__code-label">
                            Data URL (CSV format)
                        </h5>
                        <CodeSnippet code={csvUrl} theme="light" />
                    </div>
                    <div>
                        <h5 className="downloads__code-label">
                            Metadata URL (JSON format)
                        </h5>
                        <CodeSnippet code={metadataUrl} theme="light" />
                    </div>
                </section>
            </div>
            <CodeExamplesBlock csvUrl={csvUrl} metadataUrl={metadataUrl} />
        </>
    )
}

/**
 * Props for the Download section in MetadataSection.
 *
 * To enable download functionality on a data page, pass these props to MetadataSection.
 * Only displaySlug is required; other props enable additional features:
 * - inputTable/transformedTable/tableForDisplay: Enable client-side CSV generation
 * - yColumns: Show column name examples in API section
 * - baseUrl/queryStr: Customize download URLs
 * - isServerSideDownloadAvailable: Use server-side downloads (default: true)
 */
export interface DownloadSectionProps {
    displaySlug: string
    baseUrl?: string
    queryStr?: string
    externalQueryParams?: Record<string, string>
    inputTable?: OwidTable
    transformedTable?: OwidTable
    tableForDisplay?: OwidTable
    yColumns?: CoreColumn[]
    activeColumnSlugs?: string[]
    isOnTableTab?: boolean
    isServerSideDownloadAvailable?: boolean
}

const DownloadSection = (props: DownloadSectionProps) => {
    const { yColumns } = props

    const { cols: nonRedistributableCols } = getNonRedistributableInfo(
        props.inputTable
    )

    // Server-side download is not necessarily available for all types of charts
    const serverSideDownloadAvailable =
        props.isServerSideDownloadAvailable ?? true

    const downloadCtx: Omit<
        DataDownloadContextClientSide,
        "csvDownloadType" | "shortColNames"
    > = useMemo(() => {
        const externalSearchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(
            props.externalQueryParams ?? {}
        )) {
            if (value) {
                externalSearchParams.set(key, value)
            }
        }
        return {
            slug: props.displaySlug,
            searchParams: new URLSearchParams(props.queryStr),
            externalSearchParams,
            baseUrl: props.baseUrl ?? `/grapher/${props.displaySlug}`,

            fullTable: props.inputTable ?? BlankOwidTable(),
            filteredTable:
                (props.isOnTableTab
                    ? props.tableForDisplay
                    : props.transformedTable) ?? BlankOwidTable(),
            activeColumnSlugs: props.activeColumnSlugs,
        }
    }, [
        props.baseUrl,
        props.displaySlug,
        props.queryStr,
        props.externalQueryParams,
        props.isOnTableTab,
        props.inputTable,
        props.transformedTable,
        props.tableForDisplay,
        props.activeColumnSlugs,
    ])

    const onDownloadClick = useCallback(
        (csvDownloadType: CsvDownloadType) => {
            const ctx = {
                ...downloadCtx,
                csvDownloadType,
                shortColNames: false,
            }
            if (serverSideDownloadAvailable) {
                const fullOrFiltered =
                    csvDownloadType === CsvDownloadType.Full ? "" : ".filtered"
                triggerDownloadFromUrl(
                    ctx.slug + fullOrFiltered + ".zip",
                    getDownloadUrl("zip", ctx)
                )
            } else {
                void createCsvBlobLocally(ctx).then((blob) => {
                    triggerDownloadFromBlob(ctx.slug + ".csv", blob)
                })
            }
        },
        [downloadCtx, serverSideDownloadAvailable]
    )

    if (nonRedistributableCols?.length) {
        return null // Don't show download section if data is not redistributable
    }

    const downloadHelpText = serverSideDownloadAvailable ? (
        <p className="citation__paragraph">
            Download the data shown in this chart as a ZIP file containing a CSV
            file, metadata in JSON format, and a README. The CSV file can be
            opened in Excel, Google Sheets, and other data analysis tools.
        </p>
    ) : (
        <p className="citation__paragraph">
            Download the data used to create this chart. The data is provided in
            CSV format, which can be opened in Excel, Google Sheets, and other
            data analysis tools.
        </p>
    )

    const firstYColDef = yColumns?.[0]?.def as OwidColumnDef | undefined

    return (
        <div className="downloads grid span-cols-12">
            <h3
                className="downloads__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                id="download"
            >
                Download
            </h3>
            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                <div className="downloads-section">
                    <h4 className="citation__how-to-header">Quick download</h4>
                    {downloadHelpText}
                    <div className="downloads__buttons">
                        <DownloadButton
                            title="Download full data"
                            description="Includes all entities and time points."
                            icon={<DownloadIconFullDataset />}
                            onClick={() =>
                                onDownloadClick(CsvDownloadType.Full)
                            }
                            tracking={
                                "datapage_download_full_data--" +
                                (serverSideDownloadAvailable
                                    ? "server"
                                    : "client")
                            }
                        />
                        <DownloadButton
                            title="Download displayed data"
                            description="Includes only the entities and time points currently visible in the chart."
                            icon={<DownloadIconSelected />}
                            onClick={() =>
                                onDownloadClick(
                                    CsvDownloadType.CurrentSelection
                                )
                            }
                            tracking={
                                "datapage_download_filtered_data--" +
                                (serverSideDownloadAvailable
                                    ? "server"
                                    : "client")
                            }
                        />
                    </div>
                </div>
                {serverSideDownloadAvailable && (
                    <ApiAndCodeExamplesSection
                        downloadCtxBase={downloadCtx}
                        firstYColDef={firstYColDef}
                    />
                )}
            </div>
        </div>
    )
}

export default function MetadataSection({
    attributionShort,
    attributions,
    canonicalUrl,
    descriptionProcessing,
    faqEntries,
    origins,
    owidProcessingLevel,
    primaryTopic,
    source,
    title,
    titleVariant,
    archivedChartInfo,
    downloadProps,
}: {
    attributionShort?: string
    attributions: string[]
    canonicalUrl: string
    descriptionProcessing?: string
    faqEntries?: FaqEntryData
    origins: OwidOrigin[]
    owidProcessingLevel?: OwidProcessingLevel
    primaryTopic?: PrimaryTopic
    source?: OwidSource
    title: IndicatorTitleWithFragments
    titleVariant?: string
    archivedChartInfo?: ArchiveContext
    downloadProps?: DownloadSectionProps
}) {
    const sourcesForDisplay = prepareSourcesForDisplay({ origins, source })
    const citationUrl = archivedChartInfo?.archiveUrl ?? canonicalUrl
    const citationShort = getCitationShort(
        origins,
        attributions,
        owidProcessingLevel
    )
    const citationLong = getCitationLong(
        title,
        origins,
        source,
        attributions,
        attributionShort,
        titleVariant,
        owidProcessingLevel,
        citationUrl,
        archivedChartInfo?.archivalDate
    )
    const currentYear = dayjs().year()
    const producers = _.uniq(origins.map((o) => `${o.producer}`))
    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : source?.name

    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`

    // For the citation of the data page add a period it doesn't have that or a question mark
    const primaryTopicCitation = maybeAddPeriod(primaryTopic?.citation ?? "")
    const archivalString = getPhraseForArchivalDate(
        archivedChartInfo?.archivalDate
    )
    const citationDatapage = excludeUndefined([
        primaryTopic
            ? `“Data Page: ${title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${citationUrl} [online resource]${
            archivalString ? ` ${archivalString}` : ""
        }`,
    ]).join(" ")
    return (
        <div className="MetadataSection span-cols-14 grid grid-cols-12-full-width">
            <div className="col-start-2 span-cols-12">
                {!!faqEntries?.faqs.length && (
                    <div className="section-wrapper section-wrapper__faqs grid">
                        <h2
                            className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                            id="faqs"
                        >
                            Frequently Asked Questions
                        </h2>
                        <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                            <ArticleBlocks
                                blocks={faqEntries.faqs}
                                containerType="datapage"
                            />
                        </div>
                    </div>
                )}
                <div className="section-wrapper grid">
                    <h2
                        className="data-sources-processing__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id={DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}
                    >
                        Sources and processing
                    </h2>
                    <div className="data-sources grid span-cols-12">
                        <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            This data is based on the following sources
                        </h3>
                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            <IndicatorSources sources={sourcesForDisplay} />
                        </div>
                    </div>
                    <div className="data-processing grid span-cols-12">
                        <h3 className="data-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            How we process data at Our World in Data
                        </h3>
                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                            <IndicatorProcessing
                                descriptionProcessing={descriptionProcessing}
                            />
                        </div>
                    </div>
                </div>
                <div className="section-wrapper grid">
                    <h2
                        className="reuse__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                        id="reuse-this-work"
                    >
                        Reuse this work
                    </h2>
                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                        <ul className="reuse__content">
                            <li className="reuse__list-item">
                                All data produced by third-party providers and
                                made available by Our World in Data are subject
                                to the license terms from the original
                                providers. Our work would not be possible
                                without the data providers we rely on, so we ask
                                you to always cite them appropriately (see
                                below). This is crucial to allow data providers
                                to continue doing their work, enhancing,
                                maintaining and updating valuable data.
                            </li>
                            <li className="reuse__list-item">
                                All data, visualizations, and code produced by
                                Our World in Data are completely open access
                                under the{" "}
                                <a
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                    target="_blank"
                                    rel="noopener"
                                    className="reuse__link"
                                >
                                    Creative Commons BY license
                                </a>
                                . You have the permission to use, distribute,
                                and reproduce these in any medium, provided the
                                source and authors are credited.
                            </li>
                        </ul>
                    </div>

                    {(citationShort || citationLong || citationDatapage) && (
                        <div className="citations grid span-cols-12">
                            <h3 className="citations__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                Citations
                            </h3>
                            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                {citationDatapage && (
                                    <div className="citations-section">
                                        <h4 className="citation__how-to-header">
                                            How to cite this page
                                        </h4>
                                        <p className="citation__paragraph">
                                            To cite this page overall, including
                                            any descriptions, FAQs or
                                            explanations of the data authored by
                                            Our World in Data, please use the
                                            following citation:
                                        </p>
                                        <CodeSnippet
                                            code={citationDatapage}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    </div>
                                )}
                                <div className="citations-section">
                                    <h4 className="citation__how-to-header citation__how-to-header--data">
                                        How to cite this data
                                    </h4>
                                    {(citationShort || citationLong) && (
                                        <DataCitation
                                            citationLong={citationLong}
                                            citationShort={citationShort}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {downloadProps && <DownloadSection {...downloadProps} />}
                </div>
            </div>
        </div>
    )
}
