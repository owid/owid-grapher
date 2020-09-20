import { isMobile } from "grapher/utils/Util"
import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import classNames from "classnames"
import { OwidTable } from "owidTable/OwidTable"

export interface DownloadTabOptionsProvider {
    idealBounds?: Bounds
    staticSVG?: string
    isExporting?: boolean
    displaySlug: string
    baseUrl?: string
    queryString?: string
    table?: OwidTable
    externalCsvLink?: string
}

interface DownloadTabProps {
    bounds?: Bounds
    options: DownloadTabOptionsProvider
}

declare var Blob: any

@observer
export class DownloadTab extends React.Component<DownloadTabProps> {
    @computed get idealBounds() {
        return this.options.idealBounds ?? DEFAULT_BOUNDS
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get targetWidth() {
        return this.idealBounds.width
    }
    @computed get targetHeight() {
        return this.idealBounds.height
    }

    @computed get options() {
        return this.props.options
    }

    @observable svgBlob?: Blob
    @observable svgBlobUrl?: string
    @observable svgDataUri?: string
    @observable pngBlob?: Blob
    @observable pngBlobUrl?: string
    @observable pngDataUri?: string
    @observable private isReady: boolean = false
    @action.bound export() {
        if (!HTMLCanvasElement.prototype.toBlob) {
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

        const { targetWidth, targetHeight } = this
        const { options } = this

        options.isExporting = true
        const staticSVG = options.staticSVG ?? ""
        options.isExporting = false

        this.svgBlob = new Blob([staticSVG], {
            type: "image/svg+xml;charset=utf-8",
        })
        this.svgBlobUrl = URL.createObjectURL(this.svgBlob)
        const reader = new FileReader()
        reader.onload = (ev: any) => {
            this.svgDataUri = ev.target.result as string
            // Client-side SVG => PNG export. Somewhat experimental, so there's a lot of cross-browser fiddling and fallbacks here.
            const img = new Image()
            img.onload = () => {
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
                    this.pngDataUri = canvas.toDataURL("image/png")
                    canvas.toBlob((blob) => {
                        this.pngBlob = blob as Blob
                        this.pngBlobUrl = URL.createObjectURL(blob)
                        this.markAsReady()
                    })
                } catch (e) {
                    console.error(e)
                    this.markAsReady()
                }
            }
            img.onerror = (err) => {
                console.error(JSON.stringify(err))
                this.markAsReady()
            }
            img.src = this.svgDataUri
        }
        reader.readAsDataURL(this.svgBlob as Blob)
    }

    @action.bound markAsReady() {
        this.isReady = true
    }

    @computed get fallbackPngUrl() {
        return `${this.options.baseUrl || ""}.png${
            this.options.queryString || ""
        }`
    }
    @computed get baseFilename() {
        return this.options.displaySlug
    }
    @computed get svgPreviewUrl() {
        return this.svgDataUri
    }
    @computed get pngPreviewUrl() {
        return this.pngDataUri || this.fallbackPngUrl
    }
    @computed get svgDownloadUrl() {
        return this.svgBlobUrl
    }
    @computed get pngDownloadUrl() {
        return this.pngBlobUrl || this.pngDataUri || this.fallbackPngUrl
    }

    @computed get isPortrait(): boolean {
        return this.bounds.height > this.bounds.width
    }

    @action.bound onPNGDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(
                this.pngBlob,
                this.baseFilename + ".png"
            )
            ev.preventDefault()
        }
    }

    @action.bound onSVGDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (!window.navigator.msSaveBlob) return

        window.navigator.msSaveBlob(this.svgBlob, this.baseFilename + ".svg")
        ev.preventDefault()
    }

    onCsvDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        const { options } = this
        const csvFilename = options.displaySlug + ".csv"
        const csv = options.table?.toView().toPrettyCsv() || ""

        // IE11 compatibility
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(
                new Blob([csv], { type: "text/csv" }),
                csvFilename
            )
            ev.preventDefault()
        } else {
            const downloadLink = document.createElement("a")
            downloadLink.setAttribute(
                "href",
                `data:text/csv,` + encodeURIComponent(csv)
            )
            downloadLink.setAttribute("download", csvFilename)
            downloadLink.click()
        }
    }

    @computed private get csvButton() {
        const { options } = this
        const externalCsvLink = options.externalCsvLink
        const csvFilename = options.displaySlug + ".csv"
        const props = externalCsvLink
            ? {
                  href: externalCsvLink,
                  download: csvFilename,
              }
            : {
                  onClick: (ev: React.MouseEvent<HTMLAnchorElement>) =>
                      this.onCsvDownload(ev),
              }

        return (
            <div className="download-csv" style={{ maxWidth: "100%" }}>
                <p>
                    Download a CSV file containing all data used in this
                    visualization:
                </p>
                <a
                    className="btn btn-primary"
                    data-track-note="chart-download-csv"
                    {...props}
                >
                    <FontAwesomeIcon icon={faDownload} /> {csvFilename}
                </a>
            </div>
        )
    }

    renderReady() {
        const {
            props,
            targetWidth,
            targetHeight,
            pngPreviewUrl,
            pngDownloadUrl,
            svgPreviewUrl,
            svgDownloadUrl,
            baseFilename,
            bounds,
        } = this

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.4
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
            border: "1px solid #ccc",
        }

        const asideStyle = {
            maxWidth: previewWidth,
        }

        return (
            <React.Fragment>
                <div className="img-downloads">
                    <a
                        key="png"
                        href={pngDownloadUrl}
                        download={baseFilename + ".png"}
                        data-track-note="chart-download-png"
                        onClick={this.onPNGDownload}
                    >
                        <div>
                            <img src={pngPreviewUrl} style={imgStyle} />
                            <aside style={asideStyle}>
                                <h2>Save as .png</h2>
                                <p>
                                    A standard image of the visualization that
                                    can be used in presentations or other
                                    documents.
                                </p>
                            </aside>
                        </div>
                    </a>
                    <a
                        key="svg"
                        href={svgDownloadUrl}
                        download={baseFilename + ".svg"}
                        data-track-note="chart-download-svg"
                        onClick={this.onSVGDownload}
                    >
                        <div>
                            <img src={svgPreviewUrl} style={imgStyle} />
                            <aside style={asideStyle}>
                                <h2>Save as .svg</h2>
                                <p>
                                    A vector format image useful for further
                                    redesigning the visualization with vector
                                    graphic software.
                                </p>
                            </aside>
                        </div>
                    </a>
                </div>
                {this.csvButton}
            </React.Fragment>
        )
    }

    componentDidMount() {
        this.export()
    }

    componentWillUnmount() {
        if (this.pngBlobUrl !== undefined) URL.revokeObjectURL(this.pngBlobUrl)
        if (this.svgBlobUrl !== undefined) URL.revokeObjectURL(this.svgBlobUrl)
    }

    render() {
        return (
            <div
                className={classNames("DownloadTab", {
                    mobile: isMobile(),
                })}
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
