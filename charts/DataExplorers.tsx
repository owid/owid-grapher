import React from "react"
import { observer } from "mobx-react"
import { CommandPalette, Command } from "./CommandPalette"
import classNames from "classnames"
import { computed, action, observable, when, reaction } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Bounds } from "./Bounds"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { ChartView } from "./ChartView"
import { CountryPicker } from "./CountryPicker"
import { ExplorerControlBar } from "./ExplorerControls"
import { ChartConfig, ChartConfigProps } from "./ChartConfig"
import { throttle, uniq } from "./Util"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "./ExplorerControls"
import { ChartQueryParams } from "./ChartUrl"
import ReactDOM from "react-dom"

interface DataExplorerOptions {
    hideControls: boolean
    selectedCountryCodes: Set<string>
}

declare type chartId = number

// TODO: Migrate CovidExplorer to use this class as well
@observer
class DataExplorerShell extends React.Component<{
    explorerName: string
    controlPanels: JSX.Element[]
    chart: ChartConfig
    availableEntities: string[]
    headerElement: JSX.Element
    params: DataExplorerOptions
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

        this.selectionChangeFromBuilder = true
    }

    private selectionChangeFromBuilder = false

    @action.bound clearSelectionCommand() {
        this.props.params.selectedCountryCodes.clear()
        this.selectionChangeFromBuilder = true
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

@observer
export class SwitcherDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    switcher: SwitcherOptions
    explorerNamespace: string
    explorerTitle: string
}> {
    static bootstrap(
        containerNode: HTMLElement,
        chartConfigs: ChartConfigProps[],
        switcherCode: string,
        title: string
    ) {
        const switcher = new SwitcherOptions(switcherCode, "")

        const chartConfigsMap: Map<number, ChartConfigProps> = new Map()
        chartConfigs.forEach(config => chartConfigsMap.set(config.id!, config))

        const view = ReactDOM.render(
            <SwitcherDataExplorer
                chartConfigs={chartConfigsMap}
                explorerNamespace="explorer"
                explorerTitle={title}
                switcher={switcher}
            />,
            containerNode
        )
    }

    componentWillMount() {
        reaction(() => this.props.switcher.chartId, this.updateChart, {
            fireImmediately: true
        })

        const win = window as any
        win.switcherDataExplorer = this
    }

    @action.bound updateChart() {
        const newId: number = this.props.switcher.chartId
        if (newId === this.lastId) return

        const params = this.changedParams
        const props =
            this.props.chartConfigs.get(newId) || new ChartConfigProps()

        this._chart = new ChartConfig(props)
        this._chart.url.populateFromQueryParams(params)

        when(
            () => this._chart!.isReady,
            () => {
                this.availableEntities = uniq([
                    ...this.availableEntities,
                    ...this._chart!.table.availableEntities
                ]).sort()

                this._chart!.props.selectedData = this.selectedData
            }
        )

        this.lastId = newId
    }

    private get selectedData() {
        const table = this._chart!.table
        const countryCodeMap = table.entityCodeToNameMap
        const entityIdMap = table.entityNameToIdMap
        return Array.from(this.userOptions.selectedCountryCodes)
            .map(code => countryCodeMap.get(code))
            .filter(i => i)
            .map(countryOption => {
                return {
                    index: 0,
                    entityId: countryOption
                        ? entityIdMap.get(countryOption)!
                        : 0
                }
            })
    }

    get changedParams(): ChartQueryParams {
        return this._chart?.url.params || {}
    }

    @observable private _chart?: ChartConfig = undefined
    private lastId = 0

    @observable availableEntities: string[] = []

    get panels() {
        return this.props.switcher.groups.map(group => (
            <ExplorerControlPanel
                key={group.title}
                title={group.title}
                explorerName={this.props.explorerNamespace}
                name={group.title}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={value => {
                    this.props.switcher.setValue(group.title, value)
                }}
            />
        ))
    }

    get header() {
        return (
            <>
                <div></div>
                <div className="ExplorerTitle">{this.props.explorerTitle}</div>
                <div className="ExplorerLastUpdated"></div>
            </>
        )
    }

    @observable userOptions: DataExplorerOptions = {
        hideControls: false,
        selectedCountryCodes: new Set()
    }

    render() {
        return (
            <DataExplorerShell
                headerElement={this.header}
                controlPanels={this.panels}
                explorerName={this.props.explorerNamespace}
                availableEntities={this.availableEntities}
                chart={this._chart!}
                params={this.userOptions}
                isEmbed={false}
            />
        )
    }
}
