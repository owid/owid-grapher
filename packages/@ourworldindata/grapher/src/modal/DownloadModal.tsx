import React, { useCallback, useMemo, useState } from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    getOriginAttributionFragments,
    getPhraseForProcessingLevel,
    isEmpty,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
    uniq,
    uniqBy,
    zip,
} from "@ourworldindata/utils"
import {
    Checkbox,
    CodeSnippet,
    OverlayHeader,
    RadioButton,
} from "@ourworldindata/components"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faCircleExclamation,
    faDownload,
    faInfoCircle,
} from "@fortawesome/free-solid-svg-icons"
import {
    OwidColumnDef,
    GrapherStaticFormat,
    OwidOrigin,
} from "@ourworldindata/types"
import {
    BlankOwidTable,
    OwidTable,
    CoreColumn,
} from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { GrapherExport } from "../captionedChart/StaticChartRasterizer.js"
import { Tabs } from "../tabs/Tabs.js"
import {
    DownloadIconFullDataset,
    DownloadIconSelected,
} from "./DownloadIcons.js"
import { match } from "ts-pattern"

export interface DownloadModalManager {
    displaySlug: string
    rasterize: (bounds?: Bounds) => Promise<GrapherExport>
    staticBounds?: Bounds
    staticBoundsWithDetails?: Bounds
    staticFormat?: GrapherStaticFormat
    baseUrl?: string
    queryStr?: string
    table?: OwidTable
    transformedTable?: OwidTable
    yColumnsFromDimensionsOrSlugsOrAuto?: CoreColumn[]
    shouldIncludeDetailsInStaticExport?: boolean
    detailsOrderedByReference?: string[]
    isDownloadModalOpen?: boolean
    frameBounds?: Bounds
    captionedChartBounds?: Bounds
    isOnChartOrMapTab?: boolean
    showAdminControls?: boolean
    isSocialMediaExport?: boolean
    isPublished?: boolean
}

interface DownloadModalProps {
    manager: DownloadModalManager
}

export const DownloadModal = (
    props: DownloadModalProps
): React.ReactElement => {
    const frameBounds = props.manager.frameBounds ?? DEFAULT_BOUNDS

    const modalBounds = useMemo(() => {
        const maxWidth = 640
        const padWidth = Math.max(16, (frameBounds.width - maxWidth) / 2)
        return frameBounds.padHeight(16).padWidth(padWidth)
    }, [frameBounds])

    const onDismiss = useCallback(
        () => (props.manager.isDownloadModalOpen = false),
        [props.manager]
    )

    const [activeTabIndex, setActiveTabIndex] = useState(0)

    const isVisTabActive = activeTabIndex === 0
    const isDataTabActive = activeTabIndex === 1

    return (
        <Modal bounds={modalBounds} onDismiss={onDismiss} alignVertical="top">
            <div
                className="download-modal-content"
                style={{ maxHeight: modalBounds.height }}
            >
                <OverlayHeader title="Download" onDismiss={onDismiss} />
                <div className="download-modal__tab-list">
                    <Tabs
                        variant="slim"
                        labels={[
                            {
                                element: <>Visualization</>,
                                buttonProps: {
                                    "data-track-note":
                                        "chart_download_modal_tab_visualization",
                                } as any,
                            },
                            {
                                element: <>Data</>,
                                buttonProps: {
                                    "data-track-note":
                                        "chart_download_modal_tab_data",
                                } as any,
                            },
                        ]}
                        activeIndex={activeTabIndex}
                        setActiveIndex={setActiveTabIndex}
                    />
                </div>

                {/* Tabs */}
                {/**
                 * We only hide the inactive tab with display: none and don't unmount it,
                 * so that the tab state (selected radio buttons, etc) is preserved
                 * when switching between tabs.
                 */}
                <div className="download-modal__tab-panel" role="tabpanel">
                    <div
                        className="download-modal__tab-content"
                        style={{ display: isVisTabActive ? undefined : "none" }}
                        role="tab"
                        aria-hidden={!isVisTabActive}
                    >
                        <DownloadModalVisTab {...props} />
                    </div>
                    <div
                        className="download-modal__tab-content"
                        style={{
                            display: isDataTabActive ? undefined : "none",
                        }}
                        role="tab"
                        aria-hidden={!isDataTabActive}
                    >
                        <DownloadModalDataTab {...props} />
                    </div>
                </div>
            </div>
        </Modal>
    )
}

@observer
export class DownloadModalVisTab extends React.Component<DownloadModalProps> {
    @computed private get staticBounds(): Bounds {
        return this.manager.staticBounds ?? DEFAULT_BOUNDS
    }

    @computed private get captionedChartBounds(): Bounds {
        return this.manager.captionedChartBounds ?? DEFAULT_BOUNDS
    }

    @computed private get isExportingSquare(): boolean {
        return this.manager.staticFormat === GrapherStaticFormat.square
    }

    @computed private get isSocialMediaExport(): boolean {
        return this.manager.isSocialMediaExport ?? false
    }

    @computed private get shouldIncludeDetails(): boolean {
        return !!this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get targetBounds(): Bounds {
        return this.manager.staticBoundsWithDetails ?? this.staticBounds
    }

    @computed private get targetWidth(): number {
        return this.targetBounds.width
    }

    @computed private get targetHeight(): number {
        return this.targetBounds.height
    }

    @computed private get manager(): DownloadModalManager {
        return this.props.manager
    }

    @observable private svgBlob?: Blob
    @observable private svgPreviewUrl?: string

    @observable private pngBlob?: Blob
    @observable private pngPreviewUrl?: string

    @observable private isReady: boolean = false

    @action.bound private export(): void {
        // render the graphic then cache data-urls for display & blobs for downloads
        this.manager
            .rasterize()
            .then(({ url, blob, svgUrl, svgBlob }) => {
                this.pngPreviewUrl = url
                this.pngBlob = blob
                this.svgPreviewUrl = svgUrl
                this.svgBlob = svgBlob
                this.markAsReady()
            })
            .catch((err) => {
                console.error(JSON.stringify(err))
                this.markAsReady()
            })
    }

    @action.bound private markAsReady(): void {
        this.isReady = true
    }

    @action.bound private reset(): void {
        this.isReady = false
    }

    @computed private get fallbackPngUrl(): string {
        return `${this.manager.baseUrl || ""}.png${this.manager.queryStr || ""}`
    }
    @computed private get baseFilename(): string {
        return this.manager.displaySlug
    }

    @action.bound private onPngDownload(): void {
        const filename = this.baseFilename + ".png"
        if (this.pngBlob) {
            triggerDownloadFromBlob(filename, this.pngBlob)
        } else {
            triggerDownloadFromUrl(filename, this.fallbackPngUrl)
        }
    }

    @action.bound private onSvgDownload(): void {
        const filename = this.baseFilename + ".svg"
        if (this.svgBlob) {
            triggerDownloadFromBlob(filename, this.svgBlob)
        }
    }

    @action.bound private toggleExportFormat(): void {
        this.manager.staticFormat = this.isExportingSquare
            ? GrapherStaticFormat.landscape
            : GrapherStaticFormat.square
    }

    @action.bound private toggleExportForUseInSocialMedia(): void {
        this.manager.isSocialMediaExport = !this.isSocialMediaExport
    }

    @action.bound private toggleIncludeDetails(): void {
        this.manager.shouldIncludeDetailsInStaticExport =
            !this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get hasDetails(): boolean {
        return !isEmpty(this.manager.detailsOrderedByReference)
    }

    @computed private get showExportControls(): boolean {
        return this.hasDetails || !!this.manager.showAdminControls
    }

    componentDidMount(): void {
        this.export()
    }

    render(): React.ReactElement {
        if (!this.isReady) return <LoadingIndicator color="#000" />

        const {
            manager,
            svgPreviewUrl,
            captionedChartBounds,
            targetWidth,
            targetHeight,
        } = this
        const pngPreviewUrl = this.pngPreviewUrl || this.fallbackPngUrl

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.17
        if (
            captionedChartBounds.width / captionedChartBounds.height >
            targetWidth / targetHeight
        ) {
            previewHeight = Math.min(
                72,
                captionedChartBounds.height * boundScalar
            )
            previewWidth = (targetWidth / targetHeight) * previewHeight
        } else {
            previewWidth = Math.min(
                102,
                captionedChartBounds.width * boundScalar
            )
            previewHeight = (targetHeight / targetWidth) * previewWidth
        }

        const imageStyle = {
            minWidth: previewWidth,
            minHeight: previewHeight,
            maxWidth: previewWidth,
            maxHeight: previewHeight,
            opacity: this.isReady ? 1 : 0,
        }

        return (
            <div>
                {manager.isOnChartOrMapTab ? (
                    <div className="download-modal__vis-section">
                        <div>
                            <DownloadButton
                                title="Image (PNG)"
                                description="Suitable for most uses, widely compatible."
                                previewImageUrl={pngPreviewUrl}
                                onClick={this.onPngDownload}
                                imageStyle={imageStyle}
                                tracking="chart_download_png"
                            />
                            <DownloadButton
                                title="Vector graphic (SVG)"
                                description="For high quality prints, or further editing the chart in graphics software."
                                previewImageUrl={svgPreviewUrl}
                                onClick={this.onSvgDownload}
                                imageStyle={imageStyle}
                                tracking="chart_download_svg"
                            />
                        </div>
                        {this.showExportControls && (
                            <>
                                {this.hasDetails && (
                                    <Checkbox
                                        checked={this.shouldIncludeDetails}
                                        label="Include terminology definitions at bottom of chart"
                                        onChange={(): void => {
                                            this.reset()
                                            this.toggleIncludeDetails()
                                            this.export()
                                        }}
                                    />
                                )}
                                {this.manager.showAdminControls && (
                                    <Checkbox
                                        checked={this.isExportingSquare}
                                        label="Square format"
                                        onChange={action((): void => {
                                            this.reset()
                                            this.toggleExportFormat()

                                            if (!this.isExportingSquare) {
                                                this.manager.isSocialMediaExport =
                                                    false
                                            }

                                            this.export()
                                        })}
                                    />
                                )}
                                {this.manager.showAdminControls && (
                                    <Checkbox
                                        checked={this.isSocialMediaExport}
                                        label="For use in social media (internal)"
                                        onChange={action((): void => {
                                            this.reset()
                                            this.toggleExportForUseInSocialMedia()

                                            // set reasonable defaults for social media exports
                                            if (this.isSocialMediaExport) {
                                                this.manager.staticFormat =
                                                    GrapherStaticFormat.square
                                                this.manager.shouldIncludeDetailsInStaticExport =
                                                    false
                                            }

                                            this.export()
                                        })}
                                    />
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <Callout
                        title="Chart can't currently be exported to image"
                        icon={<FontAwesomeIcon icon={faCircleExclamation} />}
                    >
                        Try switching to the "Chart" or "Map" tab to download a
                        static image of this chart.
                        <br />
                        You can also download the data used in this chart by
                        navigating to the "Data" tab.
                    </Callout>
                )}
            </div>
        )
    }
}

enum CsvDownloadType {
    Full = "full",
    CurrentSelection = "current_selection",
}

interface DataDownloadContextBase {
    slug: string
    searchParams: URLSearchParams
    baseUrl: string
}

interface DataDownloadContextServerSide extends DataDownloadContextBase {
    // Configurable options
    csvDownloadType: CsvDownloadType
    shortColNames: boolean
}

interface DataDownloadContextClientSide extends DataDownloadContextBase {
    // Configurable options
    csvDownloadType: CsvDownloadType
    shortColNames: boolean

    // Only needed for local CSV generation
    table: OwidTable
    transformedTable: OwidTable
}

const createCsvBlobLocally = async (ctx: DataDownloadContextClientSide) => {
    const csv =
        ctx.csvDownloadType === CsvDownloadType.Full
            ? ctx.table.toPrettyCsv(ctx.shortColNames)
            : ctx.transformedTable.toPrettyCsv(ctx.shortColNames)

    return new Blob([csv], { type: "text/csv;charset=utf-8" })
}

const getDownloadSearchParams = (ctx: DataDownloadContextServerSide) => {
    const searchParams = new URLSearchParams()
    searchParams.set("v", "1") // API versioning
    searchParams.set(
        "csvType",
        match(ctx.csvDownloadType)
            .with(CsvDownloadType.CurrentSelection, () => "filtered")
            .with(CsvDownloadType.Full, () => "full")
            .exhaustive()
    )
    searchParams.set("useColumnShortNames", ctx.shortColNames.toString())

    if (ctx.csvDownloadType === CsvDownloadType.CurrentSelection) {
        // Append all the current selection filters to the download URL, e.g.: ?time=2020&selection=~USA
        for (const [key, value] of ctx.searchParams.entries()) {
            searchParams.set(key, value)
        }
    }

    return searchParams
}

const getDownloadUrl = (
    extension: "csv" | "metadata.json" | "zip",
    ctx: DataDownloadContextServerSide
) => {
    const searchParams = getDownloadSearchParams(ctx)
    const searchStr = searchParams.toString().replaceAll("%7E", "~")
    return `${ctx.baseUrl}.${extension}` + (searchStr ? `?${searchStr}` : "")
}

export const getNonRedistributableInfo = (
    table: OwidTable | undefined
): { cols: CoreColumn[] | undefined; sourceLinks: string[] | undefined } => {
    if (!table) return { cols: undefined, sourceLinks: undefined }

    const nonRedistributableCols = table.columnsAsArray.filter(
        (col) => (col.def as OwidColumnDef).nonRedistributable
    )

    if (!nonRedistributableCols.length)
        return { cols: undefined, sourceLinks: undefined }

    const sourceLinks = nonRedistributableCols
        .map((col) => {
            const def = col.def as OwidColumnDef
            return def.sourceLink ?? def.origins?.[0]?.urlMain
        })
        .filter((link): link is string => !!link)

    return { cols: nonRedistributableCols, sourceLinks: uniq(sourceLinks) }
}

const CodeExamplesBlock = (props: { csvUrl: string; metadataUrl: string }) => {
    const code = {
        "Excel / Google Sheets": `=IMPORTDATA("${props.csvUrl}")`,
        "Python with Pandas": `import pandas as pd
import requests

# Fetch the data
df = pd.read_csv("${props.csvUrl}")

# Fetch the metadata
metadata = requests.get("${props.metadataUrl}").json()`,
        R: `library(jsonlite)

# Fetch the data
df <- read.csv("${props.csvUrl}")

# Fetch the metadata
metadata <- fromJSON("${props.metadataUrl}")`,
    }

    return (
        <div className="download-modal__data-section">
            <div className="download-modal__heading-with-caption">
                <h3 className="grapher_h3-semibold">Code examples</h3>
                <p className="grapher_label-2-regular">
                    Examples of how to load this data into different data
                    analysis tools.
                </p>
            </div>
            <div className="download-modal__code-blocks">
                {Object.entries(code).map(([name, snippet]) => (
                    <div key={name}>
                        <h4 className="grapher_body-2-medium">{name}</h4>
                        <CodeSnippet code={snippet} />
                    </div>
                ))}
            </div>
        </div>
    )
}

const SourceAndCitationSection = ({ table }: { table?: OwidTable }) => {
    // Sources can come either from origins (new format) or from the source field of the column (old format)
    const origins =
        table?.defs
            .flatMap((def) => def.origins ?? [])
            ?.filter((o) => o !== undefined) ?? []

    const otherSources =
        table?.columnsAsArray
            .map((col) => col.source)
            .filter((s) => s !== undefined && s.dataPublishedBy !== undefined)
            .map(
                (s): OwidOrigin => ({
                    producer: s.dataPublishedBy,
                    urlMain: s.link,
                })
            ) ?? []

    const originsUniq = uniqBy(
        [...origins, ...otherSources],
        (o) => o.urlMain ?? o.datePublished
    )

    const attributions = getOriginAttributionFragments(originsUniq)

    const sourceLinks = zip(attributions, originsUniq).map(
        ([attribution, origin]) => {
            const link = origin?.urlMain

            if (link)
                return (
                    <li key={link}>
                        <a href={link}>{attribution}</a>
                    </li>
                )
            else return <li key={attribution}>{attribution}</li>
        }
    )

    // Find the highest processing level of all columns
    const owidProcessingLevel = table?.columnsAsArray
        .map((col) => (col.def as OwidColumnDef).owidProcessingLevel)
        .reduce((prev, curr) => {
            if (prev === "major" || curr === "major") return "major" as const
            if (prev === "minor" || curr === "minor") return "minor" as const
            return undefined
        }, undefined)

    const sourceIsOwid =
        attributions.length === 1 &&
        attributions[0].toLowerCase() === "our world in data"
    const processingLevelPhrase = !sourceIsOwid
        ? getPhraseForProcessingLevel(owidProcessingLevel)
        : undefined
    const fullProcessingPhrase = processingLevelPhrase ? (
        <>
            {" "}
            – <i>{processingLevelPhrase} by Our World In Data</i>
        </>
    ) : undefined

    return (
        <div className="download-modal__data-section download-modal__sources">
            <h3 className="grapher_h3-semibold">Source and citation</h3>
            {sourceLinks.length > 0 && (
                <div className="download-modal__data-sources">
                    <strong>Data sources:</strong>{" "}
                    <ul className="download-modal__data-sources-list">
                        {sourceLinks}
                    </ul>
                    {fullProcessingPhrase}
                </div>
            )}
            <div>
                <strong>Citation guidance:</strong> Please credit all sources
                listed above. Data provided by third-party sources through Our
                World in Data remains subject to the original{" "}
                {sourceLinks.length === 1 ? "provider's" : "providers'"} license
                terms.
            </div>
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
            <div className="download-modal__data-section">
                <div className="download-modal__heading-with-caption">
                    <h3 className="grapher_h3-semibold">Data API</h3>
                    <p className="grapher_label-2-regular">
                        Use these URLs to programmatically access this chart's
                        data and configure your requests with the options below.{" "}
                        <a
                            href="https://docs.owid.io/projects/etl/api/"
                            data-track-note="chart_download_modal_api_docs"
                        >
                            Our documentation provides more information
                        </a>{" "}
                        on how to use the API, and you can find a few code
                        examples below.
                    </p>
                </div>

                <section className="download-modal__config-list">
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
                    <section className="download-modal__config-list">
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
                <section className="download-modal__api-urls">
                    <div>
                        <h4 className="grapher_body-2-medium">
                            Data URL (CSV format)
                        </h4>
                        <CodeSnippet code={csvUrl} />
                    </div>
                    <div>
                        <h4 className="grapher_body-2-medium">
                            Metadata URL (JSON format)
                        </h4>
                        <CodeSnippet code={metadataUrl} />
                    </div>
                </section>
            </div>

            <CodeExamplesBlock csvUrl={csvUrl} metadataUrl={metadataUrl} />
        </>
    )
}

export const DownloadModalDataTab = (props: DownloadModalProps) => {
    const { yColumnsFromDimensionsOrSlugsOrAuto: yColumns } = props.manager

    const { cols: nonRedistributableCols, sourceLinks } =
        getNonRedistributableInfo(props.manager.table)

    // Server-side download is not necessarily available for:
    // - Explorers
    // - Mdims
    // - Charts authored/changed in the admin (incl. unpublished charts)
    const serverSideDownloadAvailable =
        !!props.manager.isPublished && window.admin === undefined

    const downloadCtx: Omit<
        DataDownloadContextClientSide,
        "csvDownloadType" | "shortColNames"
    > = useMemo(
        () => ({
            slug: props.manager.displaySlug,
            searchParams: new URLSearchParams(props.manager.queryStr),
            baseUrl:
                props.manager.baseUrl ??
                `/grapher/${props.manager.displaySlug}`,

            table: props.manager.table ?? BlankOwidTable(),
            transformedTable:
                props.manager.transformedTable ?? BlankOwidTable(),
        }),
        [
            props.manager.baseUrl,
            props.manager.displaySlug,
            props.manager.queryStr,
            props.manager.table,
            props.manager.transformedTable,
        ]
    )

    const onDownloadClick = useCallback(
        (csvDownloadType: CsvDownloadType) => {
            const ctx = {
                ...downloadCtx,
                csvDownloadType,
                shortColNames: false,
            }
            if (serverSideDownloadAvailable) {
                triggerDownloadFromUrl(
                    ctx.slug + ".zip",
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
        return (
            <div>
                <Callout
                    title="The data in this chart is not available to download"
                    icon={<FontAwesomeIcon icon={faInfoCircle} />}
                >
                    The data is published under a license that doesn't allow us
                    to redistribute it.
                    {sourceLinks?.length && (
                        <>
                            {" "}
                            Please visit the
                            {sourceLinks.length > 1
                                ? " data publishers' websites "
                                : " data publisher's website "}
                            for more details:
                            <ul>
                                {sourceLinks.map((link, i) => (
                                    <li key={i}>
                                        <a
                                            href={link}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </Callout>
            </div>
        )
    }

    const downloadHelpText = serverSideDownloadAvailable ? (
        <p className="grapher_label-2-regular">
            Download the data shown in this chart as a ZIP file containing a CSV
            file, metadata in JSON format, and a README. The CSV file can be
            opened in Excel, Google Sheets, and other data analysis tools.
        </p>
    ) : (
        <p className="grapher_label-2-regular">
            Download the data used to create this chart. The data is provided in
            CSV format, which can be opened in Excel, Google Sheets, and other
            data analysis tools.
        </p>
    )

    const firstYColDef = yColumns?.[0]?.def as OwidColumnDef | undefined

    return (
        <>
            <SourceAndCitationSection table={props.manager.table} />
            <div className="download-modal__data-section">
                <div className="download-modal__heading-with-caption">
                    <h3 className="grapher_h3-semibold">Quick download</h3>
                    {downloadHelpText}
                </div>
                <div>
                    <DownloadButton
                        title="Download full data"
                        description="Includes all entities and time points."
                        icon={<DownloadIconFullDataset />}
                        onClick={() => onDownloadClick(CsvDownloadType.Full)}
                        tracking={
                            "chart_download_full_data--" +
                            serverSideDownloadAvailable
                                ? "server"
                                : "client"
                        }
                    />
                    <DownloadButton
                        title="Download displayed data"
                        description="Includes only the entities and time points currently visible in the chart."
                        icon={<DownloadIconSelected />}
                        onClick={() =>
                            onDownloadClick(CsvDownloadType.CurrentSelection)
                        }
                        tracking={
                            "chart_download_filtered_data--" +
                            serverSideDownloadAvailable
                                ? "server"
                                : "client"
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
        </>
    )
}

interface DownloadButtonProps {
    title: string
    description: string
    onClick: () => void
    icon?: React.ReactElement
    previewImageUrl?: string
    imageStyle?: React.CSSProperties
    tracking?: string
}

function DownloadButton(props: DownloadButtonProps): React.ReactElement {
    return (
        <button
            className="download-modal__download-button"
            onClick={props.onClick}
            data-track-note={props.tracking}
        >
            {props.icon && (
                <div className="download-modal__option-icon">{props.icon}</div>
            )}
            {props.previewImageUrl && (
                <div className="download-modal__download-preview-img">
                    <img src={props.previewImageUrl} style={props.imageStyle} />
                </div>
            )}
            <div className="download-modal__download-button-content">
                <h4 className="grapher_body-2-semibold">{props.title}</h4>
                <p className="grapher_label-1-regular download-modal__download-button-description">
                    {props.description}
                </p>
            </div>
            <div className="download-modal__download-icon">
                <FontAwesomeIcon icon={faDownload} />
            </div>
        </button>
    )
}

interface CalloutProps {
    title: React.ReactNode
    icon?: React.ReactElement
    children: React.ReactNode
}

function Callout(props: CalloutProps): React.ReactElement {
    return (
        <div className="download-modal__callout">
            {props.title && (
                <h4 className="title grapher_body-2-semibold">
                    {props.icon}
                    {props.title}
                </h4>
            )}
            <p className="grapher_label-2-regular grapher_light">
                {props.children}
            </p>
        </div>
    )
}
