import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { Grapher } from "grapher/core/Grapher"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { EntityPicker } from "grapher/controls/entityPicker/EntityPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import classNames from "classnames"
import { throttle } from "grapher/utils/Util"
import { EntityPickerManager } from "grapher/controls/entityPicker/EntityPickerConstants"
import { SelectionArray } from "grapher/core/SelectionArray"

interface ExplorerShellProps {
    explorerSlug: string
    controlPanels: JSX.Element[]
    headerElement: JSX.Element
    hideControls?: boolean
    entityPickerManager?: EntityPickerManager
    isEmbed: boolean
    enableKeyboardShortcuts?: boolean
    selectionArray: SelectionArray
}

@observer
export class ExplorerShell extends React.Component<ExplorerShellProps> {
    @computed private get showExplorerControls() {
        return !this.props.hideControls || !this.props.isEmbed
    }

    @action.bound private toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound private onResize() {
        this.isMobile = this._isMobile()
        this.chartBounds = this.getChartBounds() || this.chartBounds
    }

    private _isMobile() {
        return (
            window.screen.width < 450 ||
            document.documentElement.clientWidth <= 800
        )
    }

    @observable private chartContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable.ref private chartBounds = DEFAULT_BOUNDS

    // Todo: add better logic to maximize the size of the chart
    private getChartBounds() {
        const chartContainer = this.chartContainerRef.current
        if (!chartContainer) return undefined
        return new Bounds(
            0,
            0,
            chartContainer.clientWidth,
            chartContainer.clientHeight
        )
    }

    @observable private isMobile = this._isMobile()

    @observable private showMobileControlsPopup = false

    private get customizeChartMobileButton() {
        return this.isMobile ? (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> Customize chart
            </a>
        ) : undefined
    }

    private get controlBar() {
        return (
            <ExplorerControlBar
                isMobile={this.isMobile}
                showControls={this.showMobileControlsPopup}
                closeControls={this.closeControls}
            >
                {this.props.controlPanels}
            </ExplorerControlBar>
        )
    }

    @action.bound private closeControls() {
        this.showMobileControlsPopup = false
    }

    componentDidMount() {
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize() // call resize for the first time to initialize chart
    }

    componentWillUnmount() {
        if (this.onResizeThrottled)
            window.removeEventListener("resize", this.onResizeThrottled)
    }

    private onResizeThrottled?: () => void

    @observable.ref grapherRef: React.RefObject<Grapher> = React.createRef()

    private renderEntityPicker() {
        return (
            <EntityPicker
                key="entityPicker"
                manager={this.props.entityPickerManager}
                isDropdownMenu={this.isMobile}
            />
        )
    }

    render() {
        return (
            <>
                <div
                    className={classNames({
                        Explorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !this.showExplorerControls,
                        "is-embed": this.props.isEmbed,
                    })}
                >
                    {this.showExplorerControls && (
                        <div className="ExplorerHeaderBox">
                            {this.props.headerElement}
                        </div>
                    )}
                    {this.showExplorerControls && this.controlBar}
                    {this.showExplorerControls && this.renderEntityPicker()}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
                    <div
                        className="ExplorerFigure"
                        ref={this.chartContainerRef}
                    >
                        <Grapher
                            bounds={this.chartBounds}
                            isEmbed={true}
                            selectionArray={this.props.selectionArray}
                            ref={this.grapherRef}
                            enableKeyboardShortcuts={
                                this.props.enableKeyboardShortcuts
                            }
                        />
                    </div>
                </div>
            </>
        )
    }
}
