import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import { select } from 'd3-selection'
import 'd3-transition'

import { ChartConfig, ChartConfigProps } from './ChartConfig'
import {Controls, ControlsFooterView} from './Controls'
import { ChartTab } from './ChartTab'
import { DataTab } from './DataTab'
import { MapTab } from './MapTab'
import { SourcesTab } from './SourcesTab'
import { DownloadTab } from './DownloadTab'
import { VNode, throttle, isMobile } from './Util'
import { Bounds } from './Bounds'
import { DataSelector } from './DataSelector'
import { ChartViewContext } from './ChartViewContext'
import { TooltipView } from './Tooltip'

declare const window: any

interface ChartViewProps {
    bounds: Bounds,
    chart: ChartConfig,
    isExport?: boolean,
    isEditor?: boolean,
    isEmbed?: boolean
}

@observer
export class ChartView extends React.Component<ChartViewProps> {
    static bootstrap({ jsonConfig, containerNode, isEditor, isEmbed, queryStr }: { jsonConfig: ChartConfigProps, containerNode: HTMLElement, isEditor?: boolean, isEmbed?: true, queryStr?: string }) {
        select(containerNode).classed('chart-container', true)
        let chartView
        const chart = new ChartConfig(jsonConfig, { isEmbed: isEmbed, queryStr: queryStr })

        function render() {
            const rect = containerNode.getBoundingClientRect()
            const containerBounds = Bounds.fromRect(rect)

            if (containerBounds.width <= 400)
                chart.baseFontSize = 14
            else if (containerBounds.width < 1080)
                chart.baseFontSize = 16
            else if (containerBounds.width >= 1080)
                chart.baseFontSize = 18
            Bounds.baseFontFamily = "Helvetica, Arial"
            chartView = ReactDOM.render(<ChartView bounds={containerBounds} chart={chart} isEditor={isEditor} isEmbed={isEmbed} />, containerNode)
        }

        render()
        window.addEventListener('resize', throttle(render))
        return chartView
    }

    @computed get chart() { return this.props.chart }

    @computed get isExport() { return !!this.props.isExport }
    @computed get isEditor() { return !!this.props.isEditor }
    @computed get isEmbed() { return this.props.isEmbed || (!this.isExport && (window.self !== window.top || this.isEditor)) }
    @computed get isMobile() { return isMobile() }

    @computed get containerBounds() { return this.props.bounds }

    @computed get isPortrait() { return this.containerBounds.width < this.containerBounds.height }
    @computed get isLandscape() { return !this.isPortrait }

    @computed get authorWidth() { return this.isPortrait ? 400 : 850 }
    @computed get authorHeight() { return this.isPortrait ? 640 : 600 }

    // If the available space is very small, we use all of the space given to us
    @computed get fitBounds(): boolean {
        const { isEditor, isEmbed, isExport, containerBounds, authorWidth, authorHeight } = this

        if (isEditor)
            return false
        else
            return isEmbed || isExport || containerBounds.height < authorHeight || containerBounds.width < authorWidth
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed get paddedWidth(): number { return this.isPortrait ? this.containerBounds.width * 0.9 : this.containerBounds.width * 0.9 }
    @computed get paddedHeight(): number { return this.isPortrait ? this.containerBounds.height * 0.9 : this.containerBounds.height * 0.9 }
    @computed get scaleToFitIdeal(): number {
        return Math.min(this.paddedWidth / this.authorWidth, this.paddedHeight / this.authorHeight)
    }
    @computed get idealWidth(): number { return this.authorWidth * this.scaleToFitIdeal }
    @computed get idealHeight(): number { return this.authorHeight * this.scaleToFitIdeal }

    // These are the final render dimensions
    @computed get renderWidth() { return this.fitBounds ? this.containerBounds.width - (this.isExport ? 0 : 5) : this.idealWidth }
    @computed get renderHeight() { return this.fitBounds ? this.containerBounds.height - (this.isExport ? 0 : 5) : this.idealHeight }

    @computed get controls(): Controls {
        const that = this
        return new Controls({
            get chart() { return that.props.chart },
            get chartView() { return that },
            get width() { return that.renderWidth }
        })
    }

    @computed get tabBounds() {
        return (new Bounds(0, 0, this.renderWidth, this.renderHeight)).padBottom(this.isExport ? 0 : this.controls.height)
    }

    @observable.ref popups: VNode[] = []
    @observable.ref isSelectingData: boolean = false

    base: React.RefObject<HTMLDivElement> = React.createRef()
    hasFadedIn: boolean = false
    @observable hasBeenVisible: boolean = false

    @computed get classNames(): string {
        const classNames = [
            "chart",
            this.isExport && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape"
        ]

        return classNames.filter(n => !!n).join(' ')
    }

    addPopup(vnode: VNode) {
        this.popups = this.popups.concat([vnode])
    }

    removePopup(vnodeType: any) {
        this.popups = this.popups.filter(d => !(d.type === vnodeType))
    }

    get childContext() {
        return {
            chart: this.chart,
            chartView: this,
            baseFontSize: this.chart.baseFontSize,
            isStatic: this.isExport,
            addPopup: this.addPopup.bind(this),
            removePopup: this.removePopup.bind(this)
        }
    }

    renderPrimaryTab(): JSX.Element | undefined {
        const { chart, tabBounds } = this
        if (chart.primaryTab === 'chart')
            return <ChartTab bounds={tabBounds} chartView={this} chart={this.chart} />
        else if (chart.primaryTab === 'map')
            return <MapTab bounds={tabBounds} chart={this.chart} />
        else
            return undefined
    }

    renderOverlayTab(bounds: Bounds): JSX.Element | undefined {
        const { chart } = this
        if (chart.overlayTab === 'sources')
            return <SourcesTab key='sourcesTab' bounds={bounds} chart={chart} />
        else if (chart.overlayTab === 'data')
            return <DataTab key='dataTab' bounds={bounds} chart={chart} />
        else if (chart.overlayTab === 'download')
            return <DownloadTab key='downloadTab' bounds={bounds} chart={chart} />
        else
            return undefined
    }

    renderSVG() {
        return this.renderPrimaryTab()
    }

    renderReady() {
        const { tabBounds, chart } = this

        return <React.Fragment>
            {this.hasBeenVisible && this.renderSVG()}
            <ControlsFooterView controls={this.controls}/>
            {this.renderOverlayTab(tabBounds)}
            {this.popups}
            <TooltipView/>
            {this.isSelectingData && <DataSelector key="dataSelector" chart={chart} chartView={this} onDismiss={action(() => this.isSelectingData = false)} />}
        </React.Fragment>
    }

    renderMain() {
        if (this.isExport) {
            return this.renderSVG()
        } else {
            const { renderWidth, renderHeight } = this

            const style = { width: renderWidth, height: renderHeight, fontSize: this.chart.baseFontSize }

            return this.chart.data.isReady && <div ref={this.base} className={this.classNames} style={style}>
                {this.renderReady()}
            </div>
        }
    }

    render() {
        return <ChartViewContext.Provider value={this.childContext}>
            {this.renderMain()}
        </ChartViewContext.Provider>
    }

    // Chart should only render SVG when it's on the screen
    @action.bound checkVisibility() {
        function checkVisible(elm: HTMLElement|null) {
            if (!elm || !elm.getBoundingClientRect)
                return false
            const rect = elm.getBoundingClientRect()
            const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight)
            return !(rect.bottom < 0 || rect.top - viewHeight >= 0)
        }

        if (!this.hasBeenVisible && checkVisible(this.base.current)) {
            this.hasBeenVisible = true
        }
    }

    componentDidMount() {
        window.chartView = this

        window.addEventListener('scroll', this.checkVisibility)
    }

    componentWillUnmount() {
        window.removeEventListener('scroll', this.checkVisibility)
    }

    componentDidUpdate() {
        if (this.chart.data.isReady && this.hasBeenVisible && !this.hasFadedIn) {
            select(this.base.current!).selectAll(".chart > *").style('opacity', 0).transition().style('opacity', null)
            this.hasFadedIn = true
        } else {
            this.checkVisibility()
        }
    }
}
