import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as d3 from 'd3'
import {observable, computed, autorun, action, reaction} from 'mobx'
import {observer} from 'mobx-react'

import ChartConfig from './ChartConfig'
import ControlsFooter from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import VariableData from './VariableData'
import ChartData from './ChartData'
import Colors from './App.Models.Colors'
import UrlBinder from './URLBinder'
import mapdata from './owid.models.mapdata'
import tooltip from './owid.view.tooltip'
import Bounds from './Bounds'
import {preInstantiate, VNode} from './Util'
import ChartTabOption from './ChartTabOption'

declare const App: any // XXX
declare const Global: any // XXX

App.IDEAL_WIDTH = 1020
App.IDEAL_HEIGHT = 720

interface ChartViewProps {
    bounds: Bounds,
    jsonConfig: any,
    isExport?: boolean,
    isEditor?: boolean
}

@observer
export default class ChartView extends React.Component<ChartViewProps, undefined> {
    static bootstrap({ jsonConfig, containerNode, isEditor }: { jsonConfig: Object, containerNode: HTMLElement, isEditor: boolean }) {
        d3.select(containerNode).classed('chart-container', true)
        let chartView

        function render() {
            const rect = containerNode.getBoundingClientRect()
            chartView = ReactDOM.render(<ChartView bounds={Bounds.fromRect(rect)} jsonConfig={jsonConfig} isEditor={isEditor}/>, containerNode)
        }

        render()
        window.onresize = render
        return chartView
    }

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
        return (new Bounds(0, 0, this.renderWidth, this.renderHeight)).pad(15)
    }


    @observable primaryTabName: ChartTabOption = 'chart'
    @observable overlayTabName: ChartTabOption|null = null
    @observable popups: VNode[] = []

    model: any
    config: any
    chart: ChartConfig
    vardata: any
    data: any
    map: any
    mapdata: any
    url: any
    tooltip: any
    htmlNode: HTMLDivElement
    base: HTMLDivElement

    constructor(props: ChartViewProps) {
        super(props)
        // XXX all of this stuff needs refactoring
        this.chart = new ChartConfig(props.jsonConfig)
        App.Colors = new Colors(this)
//        this.map = App.MapModel
//        this.mapdata = mapdata(this)
        this.url = new UrlBinder(this.chart)
        this.tooltip = tooltip(this)

        Bounds.baseFontSize = 22
        Bounds.baseFontFamily = "Helvetica, Arial"

        reaction(
            () => this.chart.tab,
            tab => {
                if (tab == 'map' || tab == 'chart') {
                    this.primaryTabName = tab
                    this.overlayTabName = null
                } else {
                    this.overlayTabName = tab
                }
            }
        )

        //this.model.on('change', () => this.data.ready(() => this.forceUpdate()))
        //this.map.on('change', () => this.data.ready(() => this.forceUpdate()))
    }

    @computed get controlsFooter() {
        return preInstantiate(<ControlsFooter
            availableTabs={this.chart.availableTabs}
            onTabChange={action(tabName => this.chart.tab = (tabName as ChartTabOption))}
            chart={this.chart}
            chartView={this}
            activeTabName={this.chart.tab}
         />)
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
            return <ChartTab bounds={bounds} chartView={this} chart={this.chart} onRenderEnd={this.props.onRenderEnd}/>
        else
            return <MapTab bounds={bounds} chartView={this} chart={this.chart} onRenderEnd={this.props.onRenderEnd}/>
    }

    renderOverlayTab(bounds: Bounds) {
        const {chart, overlayTabName} = this

        if (overlayTabName == 'sources')
            return <SourcesTab bounds={bounds} sources={this.chart.data.transformDataForSources()}/>
        else if (overlayTabName == 'data')
            return <DataTab bounds={bounds} csvUrl={Global.rootUrl+'/'+chart.slug+'.csv'}/>
        else if (overlayTabName == 'download')
            return <DownloadTab bounds={bounds} chartView={this} imageWidth={App.IDEAL_WIDTH} imageHeight={App.IDEAL_HEIGHT}/>
        else
            return null
    }

    renderReady() {
        const {renderWidth, renderHeight, svgBounds, controlsFooter, scale} = this

        return [
            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" version="1.1"
                 style={{ width: "100%", height: "100%" }} viewBox={`0 0 ${renderWidth} ${renderHeight}`}
                 ref={e => this.svgNode = e}>
                 {this.renderPrimaryTab(svgBounds.padBottom(this.isExport ? 0 : controlsFooter.height))}
            </svg>,
            !this.isExport && <ControlsFooter {...controlsFooter.props}/>,
            this.renderOverlayTab(svgBounds.scale(scale).padBottom(controlsFooter.height)),
            this.popups
        ]
    }

    renderLoading() {
        return <div className="loadingIcon"><i className="fa fa-spinner fa-spin"/></div>
    }

    render() {
        const {renderWidth, renderHeight, scale} = this

        const style = { width: renderWidth*scale + 'px', height: renderHeight*scale + 'px', fontSize: 16*scale + 'px' }

        return <div id="chart" className={this.classNames} style={style}>
            {this.chart.dimensionsWithData ? this.renderReady() : this.renderLoading()}
        </div>
    }

    componentDidMount() {
        this.htmlNode = this.base
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
