import { isMobile } from "../../clientUtils/Util"
import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import classNames from "classnames"
import { BlankOwidTable, OwidTable } from "../../coreTable/OwidTable"

export interface DownloadTabManager {
    idealBounds?: Bounds
    staticSVG: string
    displaySlug: string
    baseUrl?: string
    queryStr?: string
    table?: OwidTable
    externalCsvLink?: string // Todo: we can ditch this once rootTable === externalCsv (currently not quite the case for Covid Explorer)
}

interface DownloadTabProps {
    bounds?: Bounds
    manager: DownloadTabManager
}

declare let Blob: any

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

// Wrapped because JSDOM does not support this method yet:
// https://stackoverflow.com/questions/52968969/jest-url-createobjecturl-is-not-a-function/56643520#56643520
const createObjectURL = (obj: any): string =>
    URL.createObjectURL ? URL.createObjectURL(obj) : ""

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
        return this.idealBounds.height
    }

    @computed private get manager(): DownloadTabManager {
        return this.props.manager
    }

    @observable private svgBlob?: Blob
    @observable private svgDownloadUrl?: string
    @observable private svgPreviewUrl?: string
    @observable private pngBlob?: Blob
    @observable private pngDownloadUrl?: string
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
        this.svgDownloadUrl = createObjectURL(this.svgBlob)
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
                    this.pngBlob = blob as Blob
                    this.pngDownloadUrl = createObjectURL(blob)
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

    @action.bound private markAsReady(): void {
        this.isReady = true
    }

    @computed private get fallbackPngUrl(): string {
        return `${this.manager.baseUrl || ""}.png${this.manager.queryStr || ""}`
    }
    @computed private get baseFilename(): string {
        return this.manager.displaySlug
    }

    @action.bound private onPNGDownload(
        ev: React.MouseEvent<HTMLAnchorElement>
    ): void {
        // TODO: here and below - msSaveBlob seems to be a legacy IE11 construct - remove in favour of createElement solution
        // further down? Typescript 4.4 removed this from window.navigator which is why we cast to any here...
        if ((window.navigator as any).msSaveBlob) {
            ;(window.navigator as any).msSaveBlob(
                this.pngBlob,
                this.baseFilename + ".png"
            )
            ev.preventDefault()
        }
    }

    @action.bound private onSVGDownload(
        ev: React.MouseEvent<HTMLAnchorElement>
    ): void {
        if (!(window.navigator as any).msSaveBlob) return

        ;(window.navigator as any).msSaveBlob(
            this.svgBlob,
            this.baseFilename + ".svg"
        )
        ev.preventDefault()
    }

    @computed private get inputTable(): OwidTable {
        return this.manager.table ?? BlankOwidTable()
    }

    private onCsvDownload(ev: React.MouseEvent<HTMLAnchorElement>): void {
        const { manager, inputTable } = this
        const csvFilename = manager.displaySlug + ".csv"
        const csv = inputTable.toPrettyCsv() || ""

        // IE11 compatibility
        if ((window.navigator as any).msSaveBlob) {
            ;(window.navigator as any).msSaveBlob(
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

    @computed private get csvButton(): JSX.Element {
        const { manager } = this
        const externalCsvLink = manager.externalCsvLink
        const csvFilename = manager.displaySlug + ".csv"
        const props = externalCsvLink
            ? {
                  href: externalCsvLink,
                  download: csvFilename,
              }
            : {
                  onClick: (ev: React.MouseEvent<HTMLAnchorElement>): void =>
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

    private renderReady(): JSX.Element {
        const {
            targetWidth,
            targetHeight,
            svgPreviewUrl,
            svgDownloadUrl,
            baseFilename,
            bounds,
        } = this

        const pngPreviewUrl = this.pngPreviewUrl || this.fallbackPngUrl
        const pngDownloadUrl = this.pngDownloadUrl || pngPreviewUrl

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

    componentDidMount(): void {
        this.export()
    }

    componentWillUnmount(): void {
        if (this.pngDownloadUrl !== undefined)
            URL.revokeObjectURL(this.pngDownloadUrl)
        if (this.svgDownloadUrl !== undefined)
            URL.revokeObjectURL(this.svgDownloadUrl)
    }

    render(): JSX.Element {
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
