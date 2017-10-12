import { extend } from './Util'
import * as React from 'react'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'

interface DownloadTabProps {
    bounds: Bounds,
    chart: ChartConfig
}

@observer
export default class DownloadTab extends React.Component<DownloadTabProps> {
    @computed get targetWidth() { return 1020 }
    @computed get targetHeight() { return 720 }

    @observable svgBlob?: Blob
    @observable svgBlobUrl?: string
    @observable svgDataUri?: string
    @observable pngBlobUrl?: string
    @observable pngDataUri?: string
    @observable isReady: boolean = false
    @action.bound export() {
        const { targetWidth, targetHeight } = this
        const { chart } = this.props

        const originalFontSize = chart.baseFontSize
        chart.baseFontSize = 18
        const staticSVG = chart.staticSVG
        chart.baseFontSize = originalFontSize

        this.svgBlob = new Blob([staticSVG], { type: "image/svg+xml;charset=utf-8" })
        this.svgBlobUrl = URL.createObjectURL(this.svgBlob)
        const reader = new FileReader()
        reader.onload = (ev: any) => {
            this.svgDataUri = ev.target.result as string
            // Client-side SVG => PNG export. Somewhat experimental, so there's a lot of cross-browser fiddling and fallbacks here.
            const img = new Image()
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas")
                    canvas.width = targetWidth * 2
                    canvas.height = targetHeight * 2
                    const ctx = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D
                    ctx.imageSmoothingEnabled = false
                    ctx.setTransform(2, 0, 0, 2, 0, 0)
                    ctx.drawImage(img, 0, 0)
                    this.pngDataUri = canvas.toDataURL("image/png")
                    if (canvas.toBlob) {
                        canvas.toBlob(blob => {
                            this.pngBlobUrl = URL.createObjectURL(blob)
                            this.isReady = true
                        })
                    } else {
                        this.isReady = true
                    }
                } catch (e) {
                    console.error(e)
                    this.isReady = true
                }
            }
            img.onerror = (err) => {
                console.error(JSON.stringify(err))
                this.isReady = true
            }
            img.src = this.svgDataUri
        }
        reader.readAsDataURL(this.svgBlob)
    }

    @computed get fallbackPngUrl() {
        return `${this.props.chart.url.baseUrl}.png${this.props.chart.url.queryStr}`
    }
    @computed get baseFilename() { return this.props.chart.data.slug }
    @computed get svgPreviewUrl() { return this.svgDataUri }
    @computed get pngPreviewUrl() { return this.pngDataUri || this.fallbackPngUrl }
    @computed get svgDownloadUrl() { return this.svgBlobUrl }
    @computed get pngDownloadUrl() { return this.pngBlobUrl || this.pngDataUri || this.fallbackPngUrl }

    @computed get isPortrait(): boolean {
        return this.props.bounds.height > this.props.bounds.width
    }

    @action.bound onSVGDownload(ev: React.MouseEvent<HTMLAnchorElement>) {
        if (window.navigator.msSaveBlob) {
            window.navigator.msSaveBlob(this.svgBlob, this.baseFilename+".svg")
            ev.preventDefault()
        }
    }

    renderReady() {
        const { props, targetWidth, targetHeight, pngPreviewUrl, pngDownloadUrl, svgPreviewUrl, svgDownloadUrl, isPortrait, baseFilename } = this

        let previewWidth: number
        let previewHeight: number
        if (isPortrait) {
            previewWidth = props.bounds.width * 0.6
            previewHeight = (targetHeight / targetWidth) * previewWidth
        } else {
            previewHeight = props.bounds.height * 0.4
            previewWidth = (targetWidth / targetHeight) * previewHeight
        }

        const imgStyle = { minWidth: previewWidth, minHeight: previewHeight, maxWidth: previewWidth, maxHeight: previewHeight, border: "1px solid #ccc", margin: "1em" }

        return [
            <a href={pngDownloadUrl} download={baseFilename + ".png"}>
                {isPortrait
                    ? <div>
                        <h2>Save as .png</h2>
                        <img src={pngPreviewUrl} style={imgStyle} />
                        <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                    </div>
                    : <div>
                        <img src={pngPreviewUrl} style={imgStyle} />
                        <aside>
                            <h2>Save as .png</h2>
                            <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                        </aside>
                    </div>}
            </a>,
            <a href={svgDownloadUrl} download={baseFilename + ".svg"} onClick={this.onSVGDownload}>
                {isPortrait
                    ? <div>
                        <h2>Save as .svg</h2>
                        <img src={svgPreviewUrl} style={imgStyle} />
                        <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                    </div>
                    : <div>
                        <img src={svgPreviewUrl} style={imgStyle} />
                        <aside>
                            <h2>Save as .svg</h2>
                            <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                        </aside>
                    </div>}
            </a>]
    }

    componentWillMount() {
        this.export()
    }

    componentWillUnmount() {
        if (this.pngBlobUrl !== undefined)
            URL.revokeObjectURL(this.pngBlobUrl)
        if (this.svgBlobUrl !== undefined)
            URL.revokeObjectURL(this.svgBlobUrl)
    }

    render() {
        return <div className='downloadTab' style={extend(this.props.bounds.toCSS(), { position: 'absolute' })}>
            {this.isReady ? this.renderReady() : <div className="loadingIcon"><i className="fa fa-spinner fa-spin" /></div>}
        </div>
    }
}
