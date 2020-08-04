import React from "react"
import { observer } from "mobx-react"
import { DataExplorer, DataExplorerParams } from "./DataExplorer"
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
            () =>
                (this.availableEntities = uniq([
                    ...this.availableEntities,
                    ...this._chart!.table.availableEntities
                ]))
        )

        this.lastId = newId
        return this._chart!
    }

    get changedParams(): ChartQueryParams {
        return this._chart?.url.params || {}
    }

    private _chart?: ChartConfig = undefined
    private lastId = 0

    @observable availableEntities: string[] = []

    render() {
        const { explorerNamespace: explorerName, explorerTitle } = this.props
        const panels = this.props.switcher.groups.map(group => (
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

        const headerElement = (
            <>
                <div></div>
                <div className="ExplorerTitle">{explorerTitle}</div>
                <div className="ExplorerLastUpdated"></div>
            </>
        )

        const params: DataExplorerParams = {
            hideControls: false,
            selectedCountryCodes: new Set()
        }

        return (
            <DataExplorer
                headerElement={headerElement}
                controlPanels={panels}
                explorerName={explorerName}
                availableEntities={this.availableEntities}
                chart={this.chart}
                params={params}
                isEmbed={false}
            />
        )
    }
}
