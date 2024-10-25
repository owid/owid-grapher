import React, { useCallback, useMemo, useState } from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    getOriginAttributionFragments,
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
    ExpandableToggle,
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
    externalCsvLink?: string // TODO: do we want to drop this feature?
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
        <Modal bounds={modalBounds} onDismiss={onDismiss}>
            <div
                className="download-modal-content"
                style={{ maxHeight: modalBounds.height }}
            >
                <OverlayHeader title="Download" onDismiss={onDismiss} />
                <div className="download-modal__tab-list">
                    <Tabs
                        variant="slim"
                        labels={[
                            { element: <>Visualization</> },
                            { element: <>Data</> },
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

interface DataDownloadContext {
    // Configurable options
    csvDownloadType: CsvDownloadType
    shortColNames: boolean

    slug: string
    searchParams: URLSearchParams
    baseUrl: string

    // Only needed for local CSV generation
    table: OwidTable
    transformedTable: OwidTable
}

const createCsvBlobLocally = async (ctx: DataDownloadContext) => {
    const csv =
        ctx.csvDownloadType === CsvDownloadType.Full
            ? ctx.table.toPrettyCsv(ctx.shortColNames)
            : ctx.transformedTable.toPrettyCsv(ctx.shortColNames)

    return new Blob([csv], { type: "text/csv;charset=utf-8" })
}

const getDownloadSearchParams = (ctx: DataDownloadContext) => {
    const searchParams = new URLSearchParams()
    if (ctx.shortColNames) searchParams.set("useColumnShortNames", "true")

    if (ctx.csvDownloadType === CsvDownloadType.CurrentSelection) {
        searchParams.set("csvType", "filtered")

        // Append all the current selection filters to the download URL, e.g.: ?time=2020&selection=~USA
        for (const [key, value] of ctx.searchParams.entries()) {
            searchParams.set(key, value)
        }
    }

    return searchParams
}

const getDownloadUrl = (
    extension: "csv" | "metadata.json" | "zip",
    ctx: DataDownloadContext
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
        R: `df <- read.csv("${props.csvUrl}")`,
    }

    return (
        <ExpandableToggle
            label="Code examples"
            alwaysVisibleDescription={
                <p className="grapher_label-1-regular">
                    Examples of how to load this data into different data
                    analysis tools.
                </p>
            }
            content={
                <>
                    <div className="data-modal__code-examples">
                        {Object.entries(code).map(([name, snippet]) => (
                            <div key={name}>
                                <h4 className="grapher_body-2-medium">
                                    {name}
                                </h4>
                                <CodeSnippet code={snippet} />
                            </div>
                        ))}
                    </div>
                </>
            }
        />
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

    return (
        <div className="download-modal__data-section">
            <h3 className="grapher_h3-semibold">Source and citation</h3>
            <Callout
                title="Data citation"
                icon={<FontAwesomeIcon icon={faInfoCircle} />}
            >
                Whenever you use this data, it is your responsibility to ensure
                to credit the original source and to verify that your use is
                permitted as per the source's license.
            </Callout>

            {sourceLinks.length > 0 && (
                <div className="download-modal__citation-guidance">
                    <strong>Data sources and citation guidance:</strong>{" "}
                    <ul className="download-modal__citation-guidance-list">
                        {sourceLinks}
                    </ul>
                </div>
            )}
        </div>
    )
}

export const DownloadModalDataTab = (props: DownloadModalProps) => {
    const { yColumnsFromDimensionsOrSlugsOrAuto: yColumns } = props.manager

    const [onlyVisible, setOnlyVisible] = useState(false)
    const [shortColNames, setShortColNames] = useState(false)

    const { cols: nonRedistributableCols, sourceLinks } =
        getNonRedistributableInfo(props.manager.table)

    // Server-side download is not necessarily available for:
    // - Explorers
    // - Mdims
    // - Charts authored/changed in the admin (incl. unpublished charts)
    const serverSideDownloadAvailable =
        !!props.manager.isPublished && window.admin === undefined

    const downloadCtx: DataDownloadContext = useMemo(
        (): DataDownloadContext => ({
            csvDownloadType: onlyVisible
                ? CsvDownloadType.CurrentSelection
                : CsvDownloadType.Full,
            shortColNames,

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
            onlyVisible,
            props.manager.baseUrl,
            props.manager.displaySlug,
            props.manager.queryStr,
            props.manager.table,
            props.manager.transformedTable,
            shortColNames,
        ]
    )

    const csvUrl = useMemo(
        () => getDownloadUrl("csv", downloadCtx),
        [downloadCtx]
    )
    const metadataUrl = useMemo(
        () => getDownloadUrl("metadata.json", downloadCtx),
        [downloadCtx]
    )

    const onCsvDownload = useCallback(() => {
        const csvFilename = downloadCtx.slug + ".csv"
        if (serverSideDownloadAvailable) {
            triggerDownloadFromUrl(
                csvFilename,
                getDownloadUrl("csv", downloadCtx)
            )
        } else {
            void createCsvBlobLocally(downloadCtx).then((blob) => {
                triggerDownloadFromBlob(csvFilename, blob)
            })
        }
    }, [downloadCtx, serverSideDownloadAvailable])

    const onZipDownload = useCallback(() => {
        const zipFilename = downloadCtx.slug + ".zip"
        if (serverSideDownloadAvailable) {
            triggerDownloadFromUrl(
                zipFilename,
                getDownloadUrl("zip", downloadCtx)
            )
        } else {
            console.error(
                "Server-side ZIP download not implemented for this chart"
            )
        }
    }, [downloadCtx, serverSideDownloadAvailable])

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

    const firstYColDef = yColumns?.[0]?.def as OwidColumnDef | undefined

    const exLongName = firstYColDef?.name
    const exShortName = firstYColDef?.shortName

    // Some charts, like pre-ETL ones or csv-based explorers, don't have short names available for their variables
    const shortNamesAvailable = !!exShortName

    return (
        <>
            <SourceAndCitationSection table={props.manager.table} />
            <div className="download-modal__data-section">
                <h3 className="grapher_h3-semibold">Download options</h3>
                <section className="download-modal__config-list">
                    <RadioButton
                        label="Download the full dataset used in this chart"
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
                                label="Verbose column names"
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
                                label="Short column names"
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
                <div>
                    {serverSideDownloadAvailable && (
                        <DownloadButton
                            title="Data and metadata (ZIP)"
                            description="Download the data CSV, metadata JSON, and a README file as a ZIP archive."
                            onClick={onZipDownload}
                            tracking="chart_download_zip"
                        />
                    )}
                    <DownloadButton
                        title="Data only (CSV)"
                        description="Download only the data in CSV format."
                        onClick={onCsvDownload}
                        tracking="chart_download_csv"
                    />
                </div>
            </div>

            {serverSideDownloadAvailable && (
                <div className="download-modal__data-section">
                    <CodeExamplesBlock
                        csvUrl={csvUrl}
                        metadataUrl={metadataUrl}
                    />
                </div>
            )}
        </>
    )
}

interface DownloadButtonProps {
    title: string
    description: string
    onClick: () => void
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
