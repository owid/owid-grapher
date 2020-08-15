import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartConfig } from "charts/ChartConfig"
import { Command, CommandPalette } from "charts/CommandPalette"
import { Bounds } from "charts/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { CountryPicker } from "charts/CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import classNames from "classnames"
import { ChartView } from "charts/ChartView"
import { DataExplorerQueryParams } from "./ExplorerProgram"
import { throttle } from "charts/Util"

// TODO: Migrate CovidExplorer to use this class as well
@observer
export class ExplorerShell extends React.Component<{
    explorerSlug: string
    controlPanels: JSX.Element[]
    chart: ChartConfig
    availableEntities: string[]
    headerElement: JSX.Element
    params: DataExplorerQueryParams
    isEmbed: boolean
}> {
    get keyboardShortcuts(): Command[] {
        return []
    }

    @computed get showExplorerControls() {
        return !this.props.params.hideControls || !this.props.isEmbed
    }

    @action.bound toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound onResize() {
        this.isMobile = this._isMobile()
        this.chartBounds = this.getChartBounds()
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

    @observable.ref chartBounds: Bounds | undefined = undefined

    // Todo: add better logic to maximize the size of the chart
    private getChartBounds(): Bounds | undefined {
        const chartContainer = this.chartContainerRef.current
        if (!chartContainer) return undefined
        return new Bounds(
            0,
            0,
            chartContainer.clientWidth,
            chartContainer.clientHeight
        )
    }

    @observable isMobile: boolean = this._isMobile()

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
        ) : (
            undefined
        )
    }

    get countryPicker() {
        return (
            <CountryPicker
                explorerSlug={this.props.explorerSlug}
                table={this.props.chart.table}
                isDropdownMenu={this.isMobile}
                availableEntities={this.props.availableEntities}
                selectedEntities={this.selectedEntityNames}
                clearSelectionCommand={this.clearSelectionCommand}
                toggleCountryCommand={this.toggleSelectedCountryCommand}
            ></CountryPicker>
        )
    }

    @action.bound toggleSelectedCountryCommand(
        countryName: string,
        value?: boolean
    ) {
        const codeMap = this.props.chart.table.entityNameToCodeMap
        const code = codeMap.get(countryName)! || countryName
        const selectedCountryCodesOrNames = this.props.params
            .selectedCountryCodesOrNames
        if (value) {
            selectedCountryCodesOrNames.add(code)
        } else if (value === false) {
            selectedCountryCodesOrNames.delete(code)
        } else if (selectedCountryCodesOrNames.has(code)) {
            selectedCountryCodesOrNames.delete(code)
        } else {
            selectedCountryCodesOrNames.add(code)
        }
    }

    @action.bound clearSelectionCommand() {
        this.props.params.selectedCountryCodesOrNames.clear()
    }

    @computed get selectedEntityNames(): string[] {
        const entityCodeMap = this.props.chart.table.entityCodeToNameMap
        return Array.from(
            this.props.params.selectedCountryCodesOrNames.values()
        )
            .map(code => entityCodeMap.get(code) || code)
            .filter(i => i) as string[]
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

    render() {
        return (
            <>
                <CommandPalette
                    commands={this.keyboardShortcuts}
                    display="none"
                />
                <div
                    className={classNames({
                        CovidDataExplorer: true,
                        "mobile-explorer": this.isMobile,
                        HideControls: !this.showExplorerControls,
                        "is-embed": this.props.isEmbed
                    })}
                >
                    {this.showExplorerControls && (
                        <div className="DataExplorerHeaderBox">
                            {this.props.headerElement}
                        </div>
                    )}
                    {this.showExplorerControls && this.controlBar}
                    {this.showExplorerControls && this.countryPicker}
                    {this.showExplorerControls &&
                        this.customizeChartMobileButton}
                    <div
                        className="CovidDataExplorerFigure"
                        ref={this.chartContainerRef}
                    >
                        {this.chartBounds && (
                            <ChartView
                                bounds={this.chartBounds}
                                chart={this.props.chart}
                                isEmbed={true}
                            ></ChartView>
                        )}
                    </div>
                </div>
            </>
        )
    }
}
