import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, action, autorun } from "mobx"
import { observer } from "mobx-react"
import "d3-transition"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"

import { ChartConfig } from "./ChartConfig"
import {
    Controls,
    ControlsFooterView,
    ControlsOverlay
} from "charts/controls/Controls"
import { ChartTab } from "./ChartTab"
import { TableTab } from "charts/dataTable/TableTab"
import { MapTab } from "charts/mapCharts/MapTab"
import { SourcesTab } from "charts/sourcesTab/SourcesTab"
import { DownloadTab } from "charts/downloadTab/DownloadTab"
import { VNode, throttle, isMobile, isTouchDevice } from "charts/utils/Util"
import { Bounds } from "charts/utils/Bounds"
import { EntitySelectorModal } from "charts/controls/EntitySelectorModal"
import { ChartViewContext } from "charts/core/ChartViewContext"
import { TooltipView } from "charts/core/Tooltip"
import { FullStory } from "site/client/FullStory"
import { Analytics } from "site/client/Analytics"
import { UrlBinder } from "charts/utils/UrlBinder"
import { GlobalEntitySelection } from "site/client/global-entity/GlobalEntitySelection"
import { ChartScript } from "./ChartScript"

declare const window: any

interface ChartViewProps {
    bounds: Bounds
    chart: ChartConfig
    isExport?: boolean
    isEditor?: boolean
    isEmbed?: boolean
}

function isVisible(elm: HTMLElement | null) {
    if (!elm || !elm.getBoundingClientRect) return false
    const rect = elm.getBoundingClientRect()
    const viewHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
    )
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0)
}

@observer
export class ChartView extends React.Component<ChartViewProps> {
    static bootstrap({
        jsonConfig,
        containerNode,
        isEditor,
        isEmbed,
        queryStr,
        globalEntitySelection
    }: {
        jsonConfig: ChartScript
        containerNode: HTMLElement
        isEditor?: boolean
        isEmbed?: true
        queryStr?: string
        globalEntitySelection?: GlobalEntitySelection
    }) {
        let chartView
        const chart = new ChartConfig(jsonConfig, {
            isEmbed: isEmbed,
            queryStr: queryStr,
            globalEntitySelection: globalEntitySelection
        })

        function render() {
            const rect = containerNode.getBoundingClientRect()
            const containerBounds = Bounds.fromRect(rect)
            chartView = ReactDOM.render(
                <ChartView
                    bounds={containerBounds}
                    chart={chart}
                    isEditor={isEditor}
                    isEmbed={isEmbed}
                />,
                containerNode
            )
        }

        render()
        window.addEventListener("resize", throttle(render))

        FullStory.event("Loaded chart v2", {
            chart_type_str: chart.script.type,
            chart_id_int: chart.script.id,
            slug_str: chart.script.slug,
            originUrl_str: chart.script.originUrl,
            addCountryMode_str: chart.script.addCountryMode,
            stackMode_str: chart.script.stackMode,
            hideLegend_bool: chart.script.hideLegend,
            hideRelativeToggle_bool: chart.script.hideRelativeToggle,
            hideTimeline_bool: chart.script.hideTimeline,
            hideConnectedScatterLines_bool:
                chart.script.hideConnectedScatterLines,
            compareEndPointsOnly_bool: chart.script.compareEndPointsOnly,
            entityType_str: chart.entityType,
            isEmbed_bool: chart.isEmbed,
            hasChartTab_bool: chart.hasChartTab,
            hasMapTab_bool: chart.hasMapTab,
            tab_str: chart.tab,
            totalSelectedEntities_int: chart.script.selectedData.length
        })

        return chartView
    }

    @computed get chart() {
        return this.props.chart
    }

    @computed get isExport() {
        return !!this.props.isExport
    }
    @computed get isEditor() {
        return !!this.props.isEditor
    }
    @computed get isEmbed() {
        return (
            this.props.isEmbed ||
            (!this.isExport && (window.self !== window.top || this.isEditor))
        )
    }
    @computed get isMobile() {
        return isMobile()
    }

    @computed get containerBounds() {
        return this.props.bounds
    }

    @computed get isPortrait() {
        return (
            this.containerBounds.width < this.containerBounds.height &&
            this.containerBounds.width < 850
        )
    }
    @computed get isLandscape() {
        return !this.isPortrait
    }

    @computed get authorWidth() {
        return this.isPortrait ? 400 : 680
    }
    @computed get authorHeight() {
        return this.isPortrait ? 640 : 480
    }

    // If the available space is very small, we use all of the space given to us
    @computed get fitBounds(): boolean {
        const {
            isEditor,
            isEmbed,
            isExport,
            containerBounds,
            authorWidth,
            authorHeight
        } = this

        if (isEditor) return false
        else
            return (
                isEmbed ||
                isExport ||
                containerBounds.height < authorHeight ||
                containerBounds.width < authorWidth
            )
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed get paddedWidth(): number {
        return this.isPortrait
            ? this.containerBounds.width * 0.95
            : this.containerBounds.width * 0.95
    }
    @computed get paddedHeight(): number {
        return this.isPortrait
            ? this.containerBounds.height * 0.95
            : this.containerBounds.height * 0.95
    }
    @computed get scaleToFitIdeal(): number {
        return Math.min(
            this.paddedWidth / this.authorWidth,
            this.paddedHeight / this.authorHeight
        )
    }
    @computed get idealWidth(): number {
        return this.authorWidth * this.scaleToFitIdeal
    }
    @computed get idealHeight(): number {
        return this.authorHeight * this.scaleToFitIdeal
    }

    // These are the final render dimensions
    @computed get renderWidth() {
        return this.fitBounds
            ? this.containerBounds.width - (this.isExport ? 0 : 5)
            : this.idealWidth
    }
    @computed get renderHeight() {
        return this.fitBounds
            ? this.containerBounds.height - (this.isExport ? 0 : 5)
            : this.idealHeight
    }

    @computed get controls(): Controls {
        const that = this
        return new Controls({
            get chart() {
                return that.props.chart
            },
            get chartView() {
                return that
            },
            get width() {
                return that.renderWidth
            }
        })
    }

    @computed get tabBounds() {
        return new Bounds(0, 0, this.renderWidth, this.renderHeight).padBottom(
            this.isExport ? 0 : this.controls.footerHeight
        )
    }

    @observable.shallow overlays: { [id: string]: ControlsOverlay } = {}

    @observable.ref popups: VNode[] = []

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable hasBeenVisible: boolean = false
    @observable hasError: boolean = false

    @computed get classNames(): string {
        const classNames = [
            "chart",
            this.isExport && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape",
            isTouchDevice() && "is-touch"
        ]

        return classNames.filter(n => !!n).join(" ")
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
        if (chart.primaryTab === "chart")
            return (
                <ChartTab
                    bounds={tabBounds}
                    chart={this.chart}
                    chartView={this}
                />
            )
        else if (chart.primaryTab === "map")
            return (
                <MapTab
                    bounds={tabBounds}
                    chart={this.chart}
                    chartView={this}
                />
            )
        else if (chart.primaryTab === "table")
            return <TableTab bounds={tabBounds} chart={chart} />
        else return undefined
    }

    renderOverlayTab(bounds: Bounds): JSX.Element | undefined {
        const { chart } = this
        if (chart.overlayTab === "sources")
            return <SourcesTab key="sourcesTab" bounds={bounds} chart={chart} />
        else if (chart.overlayTab === "download")
            return (
                <DownloadTab key="downloadTab" bounds={bounds} chart={chart} />
            )
        else return undefined
    }

    renderSVG() {
        return this.renderPrimaryTab()
    }

    renderReady() {
        const { tabBounds, chart } = this

        return (
            <React.Fragment>
                {this.hasBeenVisible && this.renderSVG()}
                <ControlsFooterView chart={chart} controls={this.controls} />
                {this.renderOverlayTab(tabBounds)}
                {this.popups}
                <TooltipView
                    width={this.renderWidth}
                    height={this.renderHeight}
                    tooltipContainer={this.chart}
                />
                {chart.isSelectingData && (
                    <EntitySelectorModal
                        key="entitySelector"
                        chart={chart}
                        isMobile={this.isMobile}
                        onDismiss={action(
                            () => (chart.isSelectingData = false)
                        )}
                    />
                )}
            </React.Fragment>
        )
    }

    renderError() {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    textAlign: "center",
                    lineHeight: 1.5,
                    padding: "3rem"
                }}
            >
                <p style={{ color: "#cc0000", fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> There was a
                    problem loading this chart
                </p>
                <p>
                    We have been notified of this error, please check back later
                    whether it's been fixed. If the error persists, get in touch
                    with us at{" "}
                    <a
                        href={`mailto:info@ourworldindata.org?subject=Broken chart on page ${window.location.href}`}
                    >
                        info@ourworldindata.org
                    </a>
                    .
                </p>
            </div>
        )
    }

    renderMain() {
        // TODO how to handle errors in exports?
        // TODO tidy this up
        if (this.isExport) {
            return this.renderSVG()
        } else {
            const { renderWidth, renderHeight } = this

            const style = {
                width: renderWidth,
                height: renderHeight,
                fontSize: this.chart.baseFontSize
            }

            return (
                <div ref={this.base} className={this.classNames} style={style}>
                    {this.hasError ? this.renderError() : this.renderReady()}
                </div>
            )
        }
    }

    render() {
        return (
            <ChartViewContext.Provider value={this.childContext}>
                {this.renderMain()}
            </ChartViewContext.Provider>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound checkVisibility() {
        if (!this.hasBeenVisible && isVisible(this.base.current)) {
            this.hasBeenVisible = true
        }
    }

    @action.bound setBaseFontSize() {
        if (this.renderWidth <= 400) this.props.chart.baseFontSize = 14
        else if (this.renderWidth < 1080) this.props.chart.baseFontSize = 16
        else if (this.renderWidth >= 1080) this.props.chart.baseFontSize = 18
    }

    @action.bound onUpdate() {
        // handler always runs on resize and resets the base font size
        this.setBaseFontSize()
        this.checkVisibility()
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    bindToWindow() {
        window.chartView = this
        window.chart = this.chart
        new UrlBinder().bindToWindow(this.chart.url)
        autorun(() => (document.title = this.chart.currentTitle))
    }

    componentDidMount() {
        window.addEventListener("scroll", this.checkVisibility)
        this.onUpdate()
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.checkVisibility)
        this.chart.dispose()
    }

    componentDidUpdate() {
        this.onUpdate()
    }

    componentDidCatch(error: any, info: any) {
        this.hasError = true
        Analytics.logChartError(error, info)
    }
}
