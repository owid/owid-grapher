import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "./AdminLayout"
import { AdminAppContextType, AdminAppContext } from "./AdminAppContext"
import { SwitcherDataExplorer } from "charts/DataExplorers"
import { HotTable } from "@handsontable/react"
import { action, observable, computed, autorun } from "mobx"
import { ChartConfigProps } from "charts/ChartConfig"
import { parseDelimited, toJsTable } from "charts/Util"
import { SwitcherOptions } from "charts/SwitcherOptions"
import Draggable from "react-draggable"
import { faArrowsAlt } from "@fortawesome/free-solid-svg-icons/faArrowsAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import classNames from "classnames"

const defaultConfig = `chartId,Device
35,Internet
46,Mobile`

@observer
export class ExplorerCreatePage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    componentDidMount() {
        this.context.admin.showLoadingIndicator = false
        this.updateConfig()
    }

    componentWillUnmount() {
        this.context.admin.showLoadingIndicator = true
    }

    @computed get chartIds() {
        return SwitcherOptions.getRequiredChartIds(this.switcherCode)
    }

    @action.bound async fetchChartConfigs(chartIds: number[]) {
        const missing = chartIds.filter(id => !this.chartConfigs.has(id))
        if (!missing.length) return
        const response = await fetch(
            `/admin/api/charts/explorer-charts.json?chartIds=${chartIds.join(
                "~"
            )}`
        )
        const configs = await response.json()
        configs.forEach((config: any) =>
            this.chartConfigs.set(config.id, config)
        )
    }

    @observable chartConfigs: Map<number, ChartConfigProps> = new Map()

    hotTableComponent = React.createRef<HotTable>()

    @action.bound updateConfig() {
        const newVersion = this.hotTableComponent.current?.hotInstance.getData()
        if (newVersion) {
            const delimited = newVersion
                .map((row: any) =>
                    row
                        .map((cell: any) => (cell === null ? "" : cell))
                        .join(",")
                )
                .join("\n")
            if (this.switcherCode === delimited) return
            this.switcherCode = delimited
            this.switcher = new SwitcherOptions(this.switcherCode, "")
            this.fetchChartConfigs(this.chartIds)
        }
    }

    @observable switcherCode = defaultConfig
    switcher = new SwitcherOptions(this.switcherCode, "")

    @observable showEditor = true

    render() {
        const data = toJsTable(parseDelimited(this.switcherCode))
        return (
            <AdminLayout title="Create Explorer">
                <main>
                    <Draggable handle=".handle">
                        <div
                            className={classNames(
                                "ExplorerEditor",
                                this.showEditor ? "" : "HideEditor"
                            )}
                        >
                            <div className="handle">
                                &nbsp; <FontAwesomeIcon icon={faArrowsAlt} />
                                &nbsp; Explorer Editor{" "}
                                <span
                                    onClick={() =>
                                        (this.showEditor = !this.showEditor)
                                    }
                                >
                                    {this.showEditor ? "Minimize" : "Expand"}
                                </span>
                            </div>
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
                        </div>
                    </Draggable>
                    <SwitcherDataExplorer
                        chartConfigs={this.chartConfigs}
                        explorerNamespace="explorer"
                        explorerTitle="Data Explorer"
                        switcher={this.switcher}
                    />
                </main>
            </AdminLayout>
        )
    }
}
