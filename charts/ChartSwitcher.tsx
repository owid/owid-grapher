import { observer } from "mobx-react"
import React from "react"
import { observable, computed, action, autorun } from "mobx"
import { ChartView } from "./ChartView"
import { Bounds } from "./Bounds"
import { ChartConfig, ChartConfigProps } from "./ChartConfig"
import { ExplorerControlBar, ExplorerControlPanel } from "./ExplorerControls"
import { SwitcherOptions } from "./SwitcherOptions"
import { HotTable } from "@handsontable/react"
import { toJsTable, parseDelimited } from "./Util"

interface ChartWithId extends ChartConfig {
    id: number
}

const defaultConfig = `chartId,Device
35,Internet
46,Mobile`

@observer
class SwitcherPanel extends React.Component<{
    explorerName: string
    options: SwitcherOptions
}> {
    render() {
        const subpanels = this.props.options.groups.map(group => (
            <ExplorerControlPanel
                title={group.title}
                explorerName={this.props.explorerName}
                name={group.title}
                options={group.options}
                isCheckbox={group.isCheckbox}
                onChange={value => {
                    this.props.options.setValue(group.title, value)
                }}
            />
        ))
        return (
            <ExplorerControlBar
                isMobile={false}
                showControls={false}
                closeControls={() => {}}
            >
                {subpanels}
            </ExplorerControlBar>
        )
    }
}

@observer
export class ChartSwitcher extends React.Component<{
    charts?: ChartWithId[]
    csvConfig?: any
}> {
    @computed get chart() {
        return new ChartConfig(this.chartProps)
    }

    @action.bound async fetchChartConfig(chartId: number) {
        // const charts = this.props.charts || []
        if (!chartId) return new ChartConfigProps()
        const response = await fetch(`/admin/api/charts/${chartId}.config.json`)
        const config = await response.json()
        this.chartProps = config
        return config
    }

    @observable chartProps: ChartConfigProps = new ChartConfigProps()

    componentDidMount() {
        autorun(() => this.fetchChartConfig(this.options.chartId))
    }

    @observable csvConfig = this.props.csvConfig || defaultConfig
    @observable options = new SwitcherOptions(this.csvConfig, "")

    @action.bound updateConfig() {
        const newVersion = this.hotTableComponent.current?.hotInstance.getData()
        if (newVersion) {
            const tsv = newVersion
                .map(row =>
                    row
                        .map((cell: any) => (cell === null ? "" : cell))
                        .join(",")
                )
                .join("\n")
            this.csvConfig = tsv
            this.options = new SwitcherOptions(tsv, "")
        }
    }

    hotTableComponent = React.createRef<HotTable>()

    render() {
        const width = 800
        const bounds = new Bounds(0, 0, width, 600)
        const data = toJsTable(parseDelimited(this.csvConfig))

        this.hotTableComponent = React.createRef<HotTable>()
        return (
            <div>
                <div style={{ width: `${width}px` }}>
                    <SwitcherPanel explorerName="co2" options={this.options} />
                    <br />
                    <ChartView bounds={bounds} chart={this.chart} />
                </div>
                <br />
                <HotTable
                    data={data}
                    colHeaders={false}
                    contextMenu={true}
                    allowInsertRow={true}
                    allowInsertColumn={true}
                    minCols={8}
                    minRows={20}
                    ref={this.hotTableComponent as any}
                    rowHeaders={true}
                    afterChange={() => this.updateConfig()}
                    licenseKey={"non-commercial-and-evaluation"}
                />
                <br />
            </div>
        )
    }
}
