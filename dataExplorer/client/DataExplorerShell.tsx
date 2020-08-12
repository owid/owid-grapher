import { computed, action, observable } from "mobx"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "charts/ChartUrl"
import { observer } from "mobx-react"
import React from "react"
import { ChartConfig } from "charts/ChartConfig"
import { Command, CommandPalette } from "charts/CommandPalette"
import { Bounds } from "charts/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { CountryPicker } from "charts/CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import { throttle } from "lodash"
import classNames from "classnames"
import { ChartView } from "charts/ChartView"

export class DataExplorerQueryParams {
    hideControls: boolean = false
    @observable selectedCountryCodes: Set<string> = new Set<string>()

    constructor(queryString: string) {
        const obj = strToQueryParams(queryString)
        this.hideControls = obj.hideControls === "true"

        if (obj.country) {
            EntityUrlBuilder.queryParamToEntities(obj.country).forEach(code =>
                this.selectedCountryCodes.add(code)
            )
        }
    }

    @computed get toParams(): QueryParams {
        const params: any = {}
        params.hideControls = this.hideControls ? true : undefined
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            Array.from(this.selectedCountryCodes)
        )
        return params as QueryParams
    }
}

// TODO: Migrate CovidExplorer to use this class as well
@observer
export class DataExplorerShell extends React.Component<{
    explorerName: string
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
                explorerName={this.props.explorerName}
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
        const code = codeMap.get(countryName)!
        const selectedCountryCodes = this.props.params.selectedCountryCodes
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
        this.props.params.selectedCountryCodes.clear()
    }

    @computed get selectedEntityNames(): string[] {
        const entityCodeMap = this.props.chart.table.entityCodeToNameMap
        return Array.from(this.props.params.selectedCountryCodes.values())
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
