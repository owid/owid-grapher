import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    isEmpty,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
} from "@ourworldindata/utils"
import { MarkdownTextWrap, Checkbox } from "@ourworldindata/components"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload, faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import {
    BlankOwidTable,
    OwidTable,
    OwidColumnDef,
    CoreColumn,
} from "@ourworldindata/core-table"
import { GrapherStaticFormat } from "../core/GrapherConstants"
import { Modal } from "./Modal"
import { GrapherExport } from "../captionedChart/StaticChartRasterizer.js"

export interface DownloadModalManager {
    displaySlug: string
    generateStaticSvg: (bounds: Bounds) => string
    rasterize: (bounds?: Bounds) => Promise<GrapherExport>
    staticBounds?: Bounds
    staticBoundsWithDetails?: (bounds?: Bounds) => Bounds
    staticFormat?: GrapherStaticFormat
    baseUrl?: string
    queryStr?: string
    table?: OwidTable
    externalCsvLink?: string // Todo: we can ditch this once rootTable === externalCsv (currently not quite the case for Covid Explorer)
    shouldIncludeDetailsInStaticExport?: boolean
    detailRenderers: (bounds?: Bounds) => MarkdownTextWrap[]
    isDownloadModalOpen?: boolean
    tabBounds?: Bounds
    isOnChartOrMapTab?: boolean
    framePaddingVertical?: number
    showAdminControls?: boolean
}

interface DownloadModalProps {
    manager: DownloadModalManager
}

@observer
export class DownloadModal extends React.Component<DownloadModalProps> {
    @computed private get staticBounds(): Bounds {
        return this.manager.staticBounds ?? DEFAULT_BOUNDS
    }

    @computed private get tabBounds(): Bounds {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get isExportingSquare(): boolean {
        return this.manager.staticFormat === GrapherStaticFormat.square
    }

    @computed private get shouldIncludeDetails(): boolean {
        return !!this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get modalBounds(): Bounds {
        const maxWidth = 640
        const padWidth = Math.max(16, (this.tabBounds.width - maxWidth) / 2)
        return this.tabBounds.padHeight(16).padWidth(padWidth)
    }

    @computed private get targetBounds(): Bounds {
        return (
            this.manager.staticBoundsWithDetails?.(this.staticBounds) ??
            this.staticBounds
        )
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
        const { staticBounds } = this

        // render the graphic then cache data-urls for display & blobs for downloads
        this.manager
            .rasterize(staticBounds)
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

    @computed private get csvBlob(): Blob {
        const csv = this.inputTable.toPrettyCsv()
        return new Blob([csv], {
            type: "text/csv;charset=utf-8",
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

    @computed private get inputTable(): OwidTable {
        return this.manager.table ?? BlankOwidTable()
    }

    @computed private get nonRedistributableColumn(): CoreColumn | undefined {
        return this.inputTable.columnsAsArray.find(
            (col) => (col.def as OwidColumnDef).nonRedistributable
        )
    }

    // Data downloads are fully disabled if _any_ variable used is non-redistributable.
    // In the future, we would probably like to drop only the columns that are
    // non-redistributable, and allow downloading the rest in the CSV.
    // -@danielgavrilov, 2021-11-16
    @computed private get nonRedistributable(): boolean {
        return this.nonRedistributableColumn !== undefined
    }

    // There could be multiple non-redistributable variables in the chart.
    // For now, we only pick the first one to populate the link.
    // In the future, we may need to change the phrasing of the download
    // notice and provide links to all publishers.
    // -@danielgavrilov, 2021-11-16
    @computed private get nonRedistributableSourceLink(): string | undefined {
        const def = this.nonRedistributableColumn?.def as
            | OwidColumnDef
            | undefined
        if (!def) return undefined
        return (
            def.sourceLink ??
            (def.origins && def.origins.length > 0
                ? def.origins[0].urlMain
                : undefined)
        )
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

    @action.bound private onCsvDownload(): void {
        const { manager, baseFilename } = this
        const filename = baseFilename + ".csv"
        if (manager.externalCsvLink) {
            triggerDownloadFromUrl(filename, manager.externalCsvLink)
        } else {
            triggerDownloadFromBlob(filename, this.csvBlob)
        }
    }

    @action.bound private toggleExportFormat(): void {
        this.manager.staticFormat = this.isExportingSquare
            ? GrapherStaticFormat.landscape
            : GrapherStaticFormat.square
    }

    @action.bound private toggleIncludeDetails(): void {
        this.manager.shouldIncludeDetailsInStaticExport =
            !this.manager.shouldIncludeDetailsInStaticExport
    }

    @computed private get detailRenderers(): MarkdownTextWrap[] {
        return this.manager.detailRenderers(this.staticBounds)
    }

    @computed private get showExportControls(): boolean {
        return (
            !isEmpty(this.detailRenderers) || !!this.manager.showAdminControls
        )
    }

    private renderReady(): JSX.Element {
        const { manager, svgPreviewUrl, tabBounds, targetWidth, targetHeight } =
            this
        const pngPreviewUrl = this.pngPreviewUrl || this.fallbackPngUrl

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.17
        if (tabBounds.width / tabBounds.height > targetWidth / targetHeight) {
            previewHeight = Math.min(72, tabBounds.height * boundScalar)
            previewWidth = (targetWidth / targetHeight) * previewHeight
        } else {
            previewWidth = Math.min(102, tabBounds.width * boundScalar)
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
            <div className="grouped-menu">
                {manager.isOnChartOrMapTab && (
                    <div className="grouped-menu-section">
                        <h2>Visualization</h2>
                        <div className="grouped-menu-list">
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
                            <div className="static-exports-options">
                                {!isEmpty(this.detailRenderers) && (
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
                                        onChange={(): void => {
                                            this.reset()
                                            this.toggleExportFormat()
                                            this.export()
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className="grouped-menu-section grouped-menu-section-data">
                    <h2>Data</h2>
                    {this.nonRedistributable ? (
                        <div className="grouped-menu-callout">
                            <div className="grouped-menu-callout-content">
                                <h3 className="title">
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                    The data in this chart is not available to
                                    download
                                </h3>
                                <p>
                                    The data is published under a license that
                                    doesn't allow us to redistribute it.
                                    {this.nonRedistributableSourceLink && (
                                        <>
                                            {" "}
                                            Please visit the{" "}
                                            <a
                                                href={
                                                    this
                                                        .nonRedistributableSourceLink
                                                }
                                            >
                                                data publisher's website
                                            </a>{" "}
                                            for more details.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grouped-menu-list">
                            <DownloadButton
                                title="Full data (CSV)"
                                description="The full dataset used in this chart."
                                onClick={this.onCsvDownload}
                                tracking="chart_download_csv"
                            />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    componentDidMount(): void {
        this.export()
    }

    render(): JSX.Element {
        return (
            <Modal
                title="Download"
                onDismiss={action(
                    () => (this.manager.isDownloadModalOpen = false)
                )}
                bounds={this.modalBounds}
            >
                <div className="DownloadModalContent">
                    {this.isReady ? (
                        this.renderReady()
                    ) : (
                        <LoadingIndicator color="#000" />
                    )}
                </div>
            </Modal>
        )
    }
}

interface DownloadButtonProps {
    title: string
    description: string
    onClick: () => void
    previewImageUrl?: string
    imageStyle?: React.CSSProperties
    tracking?: string
}

function DownloadButton(props: DownloadButtonProps): JSX.Element {
    return (
        <button
            className="grouped-menu-item"
            onClick={props.onClick}
            data-track-note={props.tracking}
        >
            {props.previewImageUrl && (
                <div className="grouped-menu-icon">
                    <img src={props.previewImageUrl} style={props.imageStyle} />
                </div>
            )}
            <div className="grouped-menu-content">
                <h3 className="title">{props.title}</h3>
                <p className="description">{props.description}</p>
            </div>
            <div className="grouped-menu-icon">
                <span className="download-icon">
                    <FontAwesomeIcon icon={faDownload} />
                </span>
            </div>
        </button>
    )
}
