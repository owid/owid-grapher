import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "admin/client/AdminLayout"
import {
    AdminAppContextType,
    AdminAppContext
} from "admin/client/AdminAppContext"
import { SwitcherDataExplorer } from "dataExplorer/client/SwitcherDataExplorer"
import { HotTable } from "@handsontable/react"
import { action, observable, computed, autorun } from "mobx"
import { ChartConfigProps } from "charts/ChartConfig"
import { JsTable } from "charts/Util"
import { DataExplorerProgram } from "dataExplorer/client/DataExplorerProgram"
import { readRemoteFile, writeRemoteFile } from "gitCms/client"
import { Prompt } from "react-router-dom"

@observer
export class ExplorerCreatePage extends React.Component<{ slug: string }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @action
    componentDidMount() {
        this.context.admin.loadingIndicatorSetting = "off"
        this.fetchDataExplorerProgramOnLoad()
        const win = window as any
        win.DataExplorerProgram = DataExplorerProgram
    }

    @action
    componentWillUnmount() {
        this.context.admin.loadingIndicatorSetting = "default"
    }

    @action.bound async fetchDataExplorerProgramOnLoad() {
        const content = await readRemoteFile({
            filepath: DataExplorerProgram.fullPath(this.props.slug)
        })
        this.sourceOnDisk = content
        this.setProgram(content)
    }

    @action.bound setProgram(code: string) {
        this.program = new DataExplorerProgram(this.program.slug, code)
        this.fetchChartConfigs(this.program.requiredChartIds)
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
        const newVersion = this.hotTableComponent.current?.hotInstance.getData() as JsTable
        if (newVersion) {
            const program = DataExplorerProgram.fromArrays(
                this.program.slug,
                newVersion
            )
            if (this.program.toString() === program.toString()) return
            this.setProgram(program.toString())
        }
    }

    @observable sourceOnDisk: string =
        DataExplorerProgram.defaultExplorerProgram

    @observable
    program: DataExplorerProgram = new DataExplorerProgram(
        this.props.slug,
        DataExplorerProgram.defaultExplorerProgram
    )

    @action.bound async saveExplorer() {
        const slug = prompt("Slug for this explorer", this.program.slug)
        if (!slug) return
        this.context.admin.loadingIndicatorSetting = "loading"
        this.program.slug = slug
        await writeRemoteFile({
            filepath: this.program.fullPath,
            content: this.program.toString()
        })
        this.context.admin.loadingIndicatorSetting = "off"
        this.sourceOnDisk = this.program.toString()
    }

    @computed get isModified(): boolean {
        return this.sourceOnDisk !== this.program.toString()
    }

    render() {
        const data = this.program.toArrays()
        return (
            <AdminLayout title="Create Explorer">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <main style={{ padding: 0, position: "relative" }}>
                    <div
                        style={{
                            right: "15px",
                            top: "5px",
                            position: "absolute",
                            zIndex: 2
                        }}
                    >
                        {this.isModified ? (
                            <button
                                className="btn btn-primary"
                                onClick={this.saveExplorer}
                            >
                                Save
                            </button>
                        ) : (
                            <button className="btn btn-secondary">
                                Unmodified
                            </button>
                        )}
                    </div>
                    <div style={{ height: "500px", overflow: "scroll" }}>
                        <SwitcherDataExplorer
                            chartConfigs={this.chartConfigs}
                            bindToWindow={false}
                            program={this.program}
                        />
                    </div>
                    <div>
                        <HotTable
                            data={data}
                            manualColumnResize={[150, 150]}
                            wordWrap={false}
                            colHeaders={false}
                            contextMenu={true}
                            allowInsertRow={true}
                            allowInsertColumn={true}
                            width="100%"
                            stretchH="all"
                            minCols={8}
                            minRows={20}
                            ref={this.hotTableComponent as any}
                            rowHeaders={true}
                            afterChange={() => this.updateConfig()}
                            licenseKey={"non-commercial-and-evaluation"}
                        />
                    </div>
                </main>
            </AdminLayout>
        )
    }
}
