import {
    DownloadApiOptions,
    DownloadButtonLink,
    ExpandableToggle,
    makeFilteredDownloadDescription,
    makeFullDownloadDescription,
    CodeSnippet,
    NonRedistributableDataNotice,
} from "@ourworldindata/components"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    CsvDownloadType,
    getDataDownloadFilename,
    getDownloadUrl,
    getNonRedistributableInfo,
    useDataApiDownloadConfig,
    type DataDownloadContextBase,
} from "@ourworldindata/grapher"
import {
    Distribution,
    ArchiveContext,
    OwidColumnDef,
} from "@ourworldindata/types"
import {
    makeDownloadCodeExamples,
    SERVER_SIDE_DOWNLOAD_HELP_TEXT,
} from "@ourworldindata/utils"

function ApiAndCodeExamplesSection({
    downloadCtxBase,
    firstYColDef,
}: {
    downloadCtxBase: DataDownloadContextBase
    firstYColDef?: OwidColumnDef
}) {
    const {
        csvUrl,
        metadataUrl,
        onlyVisible,
        setOnlyVisible,
        shortColNames,
        setShortColNames,
    } = useDataApiDownloadConfig({ downloadCtxBase, firstYColDef })
    const codeExamples = makeDownloadCodeExamples(csvUrl, metadataUrl)

    return (
        <>
            <div className="downloads-section">
                <h4 className="citation__how-to-header">Data API</h4>
                <p className="citation__paragraph">
                    Use these URLs to programmatically access this chart's data
                    and configure your requests with the options below.{" "}
                    <a
                        href="https://docs.owid.io/projects/etl/api/"
                        data-track-note="datapage_download_api_docs"
                    >
                        Our documentation provides more information
                    </a>{" "}
                    on how to use the API, and you can find a few code examples
                    below.
                </p>

                <DownloadApiOptions
                    onlyVisible={onlyVisible}
                    onOnlyVisibleChange={setOnlyVisible}
                    shortColNames={shortColNames}
                    onShortColNamesChange={setShortColNames}
                    firstYColDef={firstYColDef}
                />
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
            <div className="download-data-section downloads-section">
                <ExpandableToggle
                    label="Code examples"
                    alwaysVisibleDescription={
                        <p className="citation__paragraph">
                            Examples of how to load this data into different
                            data analysis tools.
                        </p>
                    }
                    content={
                        <div className="downloads__code-blocks">
                            {Object.entries(codeExamples).map(
                                ([name, snippet]) => (
                                    <div key={name}>
                                        <h5 className="downloads__code-label">
                                            {name}
                                        </h5>
                                        <CodeSnippet
                                            code={snippet}
                                            theme="light"
                                        />
                                    </div>
                                )
                            )}
                        </div>
                    }
                />
            </div>
        </>
    )
}

export type DownloadSectionProps = {
    slug: string
    baseUrl?: string
    searchParams?: URLSearchParams
    externalQueryParams?: Record<string, string>
    tableForDownload?: OwidTable
    filteredTableForDownload?: OwidTable
    yColumns?: CoreColumn[]
    archivedChartInfo?: ArchiveContext
    distribution?: Distribution
}

export default function DownloadSection({
    slug,
    baseUrl,
    searchParams,
    externalQueryParams,
    tableForDownload,
    filteredTableForDownload,
    yColumns,
    archivedChartInfo,
    distribution,
}: DownloadSectionProps) {
    const isOnArchivalPage = archivedChartInfo?.type === "archive-page"

    const {
        cols: nonRedistributableCols,
        sourceLinks: tableForDownloadSourceLinks,
    } = getNonRedistributableInfo(tableForDownload)

    const externalSearchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(externalQueryParams ?? {})) {
        if (value) {
            externalSearchParams.set(key, value)
        }
    }

    const downloadCtx: DataDownloadContextBase = {
        slug,
        searchParams: new URLSearchParams(searchParams),
        externalSearchParams,
        baseUrl: baseUrl ?? `/grapher/${slug}`,
    }

    const fullDownloadUrl = getDownloadUrl("zip", {
        ...downloadCtx,
        csvDownloadType: CsvDownloadType.Full,
        shortColNames: false,
    })

    const filteredDownloadUrl = getDownloadUrl("zip", {
        ...downloadCtx,
        csvDownloadType: CsvDownloadType.CurrentSelection,
        shortColNames: false,
    })

    const fullDownloadFilename = getDataDownloadFilename({
        slug,
        extension: "zip",
        csvDownloadType: CsvDownloadType.Full,
    })

    const filteredDownloadFilename = getDataDownloadFilename({
        slug,
        extension: "zip",
        csvDownloadType: CsvDownloadType.CurrentSelection,
    })

    let downloadVisUrl = ""
    if (isOnArchivalPage) {
        const overlaySearchParams = new URLSearchParams(searchParams)
        overlaySearchParams.set("overlay", "download-vis")
        downloadVisUrl = `?${overlaySearchParams.toString()}`
    }

    let downloadDataUrl = ""
    if (isOnArchivalPage) {
        const overlaySearchParams = new URLSearchParams(searchParams)
        overlaySearchParams.set("overlay", "download-data")
        downloadDataUrl = `?${overlaySearchParams.toString()}`
    }

    const firstYColDef = yColumns?.[0]?.def as OwidColumnDef | undefined
    const sourceLinksFromDistribution =
        distribution?.allowed === false ? distribution.sourceLinks : undefined
    const sourceLinks =
        tableForDownloadSourceLinks ?? sourceLinksFromDistribution ?? []
    const shouldShowNonRedistributableNotice =
        !!nonRedistributableCols?.length ||
        (!tableForDownload && distribution?.allowed === false)

    const fullDownloadDescription = makeFullDownloadDescription(
        tableForDownload?.numRows
    )
    const filteredDownloadDescription = makeFilteredDownloadDescription({
        numRows: filteredTableForDownload?.numRows,
    })

    return (
        <div className="downloads grid span-cols-12">
            <h3
                className="metadata-section__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                id="download"
            >
                Download
            </h3>
            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                {isOnArchivalPage ? (
                    <div className="downloads-section">
                        <h4 className="citation__how-to-header">
                            Quick download
                        </h4>
                        {shouldShowNonRedistributableNotice ? (
                            <>
                                <p className="citation__paragraph">
                                    You can download the{" "}
                                    <a
                                        href={downloadVisUrl}
                                        data-track-note="datapage_download_vis_link"
                                    >
                                        visualization
                                    </a>{" "}
                                    as an image.
                                </p>
                                <div className="citation__paragraph">
                                    <NonRedistributableDataNotice
                                        sourceLinks={sourceLinks}
                                        listClassName="metadata-list"
                                    />
                                </div>
                            </>
                        ) : (
                            <p className="citation__paragraph">
                                You can download the{" "}
                                <a
                                    href={downloadVisUrl}
                                    data-track-note="datapage_download_vis_link"
                                >
                                    visualization
                                </a>{" "}
                                as an image or download the chart{" "}
                                <a
                                    href={downloadDataUrl}
                                    data-track-note="datapage_download_data_link"
                                >
                                    data
                                </a>
                                .
                            </p>
                        )}
                    </div>
                ) : shouldShowNonRedistributableNotice ? (
                    <div className="downloads-section">
                        <h4 className="citation__how-to-header">
                            The data in this chart is not available to download
                        </h4>
                        <div className="citation__paragraph">
                            <NonRedistributableDataNotice
                                sourceLinks={sourceLinks}
                                listClassName="metadata-list"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="downloads-section">
                            <h4 className="citation__how-to-header">
                                Quick download
                            </h4>
                            <p className="citation__paragraph">
                                {SERVER_SIDE_DOWNLOAD_HELP_TEXT}
                            </p>
                            <div className="downloads__download-buttons">
                                <DownloadButtonLink
                                    title="Download full data"
                                    description={fullDownloadDescription}
                                    icon="full"
                                    trackingNote="datapage_download_full_data--server"
                                    href={fullDownloadUrl}
                                    download={fullDownloadFilename}
                                />
                                <DownloadButtonLink
                                    title="Download displayed data"
                                    description={filteredDownloadDescription}
                                    icon="selected"
                                    trackingNote="datapage_download_filtered_data--server"
                                    href={filteredDownloadUrl}
                                    download={filteredDownloadFilename}
                                />
                            </div>
                        </div>
                        <ApiAndCodeExamplesSection
                            downloadCtxBase={downloadCtx}
                            firstYColDef={firstYColDef}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
