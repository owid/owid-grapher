import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, action, autorun } from "mobx"
import { observer } from "mobx-react"
import "d3-transition"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"

import { Grapher } from "grapher/core/Grapher"
import { ControlsFooterView } from "grapher/controls/Controls"
import { ControlsOverlay } from "grapher/controls/ControlsOverlay"
import { ChartTab, ChartTabOptionsProvider } from "grapher/chart/ChartTab"
import { SourcesTab } from "grapher/sourcesTab/SourcesTab"
import { DownloadTab } from "grapher/downloadTab/DownloadTab"
import {
    VNode,
    throttle,
    isMobile,
    isTouchDevice,
    max,
} from "grapher/utils/Util"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { EntitySelectorModal } from "grapher/controls/EntitySelectorModal"
import {
    GrapherViewContext,
    GrapherViewContextInterface,
} from "grapher/core/GrapherViewContext"
import { TooltipView } from "grapher/tooltip/Tooltip"
import { UrlBinder } from "grapher/utils/UrlBinder"
import { GlobalEntitySelection } from "site/globalEntityControl/GlobalEntitySelection"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { DataTable } from "grapher/dataTable/DataTable"
import { OverlayPadding } from "./GrapherConstants"

declare const window: any

interface GrapherViewProps {
    bounds?: Bounds
    grapher: Grapher
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
export class GrapherView
    extends React.Component<GrapherViewProps>
    implements ChartTabOptionsProvider {
    static bootstrap({
        jsonConfig,
        containerNode,
        isEditor,
        isEmbed,
        queryStr,
        globalEntitySelection,
    }: {
        jsonConfig: GrapherInterface
        containerNode: HTMLElement
        isEditor?: boolean
        isEmbed?: true
        queryStr?: string
        globalEntitySelection?: GlobalEntitySelection
    }) {
        let view
        const grapher = new Grapher(jsonConfig, {
            isEmbed: isEmbed,
            queryStr: queryStr,
            globalEntitySelection: globalEntitySelection,
        })

        function render() {
            const rect = containerNode.getBoundingClientRect()
            const containerBounds = Bounds.fromRect(rect)
            view = ReactDOM.render(
                <GrapherView
                    bounds={containerBounds}
                    grapher={grapher}
                    isEditor={isEditor}
                    isEmbed={isEmbed}
                />,
                containerNode
            )
        }

        render()
        window.addEventListener("resize", throttle(render))

        return view
    }

    @computed get grapher() {
        return this.props.grapher
    }

    @computed private get isExport() {
        return !!this.props.isExport
    }
    @computed private get isEditor() {
        return !!this.props.isEditor
    }
    @computed private get isEmbed() {
        return (
            this.props.isEmbed ||
            (!this.isExport && (window.self !== window.top || this.isEditor))
        )
    }
    @computed get isMobile() {
        return isMobile()
    }

    @computed private get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get isPortrait() {
        return this.bounds.width < this.bounds.height && this.bounds.width < 850
    }
    @computed private get isLandscape() {
        return !this.isPortrait
    }

    @computed private get authorWidth() {
        return this.isPortrait ? 400 : 680
    }
    @computed private get authorHeight() {
        return this.isPortrait ? 640 : 480
    }

    // If the available space is very small, we use all of the space given to us
    @computed private get fitBounds() {
        const {
            isEditor,
            isEmbed,
            isExport,
            bounds,
            authorWidth,
            authorHeight,
        } = this

        if (isEditor) return false

        return (
            isEmbed ||
            isExport ||
            bounds.height < authorHeight ||
            bounds.width < authorWidth
        )
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed private get paddedWidth() {
        return this.isPortrait
            ? this.bounds.width * 0.95
            : this.bounds.width * 0.95
    }
    @computed private get paddedHeight() {
        return this.isPortrait
            ? this.bounds.height * 0.95
            : this.bounds.height * 0.95
    }
    @computed private get scaleToFitIdeal() {
        return Math.min(
            this.paddedWidth / this.authorWidth,
            this.paddedHeight / this.authorHeight
        )
    }
    @computed private get idealWidth() {
        return this.authorWidth * this.scaleToFitIdeal
    }
    @computed private get idealHeight() {
        return this.authorHeight * this.scaleToFitIdeal
    }

    // These are the final render dimensions
    @computed private get renderWidth() {
        return this.fitBounds
            ? this.bounds.width - (this.isExport ? 0 : 5)
            : this.idealWidth
    }
    @computed private get renderHeight() {
        return this.fitBounds
            ? this.bounds.height - (this.isExport ? 0 : 5)
            : this.idealHeight
    }

    @computed private get tabBounds() {
        return new Bounds(0, 0, this.renderWidth, this.renderHeight).padBottom(
            this.isExport ? 0 : this.footerHeight
        )
    }

    @observable.shallow overlays: { [id: string]: ControlsOverlay } = {}

    @observable.ref private popups: VNode[] = []

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get containerElement() {
        return this.base.current || undefined
    }

    @observable private hasBeenVisible = false
    @observable private hasError = false

    @computed private get classNames() {
        const classNames = [
            "chart",
            this.isExport && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape",
            isTouchDevice() && "is-touch",
        ]

        return classNames.filter((n) => !!n).join(" ")
    }

    addPopup(vnode: VNode) {
        this.popups = this.popups.concat([vnode])
    }

    removePopup(vnodeType: any) {
        this.popups = this.popups.filter((d) => !(d.type === vnodeType))
    }

    get childContext(): GrapherViewContextInterface {
        return {
            grapher: this.grapher,
            grapherView: this,
            baseFontSize: this.grapher.baseFontSize,
            isStatic: this.isExport,
            addPopup: this.addPopup.bind(this),
            removePopup: this.removePopup.bind(this),
        }
    }

    private renderPrimaryTab() {
        const { grapher, tabBounds } = this
        if (grapher.primaryTab === "chart" || grapher.primaryTab === "map")
            return (
                <ChartTab
                    bounds={tabBounds}
                    grapher={this.grapher}
                    options={this}
                />
            )

        if (grapher.primaryTab === "table")
            return <DataTable bounds={tabBounds} options={grapher} />

        return undefined
    }

    private renderOverlayTab(bounds: Bounds) {
        const { grapher } = this
        if (grapher.overlayTab === "sources")
            return (
                <SourcesTab
                    key="sourcesTab"
                    bounds={bounds}
                    grapher={grapher}
                />
            )
        else if (grapher.overlayTab === "download")
            return (
                <DownloadTab
                    key="downloadTab"
                    bounds={bounds}
                    grapher={grapher}
                />
            )
        return undefined
    }

    private renderSVG() {
        return this.renderPrimaryTab()
    }

    private renderReady() {
        const { tabBounds, grapher } = this

        return (
            <React.Fragment>
                {this.hasBeenVisible && this.renderSVG()}
                <ControlsFooterView grapherView={this} />
                {this.renderOverlayTab(tabBounds)}
                {this.popups}
                <TooltipView
                    width={this.renderWidth}
                    height={this.renderHeight}
                    tooltipProvider={this.grapher}
                />
                {grapher.isSelectingData && (
                    <EntitySelectorModal
                        key="entitySelector"
                        grapher={grapher}
                        isMobile={this.isMobile}
                        onDismiss={action(
                            () => (grapher.isSelectingData = false)
                        )}
                    />
                )}
            </React.Fragment>
        )
    }

    private renderError() {
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
                    padding: "3rem",
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

    private renderMain() {
        // TODO how to handle errors in exports?
        // TODO tidy this up
        if (this.isExport) return this.renderSVG()

        const { renderWidth, renderHeight } = this

        const style = {
            width: renderWidth,
            height: renderHeight,
            fontSize: this.grapher.baseFontSize,
        }

        return (
            <div ref={this.base} className={this.classNames} style={style}>
                {this.hasError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    render() {
        return (
            <GrapherViewContext.Provider value={this.childContext}>
                {this.renderMain()}
            </GrapherViewContext.Provider>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private checkVisibility() {
        if (!this.hasBeenVisible && isVisible(this.base.current))
            this.hasBeenVisible = true
    }

    @action.bound private setBaseFontSize() {
        if (this.renderWidth <= 400) this.props.grapher.baseFontSize = 14
        else if (this.renderWidth < 1080) this.props.grapher.baseFontSize = 16
        else if (this.renderWidth >= 1080) this.props.grapher.baseFontSize = 18
    }

    @action.bound private onUpdate() {
        // handler always runs on resize and resets the base font size
        this.setBaseFontSize()
        this.checkVisibility()
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    bindToWindow() {
        window.grapherView = this
        window.grapher = this.grapher
        new UrlBinder().bindToWindow(this.grapher.url)
        autorun(() => (document.title = this.grapher.currentTitle))
    }

    componentDidMount() {
        window.addEventListener("scroll", this.checkVisibility)
        this.onUpdate()
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.checkVisibility)
        this.grapher.dispose()
    }

    componentDidUpdate() {
        this.onUpdate()
    }

    componentDidCatch(error: any, info: any) {
        this.hasError = true
        this.grapher.analytics.logChartError(error, info)
    }

    @observable isShareMenuActive = false

    @computed.struct get overlayPadding(): OverlayPadding {
        const overlays = Object.values(this.overlays)
        return {
            top: max(overlays.map((overlay) => overlay.props.paddingTop)) ?? 0,
            right:
                max(overlays.map((overlay) => overlay.props.paddingRight)) ?? 0,
            bottom:
                max(overlays.map((overlay) => overlay.props.paddingBottom)) ??
                0,
            left:
                max(overlays.map((overlay) => overlay.props.paddingLeft)) ?? 0,
        }
    }

    @computed get hasTimeline() {
        const grapher = this.grapher
        if (grapher.hideTimeline) return false

        if (grapher.currentTab === "table") return true

        if (grapher.currentTab === "map") return grapher.mapHasTimeline

        if (grapher.currentTab !== "chart") return false

        return grapher.hasTimeline
    }

    @computed get hasInlineControls() {
        const grapher = this.grapher
        return (
            (grapher.currentTab === "chart" ||
                grapher.currentTab === "table") &&
            ((grapher.canAddData && !grapher.hasFloatingAddButton) ||
                grapher.isScatter ||
                grapher.canChangeEntity ||
                (grapher.isStackedArea && grapher.canToggleRelativeMode))
        )
    }

    @computed get hasSpace() {
        return this.renderWidth > 700
    }

    @computed get hasRelatedQuestion() {
        const { relatedQuestions } = this.props.grapher
        return (
            !!relatedQuestions &&
            !!relatedQuestions.length &&
            !!relatedQuestions[0].text &&
            !!relatedQuestions[0].url
        )
    }

    @computed private get footerLines() {
        let numLines = 1
        if (this.hasTimeline) numLines += 1
        if (this.hasInlineControls) numLines += 1
        if (this.hasSpace && this.hasInlineControls && numLines > 1)
            numLines -= 1
        return numLines
    }

    @computed get footerHeight() {
        const footerRowHeight = 32 // todo: cleanup. needs to keep in sync with grapher.scss' $footerRowHeight
        return (
            this.footerLines * footerRowHeight +
            (this.hasRelatedQuestion ? 20 : 0)
        )
    }
}
