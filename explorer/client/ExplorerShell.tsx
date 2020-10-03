import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { Grapher } from "grapher/core/Grapher"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { CountryPicker } from "grapher/controls/CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import classNames from "classnames"
import { throttle } from "grapher/utils/Util"
import { OwidTable } from "coreTable/OwidTable"

// TODO: Migrate CovidExplorer to use this class as well
@observer
export class ExplorerShell extends React.Component<{
    explorerSlug: string
    controlPanels: JSX.Element[]
    headerElement: JSX.Element
    hideControls?: boolean
    countryPickerTable: OwidTable
    isEmbed: boolean
}> {
    @computed get showExplorerControls() {
        return !this.props.hideControls || !this.props.isEmbed
    }

    @action.bound toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound onResize() {
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

    @observable.ref chartBounds = DEFAULT_BOUNDS

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

    @observable isMobile = this._isMobile()

    @observable showMobileControlsPopup = false

    get customizeChartMobileButton() {
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

    @computed get countryPickerTable() {
        return this.props.countryPickerTable
    }

    get countryPicker() {
        return (
            <CountryPicker
                explorerSlug={this.props.explorerSlug}
                table={this.countryPickerTable}
                isDropdownMenu={this.isMobile}
            ></CountryPicker>
        )
    }

    get controlBar() {
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

    @action.bound closeControls() {
        this.showMobileControlsPopup = false
    }

    componentDidMount() {
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize()
    }

    componentWillUnmount() {
        if (this.onResizeThrottled) {
            window.removeEventListener("resize", this.onResizeThrottled)
        }
    }

    onResizeThrottled?: () => void

    @observable.ref grapherRef: React.RefObject<Grapher> = React.createRef()

    render() {
        return (
            <>
                <div
                    className={classNames({
                        CovidExplorer: true,
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
                    {this.showExplorerControls && this.countryPicker}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
                    <div
                        className="CovidExplorerFigure"
                        ref={this.chartContainerRef}
                    >
                        <Grapher
                            bounds={this.chartBounds}
                            isEmbed={true}
                            ref={this.grapherRef}
                        />
                    </div>
                </div>
            </>
        )
    }
}
