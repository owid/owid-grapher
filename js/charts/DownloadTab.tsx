import {extend} from './Util'
import * as React from 'react'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'

interface DownloadTabProps {
    bounds: Bounds,
    chart: ChartConfig
}

declare var App: { IDEAL_WIDTH: number, IDEAL_HEIGHT: number }

@observer
export default class DownloadTab extends React.Component<DownloadTabProps> {
    @computed get targetWidth() { return App.IDEAL_WIDTH }
    @computed get targetHeight() { return App.IDEAL_HEIGHT }

    @observable pngUrl?: string
    exportPng() {
        const {targetWidth, targetHeight} = this
        const {chart} = this.props
        const fallbackPngUrl = chart.url.baseUrl + ".png"

        // Client-side SVG => PNG export. Somewhat experimental, so we fall back to server-side exports if needed.
        try {
            const canvas = document.createElement("canvas")
            canvas.width = targetWidth*2
            canvas.height = targetHeight*2
            const ctx = canvas.getContext("2d", {alpha: false}) as CanvasRenderingContext2D;
            ctx.imageSmoothingEnabled = false
            ctx.setTransform(2,0,0,2,0,0);
            const DOMURL = self.URL || (self as any).webkitURL || self;
            const img = new Image();
            const svg = new Blob([chart.staticSVG], {type: "image/svg+xml;charset=utf-8"});
            const url = DOMURL.createObjectURL(svg);
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                this.pngUrl = canvas.toDataURL("image/png");
                DOMURL.revokeObjectURL(this.pngUrl);
            };
            img.onerror = (e) => {
                console.error(e)
                this.pngUrl = fallbackPngUrl
            }
            img.src = url;
        } catch (e) {
            console.error(e)
            this.pngUrl = fallbackPngUrl
        }
    }

    @computed get svgUrl() {
        return "data:image/svg+xml;utf8,"+encodeURIComponent(this.props.chart.staticSVG)
    }

    @computed get isPortrait(): boolean {
        return this.props.bounds.height > this.props.bounds.width
    }

    renderReady() {
        const {props, targetWidth, targetHeight, pngUrl, svgUrl, isPortrait} = this
        const {chart} = props

        let previewWidth, previewHeight
        if (isPortrait) {
            previewWidth = props.bounds.width*0.6
            previewHeight = (targetHeight/targetWidth) * previewWidth
        } else {
            previewHeight = props.bounds.height*0.4
            previewWidth = (targetWidth/targetHeight) * previewHeight
        }

        const imgStyle = { minWidth: previewWidth, minHeight: previewHeight, maxWidth: previewWidth, maxHeight: previewHeight, border: "1px solid #ccc", margin: "1em" }

        return [
            <a href={pngUrl} download={chart.data.slug+".png"}>
                {isPortrait
                ? <div>
                    <h2>Save as .png</h2>
                    <img src={pngUrl} style={imgStyle}/>
                    <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                </div>
                : <div>
                    <img src={pngUrl} style={imgStyle}/>
                    <aside>
                        <h2>Save as .png</h2>
                        <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                    </aside>
                </div>}
            </a>,
            <a href={svgUrl} download={chart.data.slug+".svg"}>
                {isPortrait
                ? <div>
                    <h2>Save as .svg</h2>
                    <img src={svgUrl} style={imgStyle}/>
                    <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                </div>
                : <div>
                    <img src={svgUrl} style={imgStyle}/>
                    <aside>
                        <h2>Save as .svg</h2>
                        <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                    </aside>
                </div>}
            </a>]
    }

    componentWillMount() {
        this.exportPng()
    }

	render() {
        return <div className='downloadTab' style={extend(this.props.bounds.toCSS(), { position: 'absolute' })}>
            {this.pngUrl ? this.renderReady() : <div className="loadingIcon"><i className="fa fa-spinner fa-spin"/></div>}
        </div>
	}
}
