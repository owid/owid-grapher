import React from "react"
import { observer } from "mobx-react"
import { action, observable, when, reaction } from "mobx"
import { ChartConfig, ChartConfigProps } from "charts/ChartConfig"
import { uniq } from "charts/Util"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "dataExplorer/client/ExplorerControls"
import { ChartQueryParams, ExtendedChartUrl } from "charts/ChartUrl"
import ReactDOM from "react-dom"
import { UrlBinder } from "charts/UrlBinder"
import { DataExplorerQueryParams, DataExplorerShell } from "./DataExplorerShell"

declare type chartId = number

export interface SwitcherBootstrapProps {
    title: string
    slug: string
    switcherCode: string
    chartConfigs: ChartConfigProps[]
    bindToWindow: boolean
}

@observer
export class SwitcherDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    switcher: SwitcherOptions
    queryString: string
    explorerNamespace: string
    explorerTitle: string
    bindToWindow: boolean
}> {
    static bootstrap(props: SwitcherBootstrapProps) {
        const { chartConfigs, switcherCode, title, bindToWindow } = props
        const containerId = "dataExplorerContainer"
        const containerNode = document.getElementById(containerId)
        const queryString = window.location.search

        const switcher = new SwitcherOptions(switcherCode, queryString)

        const chartConfigsMap: Map<number, ChartConfigProps> = new Map()
        chartConfigs.forEach(config => chartConfigsMap.set(config.id!, config))

        return ReactDOM.render(
            <SwitcherDataExplorer
                queryString={queryString}
                chartConfigs={chartConfigsMap}
                explorerNamespace="explorer"
                explorerTitle={title}
                switcher={switcher}
                bindToWindow={bindToWindow}
            />,
            containerNode
        )
    }

    urlBinding?: UrlBinder

    bindToWindow() {
        const url = new ExtendedChartUrl(this._chart!.url, [
            this.props.switcher.toParams,
            this.userOptions.toParams
        ])

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()

        this.urlBinding.bindToWindow(url)
        const win = window as any
        win.switcherDataExplorer = this
    }

    componentWillMount() {
        // todo: add disposer
        reaction(() => this.props.switcher.chartId, this.updateChart, {
            fireImmediately: true
        })
    }

    @action.bound updateChart() {
        const newId: number = this.props.switcher.chartId
        if (newId === this.lastId) return

        const params = this.changedParams
        const props =
            this.props.chartConfigs.get(newId) || new ChartConfigProps()

        this._chart = new ChartConfig(props)
        this._chart.url.populateFromQueryParams(params)

        if (this.props.bindToWindow) this.bindToWindow()

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

    @observable userOptions = new DataExplorerQueryParams(
        this.props.queryString
    )

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
