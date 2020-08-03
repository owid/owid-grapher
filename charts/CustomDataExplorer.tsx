import React from "react"
import { observer } from "mobx-react"
import { computed, action, observable, autorun } from "mobx"
import { DataExplorer } from "./DataExplorer"
import { ChartConfigProps, ChartConfig } from "./ChartConfig"
import { SwitcherOptions } from "./SwitcherOptions"
import { ExplorerControlPanel } from "./ExplorerControls"

declare type chartId = number

@observer
export class CustomDataExplorer extends React.Component<{
    chartConfigs: Map<chartId, ChartConfigProps>
    explorerConfig: any
    explorerName: string
}> {
    @computed get chart() {
        return new ChartConfig(
            this.props.chartConfigs.get(this.switcherOptions.chartId) ||
                new ChartConfigProps()
        )
    }

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
