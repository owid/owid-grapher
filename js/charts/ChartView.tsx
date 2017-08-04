import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as d3 from 'd3'
import {observable, computed, autorun, action, reaction, when} from 'mobx'
import {observer} from 'mobx-react'

import ChartConfig, {ChartConfigProps} from './ChartConfig'
import ControlsFooter from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import VariableData from './VariableData'
import ChartData from './ChartData'
import Bounds from './Bounds'
import {preInstantiate, VNode} from './Util'
import ChartTabOption from './ChartTabOption'
import DataSelector from './DataSelector'

declare const App: any // XXX
declare const Global: any // XXX

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
        d3.select(containerNode).classed('chart-container', true)
        let chartView
        const chart = new ChartConfig(jsonConfig)

        function render() {
            const rect = containerNode.getBoundingClientRect()

            chartView = ReactDOM.render(<ChartView bounds={Bounds.fromRect(rect)} chart={chart} isEditor={isEditor}/>, containerNode)
        }

        render()
        window.onresize = render
        return chartView
    }

    @computed get chart() { return this.props.chart }

    @computed get isExport() { return !!this.props.isExport }
    @computed get isEditor() { return !!this.props.isEditor }
    @computed get isEmbed() { return window.self != window.top || this.isEditor }
    @computed get isMobile() { return d3.select('html').classed('touchevents') }

    @computed get containerBounds() {
        const {isEmbed, isExport, isEditor} = this

        let bounds = this.props.bounds

        if (isExport) {
            bounds = bounds
        } else if (isEmbed) {
            bounds = bounds.pad(3);
        } else {
            if (bounds.width < 800)
                bounds = bounds.padWidth(bounds.width*0.01).padHeight(bounds.height*0.02);
            else
                bounds = bounds.padWidth(bounds.width*0.035).padHeight(bounds.height*0.075);
        }

        return bounds
    }

    @computed get isPortrait() { return this.isEditor || this.containerBounds.width < this.containerBounds.height }
    @computed get isLandscape() { return !this.isPortrait }

    @computed get authorDimensions() {
        if (this.isPortrait) {
            return [400, 640]
        } else {
            return [850, 600]
        }
    }

    @computed get authorWidth() { return this.authorDimensions[0] }
    @computed get authorHeight() { return this.authorDimensions[1] }
    @computed get renderWidth() { return this.authorWidth }
    @computed get renderHeight() { return this.authorHeight }

    // Imitate the standard aspect-ratio preserving scaling behavior of a static <img>
    @computed get scale() {
        if (this.isEditor)
            return 1
        else
            return Math.min(this.containerBounds.width/this.renderWidth, this.containerBounds.height/this.renderHeight)
    }

    @computed get svgBounds() {
        return (new Bounds(0, 0, this.renderWidth, this.renderHeight)).pad(15).padBottom(this.isExport ? 0 : this.controlsFooter.height)
    }


    @observable primaryTabName: ChartTabOption = 'chart'
    @observable overlayTabName: ChartTabOption|null = null
    @observable popups: VNode[] = []
    @observable.ref isSelectingData: boolean = false

    @observable.ref htmlNode: HTMLDivElement
    @observable.ref svgNode: SVGSVGElement
    base: HTMLDivElement

    constructor(props: ChartViewProps) {
        super(props)

        Bounds.baseFontSize = 22
        Bounds.baseFontFamily = "Helvetica, Arial"

        const {chart} = this
        const updateTab = () => {
            if (chart.tab == 'map' || chart.tab == 'chart') {
                this.primaryTabName = chart.tab
                this.overlayTabName = null
            } else {
                this.overlayTabName = chart.tab
            }
        }

        updateTab()
        reaction(() => chart.tab, updateTab)
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

        return _.filter(classNames).join(' ')
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
            removePopup: this.removePopup.bind(this),
            scale: this.scale 
        }
    }

    renderPrimaryTab(bounds: Bounds) {
        const {primaryTabName, svgBounds} = this

        if (primaryTabName == 'chart')
            return <ChartTab bounds={bounds} chartView={this} chart={this.chart}/>
        else
            return <MapTab bounds={bounds} chart={this.chart}/>
    }

    renderOverlayTab(bounds: Bounds) {
        const {chart, overlayTabName} = this

        if (overlayTabName == 'sources')
            return <SourcesTab bounds={bounds} chart={chart}/>
        else if (overlayTabName == 'data')
            return <DataTab bounds={bounds} chart={chart}/>
        else if (overlayTabName == 'download')
            return <DownloadTab bounds={bounds} chart={chart}/>
        else
            return null
    }

    renderSVG() {
        const {renderWidth, renderHeight, scale, svgBounds} = this

        const svgStyle = {
            width: "100%",
            height: "100%",
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: "22px",
            backgroundColor: "white"
        }

        return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={svgStyle} width={renderWidth*scale} height={renderHeight*scale} viewBox={`0 0 ${renderWidth} ${renderHeight}`}
                ref={e => this.svgNode = e as SVGSVGElement}>
                {this.renderPrimaryTab(svgBounds)}
        </svg>
    }

    renderReady() {
        const {svgBounds, controlsFooter, scale, isExport, chart} = this

        return [
            this.renderSVG(),
            <ControlsFooter {...controlsFooter.props}/>,
            this.renderOverlayTab(svgBounds.scale(scale).padBottom(controlsFooter.height)),
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
            const {renderWidth, renderHeight, scale} = this

            const style = { width: renderWidth*scale + 'px', height: renderHeight*scale + 'px', fontSize: 16*scale + 'px' }

            return <div id="chart" className={this.classNames} style={style}>
                {this.chart.data.isReady ? this.renderReady() : this.renderLoading()}
            </div>
        }
    }

    componentDidMount() {
        this.htmlNode = this.base
    }

    
    hasFadedIn: boolean = false
    componentDidUpdate() {
        if (this.chart.data.isReady && !this.hasFadedIn) {
            d3.selectAll("div > *").style('opacity', 0).transition().style('opacity', 1)
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
