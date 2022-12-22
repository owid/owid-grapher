import React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "@ourworldindata/utils"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import {
    BlankOwidTable,
    OwidTable,
    OwidColumnDef,
    CoreColumn,
} from "@ourworldindata/core-table"
import {
    isEmpty,
    triggerDownloadFromBlob,
    triggerDownloadFromUrl,
} from "@ourworldindata/utils"
import { MarkdownTextWrap, sumTextWrapHeights } from "../text/MarkdownTextWrap"
import { STATIC_EXPORT_DETAIL_SPACING } from "../core/GrapherConstants"

export interface DownloadTabManager {
    idealBounds?: Bounds
    staticSVG: string
    displaySlug: string
    baseUrl?: string
    queryStr?: string
    table?: OwidTable
    externalCsvLink?: string // Todo: we can ditch this once rootTable === externalCsv (currently not quite the case for Covid Explorer)
    shouldIncludeDetailsInStaticExport?: boolean
    detailRenderers: MarkdownTextWrap[]
}

interface DownloadTabProps {
    bounds?: Bounds
    manager: DownloadTabManager
}

const polyfillToBlob = (): void => {
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Polyfill
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
        value: function (
            callback: (blob: Blob) => void,
            type: string,
            quality: any
        ) {
            const binStr = atob(
                (this as HTMLCanvasElement)
                    .toDataURL(type, quality)
                    .split(",")[1]
            )
            const len = binStr.length
            const arr = new Uint8Array(len)

            for (let i = 0; i < len; i++) {
                arr[i] = binStr.charCodeAt(i)
            }

            callback(new Blob([arr], { type: type || "image/png" }))
        },
    })
}

@observer
export class DownloadTab extends React.Component<DownloadTabProps> {
    @computed private get idealBounds(): Bounds {
        return this.manager.idealBounds ?? DEFAULT_BOUNDS
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get targetWidth(): number {
        return this.idealBounds.width
    }
    @computed private get targetHeight(): number {
        if (this.manager.shouldIncludeDetailsInStaticExport) {
            return (
                this.idealBounds.height +
                sumTextWrapHeights(
                    this.manager.detailRenderers,
                    STATIC_EXPORT_DETAIL_SPACING
                )
            )
        }
        return this.idealBounds.height
    }

    @computed private get manager(): DownloadTabManager {
        return this.props.manager
    }

    @observable private svgBlob?: Blob
    @observable private svgPreviewUrl?: string

    @observable private pngBlob?: Blob
    @observable private pngPreviewUrl?: string

    @observable private isReady: boolean = false

    @action.bound private export(): void {
        if (!HTMLCanvasElement.prototype.toBlob) polyfillToBlob()
        this.createSvg()
        const reader = new FileReader()
        reader.onload = (ev: any): void => {
            this.svgPreviewUrl = ev.target.result as string
            this.tryCreatePng(this.svgPreviewUrl)
        }
        reader.readAsDataURL(this.svgBlob as Blob)
    }

    @action.bound private createSvg(): void {
        const staticSVG = this.manager.staticSVG
        this.svgBlob = new Blob([staticSVG], {
            type: "image/svg+xml;charset=utf-8",
        })
    }

    @action.bound private tryCreatePng(svgPreviewUrl: string): void {
        const { targetWidth, targetHeight } = this
        // Client-side SVG => PNG export. Somewhat experimental, so there's a lot of cross-browser fiddling and fallbacks here.
        const img = new Image()
        img.onload = (): void => {
            try {
                const canvas = document.createElement("canvas")
                // We draw the chart at 4x res then scale it down again -- much better text quality
                canvas.width = targetWidth * 4
                canvas.height = targetHeight * 4
                const ctx = canvas.getContext("2d", {
                    alpha: false,
                }) as CanvasRenderingContext2D
                ctx.imageSmoothingEnabled = false
                ctx.setTransform(4, 0, 0, 4, 0, 0)
                ctx.drawImage(img, 0, 0)
                this.pngPreviewUrl = canvas.toDataURL("image/png")
                canvas.toBlob((blob) => {
                    this.pngBlob = blob ?? undefined
                    this.markAsReady()
                })
            } catch (e) {
                console.error(e)
                this.markAsReady()
            }
        }
        img.onerror = (err): void => {
            console.error(JSON.stringify(err))
            this.markAsReady()
        }
        img.src = svgPreviewUrl
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
        return def?.sourceLink
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

    private renderReady(): JSX.Element {
        const { targetWidth, targetHeight, svgPreviewUrl, bounds } = this

        const pngPreviewUrl = this.pngPreviewUrl || this.fallbackPngUrl

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.17
        if (bounds.width / bounds.height > targetWidth / targetHeight) {
            previewHeight = bounds.height * boundScalar
            previewWidth = (targetWidth / targetHeight) * previewHeight
        } else {
            previewWidth = bounds.width * boundScalar
            previewHeight = (targetHeight / targetWidth) * previewWidth
        }

        const imgStyle = {
            minWidth: previewWidth,
            minHeight: previewHeight,
            maxWidth: previewWidth,
            maxHeight: previewHeight,
            opacity: this.isReady ? 1 : 0,
        }

        return (
            <div className="grouped-menu">
                <div className="grouped-menu-section">
                    <h2>Chart</h2>
                    <div className="grouped-menu-list">
                        <button
                            className="grouped-menu-item"
                            onClick={this.onPngDownload}
                            data-track-note="chart-download-png"
                        >
                            <div className="grouped-menu-icon">
                                <img src={pngPreviewUrl} style={imgStyle} />
                            </div>
                            <div className="grouped-menu-content">
                                <h3 className="title">
                                    Image <span className="faint">(PNG)</span>
                                </h3>
                                <p className="description">
                                    Suitable for most uses, widely compatible.
                                </p>
                            </div>
                            <div className="grouped-menu-icon">
                                <span className="download-icon">
                                    <FontAwesomeIcon icon={faDownload} />
                                </span>
                            </div>
                        </button>
                        <button
                            className="grouped-menu-item"
                            onClick={this.onSvgDownload}
                            data-track-note="chart-download-svg"
                        >
                            <div className="grouped-menu-icon">
                                <img src={svgPreviewUrl} style={imgStyle} />
                            </div>
                            <div className="grouped-menu-content">
                                <h3 className="title">
                                    Vector graphic{" "}
                                    <span className="faint">(SVG)</span>
                                </h3>
                                <p className="description">
                                    For high quality prints, or further editing
                                    the chart in graphics software.
                                </p>
                            </div>
                            <div className="grouped-menu-icon">
                                <span className="download-icon">
                                    <FontAwesomeIcon icon={faDownload} />
                                </span>
                            </div>
                        </button>
                    </div>
                    {!isEmpty(this.manager.detailRenderers) && (
                        <div className="static-exports-options">
                            <input
                                type="checkbox"
                                id="shouldIncludeDetailsInStaticExport"
                                name="shouldIncludeDetailsInStaticExport"
                                onChange={(): void => {
                                    this.isReady = false
                                    this.manager.shouldIncludeDetailsInStaticExport =
                                        !this.manager
                                            .shouldIncludeDetailsInStaticExport
                                    this.export()
                                }}
                                checked={
                                    this.manager
                                        .shouldIncludeDetailsInStaticExport
                                }
                            />
                            <label htmlFor="shouldIncludeDetailsInStaticExport">
                                Include terminology definitions at bottom of
                                chart
                            </label>
                        </div>
                    )}
                </div>

                <div className="grouped-menu-section">
                    <h2>Data</h2>
                    {this.nonRedistributable ? (
                        <div className="grouped-menu-callout danger">
                            <div className="grouped-menu-callout-icon">
                                <FontAwesomeIcon icon={faInfoCircle} />
                            </div>
                            <div className="grouped-menu-callout-content">
                                <h3 className="title">
                                    The data in this chart is not available to
                                    download
                                </h3>
                                <p>
                                    The data is published under a license that
                                    doesn't allow us to redistribute it.
                                </p>
                                {this.nonRedistributableSourceLink && (
                                    <p>
                                        Please visit the{" "}
                                        <a
                                            href={
                                                this
                                                    .nonRedistributableSourceLink
                                            }
                                        >
                                            <strong>
                                                data publisher's website
                                            </strong>
                                        </a>{" "}
                                        for more details.
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grouped-menu-list">
                            <button
                                className="grouped-menu-item"
                                onClick={this.onCsvDownload}
                                data-track-note="chart-download-csv"
                            >
                                <div className="grouped-menu-content">
                                    <h3 className="title">
                                        Full data{" "}
                                        <span className="faint">(CSV)</span>
                                    </h3>
                                    <p className="description">
                                        The full dataset used in this chart.
                                    </p>
                                </div>
                                <div className="grouped-menu-icon">
                                    <span className="download-icon">
                                        <FontAwesomeIcon icon={faDownload} />
                                    </span>
                                </div>
                            </button>
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
            <div
                className="DownloadTab"
                style={{ ...this.bounds.toCSS(), position: "absolute" }}
            >
                {this.isReady ? (
                    this.renderReady()
                ) : (
                    <LoadingIndicator color="#000" />
                )}
            </div>
        )
    }
}
