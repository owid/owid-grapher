import React from "react"
import { observer } from "mobx-react"
import { DataExplorer, DataExplorerOptions } from "./DataExplorer"
import { ChartConfigProps, ChartConfig } from "./ChartConfig"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "./ExplorerControls"
import { ChartQueryParams } from "./ChartUrl"
import { observable, when } from "mobx"
import { uniq } from "./Util"

declare type chartId = number

@observer
export class CustomDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    switcher: SwitcherOptions
    explorerNamespace: string
    explorerTitle: string
}> {
    get chart() {
        const newId = this.props.switcher.chartId
        if (newId === this.lastId) return this._chart!

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
        return this._chart!
    }

    private get selectedData() {
        const countryCodeMap = this.chart.table.entityCodeToNameMap
        const entityIdMap = this.chart.table.entityNameToIdMap
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

    private _chart?: ChartConfig = undefined
    private lastId = 0

    @observable availableEntities: string[] = []

    get panels() {
        return this.props.switcher.groups.map(group => (
            <ExplorerControlPanel
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
            <DataExplorer
                headerElement={this.header}
                controlPanels={this.panels}
                explorerName={this.props.explorerNamespace}
                availableEntities={this.availableEntities}
                chart={this.chart}
                params={this.userOptions}
                isEmbed={false}
            />
        )
    }
}
