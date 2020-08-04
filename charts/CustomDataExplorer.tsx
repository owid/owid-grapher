import React from "react"
import { observer } from "mobx-react"
import { DataExplorer } from "./DataExplorer"
import { ChartConfigProps, ChartConfig } from "./ChartConfig"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "./ExplorerControls"
import { ChartQueryParams } from "./ChartUrl"

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

        this.lastId = newId
        return this._chart!
    }

    get changedParams(): ChartQueryParams {
        return this._chart?.url.params || {}
    }

    private _chart?: ChartConfig = undefined
    private lastId = 0

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

        return (
            <DataExplorer
                headerElement={headerElement}
                controlPanels={panels}
                explorerName={explorerName}
                chart={this.chart}
                hideControls={false}
                isEmbed={false}
                selectedCountryCodes={new Set()}
            />
        )
    }
}
