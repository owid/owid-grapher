import React from "react"
import { observer } from "mobx-react"
import { observable } from "mobx"
import { DataExplorer } from "./DataExplorer"
import { ChartConfigProps, ChartConfig } from "./ChartConfig"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "./ExplorerControls"
import { ChartQueryParams } from "./ChartUrl"

declare type chartId = number

@observer
export class CustomDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    explorerConfig: any
    explorerName: string
}> {
    get chart() {
        const newId = this.switcherOptions.chartId
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

    @observable switcherConfig = this.props.explorerConfig
    @observable switcherOptions = new SwitcherOptions(this.switcherConfig, "")

    render() {
        const { explorerName } = this.props
        const panels = this.switcherOptions.groups.map(group => (
            <ExplorerControlPanel
                title={group.title}
                explorerName={this.props.explorerName}
                name={group.title}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={value => {
                    this.switcherOptions.setValue(group.title, value)
                }}
            />
        ))

        return (
            <DataExplorer
                subheaderElement={<span></span>}
                controlPanels={panels}
                explorerName={explorerName}
                chart={this.chart}
                explorerShortName={"foo"}
                hideControls={false}
                isEmbed={false}
                selectedCountryCodes={new Set()}
            />
        )
    }
}
