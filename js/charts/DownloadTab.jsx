import _ from 'lodash'
import * as d3 from 'd3'
import React, {Component} from 'react'
import {render} from 'preact'
import owid from '../owid'
import {observable, computed, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {NullElement} from './Util'
import dataflow from './owid.dataflow'

@observer
class ImgLoader extends Component {
    @computed get src() {
        return this.props.src
    }

    @observable img = null
    componentDidMount() {
        autorun(() => {
            var img = new Image()
            img.onload = () => {
                this.img = img
            }
            img.src = this.props.src
        })
    }

    render() {
        const {props, img} = this

        const style = { minWidth: props.width, minHeight: props.height, maxWidth: props.width, maxHeight: props.height }

        if (img) {
            return <img className="imgLoader" src={img.src} style={style}/>
        } else {
            return <div className="imgLoader" style={style}>
                <i class="fa fa-spinner fa-spin"/>
            </div>
        }

    }
}

@observer
export default class DownloadTab extends Component {
    @computed get baseUrl() : string {
        return Global.rootUrl + '/' + this.props.chartView.config.slug
    }

    @computed get queryStr() : string {
        return this.props.chartView.url.lastQueryStr||""
    }

    @computed get cacheTag() : string {
        return this.props.chartView.model.get("variableCacheTag")
    }

    @computed get targetWidth(): number {
        return this.props.imageWidth
    }

    @computed get targetHeight(): number {
        return this.props.imageHeight
    }

    @computed get pngUrl() : string {
        const {baseUrl, queryStr, cacheTag, targetWidth, targetHeight} = this
        var pngHref = baseUrl + '.png' + queryStr, defaultTargetSize = targetWidth + "x" + targetHeight
        return pngHref + (_.includes(pngHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag
    }

    @computed get svgUrl() : string {
        const {baseUrl, queryStr, cacheTag, targetWidth, targetHeight} = this
        var svgHref = baseUrl + '.svg' + queryStr, defaultTargetSize = targetWidth + "x" + targetHeight
        return svgHref + (_.includes(svgHref, "?") ? "&" : "?") + "size=" + defaultTargetSize + "&v=" + cacheTag
    }

    @computed get isPortrait(): boolean {
        return this.props.bounds.height > this.props.bounds.width
    }

    renderPortrait() {
        const { props, pngUrl, svgUrl, targetWidth, targetHeight } = this
        const previewWidth = props.bounds.width*0.6
        const previewHeight = (targetHeight/targetWidth) * previewWidth

        return <div className='downloadTab' style={_.extend(props.bounds.toCSS(), { position: 'absolute' })}>
            <a href={pngUrl}>
                <div>
                    <h2>Save as .png</h2>
                    <ImgLoader width={previewWidth} height={previewHeight} src={pngUrl}/>
                    <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                </div>
            </a>
            <hr/>
            <a href={svgUrl}>
                <div>
                    <h2>Save as .svg</h2>
                    <ImgLoader width={previewWidth} height={previewHeight} src={svgUrl}/>
                    <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                </div>
            </a>
        </div>
    }

    renderLandscape() {
        const { props, pngUrl, svgUrl, targetWidth, targetHeight } = this
        const previewHeight = props.bounds.height*0.4
        const previewWidth = (targetWidth/targetHeight) * previewHeight

        return <div className='downloadTab' style={_.extend(props.bounds.toCSS(), { position: 'absolute' })}>
            <a href={pngUrl}>
                <div>
                    <ImgLoader width={previewWidth} height={previewHeight} src={pngUrl}/>
                    <aside>
                        <h2>Save as .png</h2>
                        <p>A standard image of the visualization that can be used in presentations or other documents.</p>
                    </aside>
                </div>
            </a>
            <a href={svgUrl}>
                <div>
                    <ImgLoader width={previewWidth} height={previewHeight} src={svgUrl}/>
                    <aside>
                        <h2>Save as .svg</h2>
                        <p>A vector format image useful for further redesigning the visualization with vector graphic software.</p>
                    </aside>
                </div>
            </a>
        </div>
    }

	render() {
        return this.isPortrait ? this.renderPortrait() : this.renderLandscape()
	}
}
