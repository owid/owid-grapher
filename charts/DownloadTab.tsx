import {
    extend,
    sortBy,
    uniq,
    flatten,
    csvEscape,
    first,
    last,
    isMobile
} from "./Util"
import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { LoadingIndicator } from "site/client/LoadingIndicator"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import classNames from "classnames"

interface DownloadTabProps {
    bounds: Bounds
    chart: ChartConfig
}

declare var Blob: any

@observer
export class DownloadTab extends React.Component<DownloadTabProps> {
    @computed get targetWidth() {
        return this.props.chart.idealBounds.width
    }
    @computed get targetHeight() {
        return this.props.chart.idealBounds.height
    }

    @observable svgBlob?: Blob
    @observable svgBlobUrl?: string
    @observable svgDataUri?: string
    @observable pngBlob?: Blob
    @observable pngBlobUrl?: string
    @observable pngDataUri?: string
    @observable isReady: boolean = false
    @action.bound export() {
        if (!HTMLCanvasElement.prototype.toBlob) {
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Polyfill
            Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
                value: function(
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
                }
            })
        }

        const { targetWidth, targetHeight } = this
        const { chart } = this.props

        chart.isLocalExport = true
        const staticSVG = chart.staticSVG
        chart.isLocalExport = false

        this.svgBlob = new Blob([staticSVG], {
            type: "image/svg+xml;charset=utf-8"
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
                        alpha: false
                    }) as CanvasRenderingContext2D
                    ctx.imageSmoothingEnabled = false
                    ctx.setTransform(4, 0, 0, 4, 0, 0)
                    ctx.drawImage(img, 0, 0)
                    this.pngDataUri = canvas.toDataURL("image/png")
                    canvas.toBlob(blob => {
                        this.pngBlob = blob as Blob
                        this.pngBlobUrl = URL.createObjectURL(blob)
                        this.isReady = true
                    })
                } catch (e) {
                    console.error(e)
                    this.isReady = true
                }
            }
            img.onerror = err => {
                console.error(JSON.stringify(err))
                this.isReady = true
            }
            img.src = this.svgDataUri
        }
        reader.readAsDataURL(this.svgBlob as Blob)
    }

    @computed get fallbackPngUrl() {
        return `${this.props.chart.url.baseUrl}.png${this.props.chart.url.queryStr}`
    }
    @computed get baseFilename() {
        return this.props.chart.data.slug
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
        return this.props.bounds.height > this.props.bounds.width
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
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(
                this.svgBlob,
                this.baseFilename + ".svg"
            )
            ev.preventDefault()
        }
    }

    // Here's where the actual CSV is made
    @computed get csvBlob() {
        const { chart } = this.props
        const yearIsDayVar = chart.yearIsDayVar
        const dayIndexedCSV = yearIsDayVar ? true : false

        const dimensions = chart.data.filledDimensions.filter(
            d => d.property !== "color"
        )
        const uniqueEntitiesAcrossDimensions =
            chart.sortedUniqueEntitiesAcrossDimensions

        // only get days if chart has a day-indexed variable, else get years across dimensions
        const indexingYears = sortBy(
            dayIndexedCSV
                ? yearIsDayVar?.yearsUniq
                : uniq(flatten(dimensions.map(d => d.yearsUniq)))
        )

        const rows: string[] = []

        const titleRow = ["Entity", "Code", dayIndexedCSV ? "Date" : "Year"]

        dimensions.forEach(dim => {
            if (this.isFixedYearDimension(dim)) titleRow.push("Year")
            titleRow.push(csvEscape(dim.fullNameWithUnit))
        })
        rows.push(titleRow.join(","))

        uniqueEntitiesAcrossDimensions.forEach(entity => {
            indexingYears.forEach(year => {
                const row: (string | number)[] = [
                    entity,
                    chart.entityMetaByKey[entity].code ?? "",
                    chart.formatYearFunction(year)
                ]

                let rowHasSomeValue = false
                dimensions.forEach(dim => {
                    let value = null
                    if (this.isFixedYearDimension(dim)) {
                        const latestYearValue = dim.yearAndValueOfLatestValueforEntity(
                            entity
                        )
                        if (latestYearValue) {
                            row.push(
                                dim.formatYear(first(latestYearValue) as number)
                            )
                            value = last(latestYearValue)
                        } else row.push("")
                    } else {
                        value = dim.valueByEntityAndYear.get(entity)?.get(year)
                    }

                    if (value != null) {
                        row.push(value)
                        rowHasSomeValue = true
                    } else row.push("")
                })

                // Only add rows which actually have some data in them
                if (rowHasSomeValue) rows.push(row.map(csvEscape).join(","))
            })
        })

        return new Blob([rows.join("\n")], { type: "text/csv" })
    }

    @computed get csvDataUri(): string {
        return window.URL.createObjectURL(this.csvBlob)
    }

    @computed get csvFilename(): string {
        return this.props.chart.data.slug + ".csv"
    }

    // IE11 compatibility
    @action.bound onDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(this.csvBlob, this.csvFilename)
            ev.preventDefault()
        }
    }

    // returns true if given dimension is year-based in a chart with day-based variable
    private isFixedYearDimension(dim: ChartDimensionWithOwidVariable) {
        return this.props.chart.yearIsDayVar && !dim.yearIsDayVar
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
            baseFilename
        } = this

        let previewWidth: number
        let previewHeight: number
        const boundScalar = 0.4
        if (
            props.bounds.width / props.bounds.height >
            targetWidth / targetHeight
        ) {
            previewHeight = props.bounds.height * boundScalar
            previewWidth = (targetWidth / targetHeight) * previewHeight
        } else {
            previewWidth = props.bounds.width * boundScalar
            previewHeight = (targetHeight / targetWidth) * previewWidth
        }

        const imgStyle = {
            minWidth: previewWidth,
            minHeight: previewHeight,
            maxWidth: previewWidth,
            maxHeight: previewHeight,
            border: "1px solid #ccc"
        }

        const asideStyle = {
            maxWidth: previewWidth
        }

        const externalCsvLink = this.props.chart.externalCsvLink
        const csv_download = (
            <React.Fragment>
                <div className="download-csv" style={{ maxWidth: "100%" }}>
                    <p>
                        Download a CSV file containing all data used in this
                        visualization:
                    </p>
                    <a
                        href={
                            externalCsvLink ? externalCsvLink : this.csvDataUri
                        }
                        download={this.csvFilename}
                        className="btn btn-primary"
                        data-track-note="chart-download-csv"
                        onClick={externalCsvLink ? undefined : this.onDownload}
                    >
                        <FontAwesomeIcon icon={faDownload} /> {this.csvFilename}
                    </a>
                </div>
            </React.Fragment>
        )

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
                {csv_download}
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
                    mobile: isMobile()
                })}
                style={extend(this.props.bounds.toCSS(), {
                    position: "absolute"
                })}
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
