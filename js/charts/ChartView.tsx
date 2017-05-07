// WIP replacement for owid.chart.jsx

import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as d3 from 'd3'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'

import ChartConfig from './ChartConfig'
import SourcesFooter from './SourcesFooter'
import ControlsFooter from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import VariableData from './App.Models.VariableData'
import ChartModel from './App.Models.ChartModel'
import ChartData from './App.Models.ChartData'
import Colors from './App.Models.Colors'
import Header from './App.Views.Chart.Header'
import Export from './App.Views.Export'
import UrlBinder from './App.Views.ChartURL'
import mapdata from './owid.models.mapdata'
import Bounds from './Bounds'
import {preInstantiate} from './Util'

declare const App: any // XXX

interface ChartViewProps {
    jsonConfig: any
}

@observer
export default class ChartView extends React.Component<ChartViewProps, null> {
    static bootstrap({ jsonConfig, containerNode }: { jsonConfig: Object, containerNode: HTMLElement }) {
        d3.select(containerNode).classed('chart-container', true)
        const rect = containerNode.getBoundingClientRect()
        ReactDOM.render(<ChartView bounds={Bounds.fromProps(rect)} jsonConfig={jsonConfig}/>, containerNode)
    }

    @computed get isExport() { return !!window.location.pathname.match(/.export$/) }
    @computed get isEditor() { return App.isEditor }
    @computed get isEmbed() { return window.self != window.top || this.isEditor }
    @computed get isMobile() { return d3.select('html').classed('touchevents') }

    @computed get containerBounds() {
        const {isEmbed} = this

        let bounds = this.props.bounds

        if (isEmbed) {
            bounds = bounds.pad(3);
        } else {
            if (bounds.width < 800)
                bounds = bounds.padWidth(bounds.width*0.01).padHeight(bounds.height*0.02);
            else
                bounds = bounds.padWidth(bounds.width*0.035).padHeight(bounds.height*0.075);
        }

        return bounds
    }

    @computed get isPortrait() { return this.containerBounds.width < this.containerBounds.height }
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

    constructor(props: ChartViewProps) {
        super(props)
        // XXX all of this stuff needs refactoring
        this.model = new ChartModel(props.jsonConfig)
        App.ChartModel = this.model
        this.config = new ChartConfig(this.model)
        App.VariableData = new VariableData()
        this.vardata = App.VariableData
        App.ChartData = new ChartData()
        this.data = App.ChartData
        App.Colors = new Colors(this)
        App.ChartModel.bind()
        this.map = App.MapModel
        this.mapdata = mapdata(this)
        this.url = UrlBinder(this)
        this.tooltip = new owid.view.tooltip(this)

        Bounds.baseFontSize = 22
        Bounds.baseFontFamily = "Helvetica, Arial"

        this.data.ready(() => this.isReady = true)

        this.model.on('change', () => this.forceUpdate())
        this.map.on('change', () => this.forceUpdate())
    }

    @observable isReady = false

    @computed get controlsFooter() {
        return preInstantiate(<ControlsFooter config={this.config} chartView={this} scale={this.scale} activeTabName={this
                        .activeTabName}/>)
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

    renderReady() {
        const {renderWidth, renderHeight, svgBounds, controlsFooter} = this

        this.mapdata.update()

        return [
            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" version="1.1"
                 style={{ width: "100%", height: "100%" }} viewBox={`0 0 ${renderWidth} ${renderHeight}`}>
                <MapTab bounds={svgBounds.padBottom(controlsFooter.height)} chartView={this} chart={this.config} choroplethData={this.mapdata.currentValues} years={this.map.getYears()} inputYear={+this.map.get('targetYear')} legendData={this.mapdata.legendData} legendTitle={this.mapdata.legendTitle} projection={this.map.get('projection')} defaultFill={this.mapdata.getNoDataColor()} />
            </svg>,
            <ControlsFooter {...controlsFooter.props}/>
        ]
    }

    renderLoading() {
        return <div class="loadingIcon"><i class="fa fa-spinner fa-spin"/></div>
    }

    render() {
        const {renderWidth, renderHeight, scale} = this

        const style = { width: renderWidth*scale + 'px', height: renderHeight*scale + 'px' }

        return <div id="chart" className={this.classNames} style={style}>
            {this.isReady ? this.renderReady() : this.renderLoading()}
        </div>
    }
}
