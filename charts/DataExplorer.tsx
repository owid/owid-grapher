import React from "react"
import { observer } from "mobx-react"
import { CommandPalette, Command } from "./CommandPalette"
import classNames from "classnames"
import { computed, action, observable } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Bounds } from "./Bounds"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { ChartView } from "./ChartView"
import moment from "moment"
import { CountryPicker } from "./CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import { ChartConfig } from "./ChartConfig"

@observer
export class DataExplorer extends React.Component<{
    explorerName: string
    controlPanels: JSX.Element[]
    chart: ChartConfig
    explorerShortName: string
    updated?: string
    subheaderElement: JSX.Element
    hideControls: boolean
    isEmbed: boolean
    selectedCountryCodes: Set<string>
}> {
    get keyboardShortcuts(): Command[] {
        return []
    }

    @computed get showExplorerControls() {
        return !this.props.hideControls || !this.props.isEmbed
    }

    @computed get howLongAgo() {
        return this.props.updated
            ? moment.utc(this.props.updated).fromNow()
            : ""
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

    get header() {
        const { explorerName, subheaderElement } = this.props
        return (
            <div className="DataExplorerHeaderBox">
                <div>{explorerName}</div>
                <div className="ExplorerTitle">Data Explorer</div>
                <div className="ExplorerLastUpdated" title={this.howLongAgo}>
                    {subheaderElement}
                </div>
            </div>
        )
    }

    get countryPicker() {
        return (
            <CountryPicker
                explorerName={this.props.explorerShortName}
                table={this.props.chart.table}
                isDropdownMenu={this.isMobile}
                selectedCountries={this.selectedEntityNames}
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
        this.toggleSelectedCountry(codeMap.get(countryName)!, value)
        this.selectionChangeFromBuilder = true
    }

    private selectionChangeFromBuilder = false

    @action.bound toggleSelectedCountry(code: string, value?: boolean) {
        const selectedCountryCodes = this.props.selectedCountryCodes
        if (value) {
            selectedCountryCodes.add(code)
        } else if (value === false) {
            selectedCountryCodes.delete(code)
        } else if (selectedCountryCodes.has(code)) {
            selectedCountryCodes.delete(code)
        } else {
            selectedCountryCodes.add(code)
        }
    }

    @action.bound clearSelectionCommand() {
        this.props.selectedCountryCodes.clear()
        this.selectionChangeFromBuilder = true
    }

    @computed get selectedEntityNames(): string[] {
        const entityCodeMap = this.props.chart.table.entityCodeToNameMap
        return Array.from(this.props.selectedCountryCodes.values())
            .map(code => entityCodeMap.get(code))
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
                    {this.showExplorerControls && this.header}
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
