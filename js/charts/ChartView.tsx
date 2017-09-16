import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import {select, selectAll} from 'd3-selection'
import 'd3-transition'

import ChartConfig, {ChartConfigProps} from './ChartConfig'
import ControlsFooter from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import {preInstantiate, VNode} from './Util'
import Bounds from './Bounds'
import DataSelector from './DataSelector'

declare const App: any // XXX
declare const window: any

App.IDEAL_WIDTH = 1020
App.IDEAL_HEIGHT = 720

interface ChartViewProps {
    bounds: Bounds,
    chart: ChartConfig,
    isExport?: boolean,
    isEditor?: boolean
}

@observer
export default class ChartView extends React.Component<ChartViewProps> {
    static bootstrap({ jsonConfig, containerNode, isEditor }: { jsonConfig: ChartConfigProps, containerNode: HTMLElement, isEditor: boolean }) {
        select(containerNode).classed('chart-container', true)
        let chartView
        const chart = new ChartConfig(jsonConfig)

        function render() {
            const rect = containerNode.getBoundingClientRect()
            const containerBounds = Bounds.fromRect(rect)



            Bounds.baseFontSize = containerBounds.width > 800 ? 22 : 20
            Bounds.baseFontFamily = "Helvetica, Arial"
            chartView = ReactDOM.render(<ChartView bounds={containerBounds} chart={chart} isEditor={isEditor}/>, containerNode)
        }

        render()
        window.onresize = render
        return chartView
    }

    @computed get chart() { return this.props.chart }

    @computed get isExport() { return !!this.props.isExport }
    @computed get isEditor() { return !!this.props.isEditor }
    @computed get isEmbed() { return window.self != window.top || this.isEditor }
    @computed get isMobile() { return select('html').classed('touchevents') }

    @computed get containerBounds() {
        const {isEmbed, isExport} = this

        let bounds = this.props.bounds

        if (isExport) {
            bounds = bounds
        } else if (isEmbed) {
            bounds = bounds.pad(3);
        } else {
           // if (bounds.width > 800)
           //     bounds = bounds.padWidth(bounds.width*0.035).padHeight(bounds.height*0.075);
        }

        return bounds
    }

    @computed get authorWidth() { return this.isPortrait ? 400 : 850 }
    @computed get authorHeight() { return this.isPortrait ? 640 : 600 }

    // If the chart is an embed, or if the available space is very small, we use all of the space given to us
    @computed get fitBounds(): boolean {
        return this.isEmbed || this.isExport || this.containerBounds.width < this.authorWidth || this.containerBounds.height < this.authorHeight
    }

    @computed get isPortrait() { return this.isEditor || this.containerBounds.width < this.containerBounds.height }
    @computed get isLandscape() { return !this.isPortrait }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed get paddedWidth(): number { return this.containerBounds.width*0.8 }
    @computed get paddedHeight(): number { return this.containerBounds.height*0.8 }
    @computed get scaleToFitIdeal(): number {
        return Math.min(this.paddedWidth/this.authorWidth, this.paddedHeight/this.authorHeight)        
    }
    @computed get idealWidth(): number { return this.authorWidth*this.scaleToFitIdeal }
    @computed get idealHeight(): number { return this.authorHeight*this.scaleToFitIdeal }

    // These are the final target render dimensions
    @computed get renderWidth() { return this.fitBounds ? this.containerBounds.width : this.idealWidth }
    @computed get renderHeight() { return this.fitBounds ? this.containerBounds.height : this.idealHeight }

    @computed get svgBounds() {
        return (new Bounds(0, 0, this.renderWidth, this.renderHeight)).padBottom(this.isExport ? 0 : this.controlsFooter.height)
    }

    @computed get svgInnerBounds() {
        return new Bounds(0, 0, this.svgBounds.width, this.svgBounds.height).pad(15)
    }

    @observable popups: VNode[] = []
    @observable.ref isSelectingData: boolean = false

    @observable.ref htmlNode: HTMLDivElement
    @observable.ref svgNode: SVGSVGElement
    base: HTMLDivElement

    constructor(props: ChartViewProps) {
        super(props)
    }

    @computed get controlsFooter() {
        return preInstantiate(<ControlsFooter chart={this.chart} chartView={this}/>)
    }

    @computed get classNames(): string {
        const classNames = [
            this.isExport && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape"
        ]

        return classNames.filter(n => !!n).join(' ')
    }

    addPopup(vnode: VNode) {
        this.popups.push(vnode)
    }

    removePopup(vnodeType: any) {
        this.popups = this.popups.filter(d => !(d.nodeName == vnodeType))
    }

    getChildContext() {
        return { 
            chart: this.chart,
            chartView: this, 
            isStatic: this.isExport, 
            addPopup: this.addPopup.bind(this), 
            removePopup: this.removePopup.bind(this)
        }
    }

    renderPrimaryTab(bounds: Bounds): JSX.Element|undefined {
        const {chart} = this
        if (chart.primaryTab == 'chart')
            return <ChartTab bounds={bounds} chartView={this} chart={this.chart}/>
        else if (chart.primaryTab == 'map')
            return <MapTab bounds={bounds} chart={this.chart}/>
        else
            return undefined
    }

    renderOverlayTab(bounds: Bounds): JSX.Element|undefined {
        const {chart} = this
        if (chart.overlayTab == 'sources')
            return <SourcesTab bounds={bounds} chart={chart}/>
        else if (chart.overlayTab == 'data')
            return <DataTab bounds={bounds} chart={chart}/>
        else if (chart.overlayTab == 'download')
            return <DownloadTab bounds={bounds} chart={chart}/>
        else
            return undefined
    }

    renderSVG() {
        const {svgBounds, svgInnerBounds} = this

        const svgStyle = {
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: "22px",
            backgroundColor: "white"
        }

        return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={svgStyle} width={svgBounds.width} height={svgBounds.height} ref={(e: SVGSVGElement) => this.svgNode = e}>
            {this.renderPrimaryTab(svgInnerBounds)}
        </svg>
    }

    renderReady() {
        const {svgBounds, controlsFooter, chart} = this

        return [
            this.renderSVG(),
            <ControlsFooter {...controlsFooter.props}/>,
            this.renderOverlayTab(svgBounds),
            this.popups,
            this.chart.tooltip,
            this.isSelectingData && <DataSelector chart={chart} chartView={this} onDismiss={action(() => this.isSelectingData = false)}/>
        ]
    }

    renderLoading() {
        return <div className="loadingIcon"><i className="fa fa-spinner fa-spin"/></div>
    }

    render() {
        if (this.isExport) {
            return this.renderSVG()
        } else{
            const {renderWidth, renderHeight} = this

            const style = { width: renderWidth, height: renderHeight, fontSize: 16 }

            return <div id="chart" className={this.classNames} style={style}>
                {this.chart.data.isReady ? this.renderReady() : this.renderLoading()}
            </div>
        }
    }

    componentDidMount() {
        this.htmlNode = this.base
        window.chartView = this
    }

    
    hasFadedIn: boolean = false
    componentDidUpdate() {
        if (this.chart.data.isReady && !this.hasFadedIn) {
            selectAll("#chart > *").style('opacity', 0).transition().style('opacity', null)
            this.hasFadedIn = true
        }
    }

    // XXX
    getTransformedBounds(node: HTMLElement) {
        var chartRect = this.base.getBoundingClientRect(),
            nodeRect = node.getBoundingClientRect();

        return new Bounds(
            nodeRect.left-chartRect.left,
            nodeRect.top-chartRect.top,
            nodeRect.width,
            nodeRect.height
        );
    };
}
