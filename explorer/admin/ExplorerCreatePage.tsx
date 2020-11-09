import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "adminSite/client/AdminLayout"
import {
    AdminAppContextType,
    AdminAppContext,
} from "adminSite/client/AdminAppContext"
import { Explorer } from "explorer/client/Explorer"
import { HotTable } from "@handsontable/react"
import { action, observable, computed } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import {
    ExplorerProgram,
    ExplorerKeywordList,
} from "explorer/client/ExplorerProgram"
import { DefaultExplorerProgram } from "explorer/client/DefaultExplorerProgram"
import { readRemoteFile, writeRemoteFile } from "gitCms/client"
import { Prompt } from "react-router-dom"
import { Link } from "adminSite/client/Link"
import Handsontable from "handsontable"
import { CoreMatrix } from "coreTable/CoreTableConstants"
import { exposeInstanceOnWindow } from "grapher/utils/Util"

@observer
export class ExplorerCreatePage extends React.Component<{ slug: string }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @action componentDidMount() {
        this.context.admin.loadingIndicatorSetting = "off"
        this.fetchExplorerProgramOnLoad()
        exposeInstanceOnWindow(this, "explorerEditor")
    }

    @action componentWillUnmount() {
        this.context.admin.loadingIndicatorSetting = "default"
    }

    @action.bound private async fetchExplorerProgramOnLoad() {
        const response = await readRemoteFile({
            filepath: ExplorerProgram.fullPath(this.props.slug),
        })
        this.sourceOnDisk = response.content || DefaultExplorerProgram
        this.setProgram(this.sourceOnDisk)
    }

    @action.bound private setProgram(code: string) {
        this.program = new ExplorerProgram(this.program.slug, code)
        this.fetchChartConfigs(this.program.requiredChartIds)
    }

    @action.bound private async fetchChartConfigs(chartIds: number[]) {
        const missing = chartIds.filter((id) => !this.chartConfigs.has(id))
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

    @observable chartConfigs: Map<number, GrapherInterface> = new Map()

    hotTableComponent = React.createRef<HotTable>()

    @action.bound private updateProgramFromHot() {
        const newVersion = this.hotTableComponent.current?.hotInstance.getData() as CoreMatrix
        if (!newVersion) return

        const newProgram = ExplorerProgram.fromMatrix(
            this.program.slug,
            newVersion
        )
        if (this.program.toString() === newProgram.toString()) return
        this.setProgram(newProgram.toString())
    }

    @observable sourceOnDisk = DefaultExplorerProgram

    @observable.ref program = new ExplorerProgram(this.props.slug, "")

    private async _save(slug: string, commitMessage: string) {
        this.context.admin.loadingIndicatorSetting = "loading"
        this.program.slug = slug
        await writeRemoteFile({
            filepath: this.program.fullPath,
            content: this.program.toString(),
            commitMessage,
        })
        this.context.admin.loadingIndicatorSetting = "off"
        this.sourceOnDisk = this.program.toString()
    }

    @action.bound private async saveAs() {
        const slug = prompt(
            "Create a slug (URL friendly name) for this explorer",
            this.program.slug
        )
        if (!slug) return
        await this._save(slug, `Saving ${this.program.slug} as ${slug}`)
        window.location.href = slug
    }

    @action.bound private async save() {
        const commitMessage = prompt(
            "Enter a message describing this change",
            `Updated ${this.program.slug}`
        )
        if (!commitMessage) return
        await this._save(this.program.slug, commitMessage)
    }

    @computed get isModified() {
        return this.sourceOnDisk !== this.program.toString()
    }

    render() {
        const { program } = this
        const data = program.toArrays()

        // Highlight the active view
        const activeViewRowNumber =
            program.getKeywordIndex(ExplorerKeywordList.switcher) +
            program.decisionMatrix.selectedRowIndex +
            3

        const cells = function (row: number, column: number) {
            const cellProperties: Partial<Handsontable.CellProperties> = {}
            const cellParseResults = program.getCell(row, column)

            if (cellParseResults.options.length) {
                cellProperties.type = "autocomplete"
                cellProperties.source = cellParseResults.options
                cellProperties.className = cellParseResults.cssClasses.length
                    ? cellParseResults.cssClasses.join(" ")
                    : undefined
                const comment = cellParseResults.comment
                cellProperties.comment = comment
                    ? { value: comment }
                    : undefined
            }

            return cellProperties
        }

        const hotSettings: Handsontable.GridSettings = {
            afterChange: () => this.updateProgramFromHot(),
            allowInsertColumn: false,
            allowInsertRow: true,
            autoColumnSize: false,
            cells,
            colHeaders: true,
            comments: true,
            contextMenu: true,
            data,
            minCols: program.width + 3,
            minSpareCols: 2,
            minRows: 20,
            minSpareRows: 20,
            rowHeaders: true,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
        }

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
                            zIndex: 2,
                        }}
                    >
                        {this.isModified ? (
                            <button
                                className="btn btn-primary"
                                onClick={() =>
                                    program.isNewFile
                                        ? this.saveAs()
                                        : this.save()
                                }
                                title="Saves file to disk, commits and pushes to GitHub"
                            >
                                Save
                            </button>
                        ) : (
                            <button className="btn btn-secondary">
                                Unmodified
                            </button>
                        )}
                        <br />
                        <br />
                        <Link
                            target="preview"
                            to={`/explorers/preview/${program.slug}`}
                            className="btn btn-secondary"
                        >
                            Preview
                        </Link>
                        &nbsp;
                        <button
                            className="btn btn-secondary"
                            onClick={this.saveAs}
                            title="Saves file to disk, commits and pushes to GitHub"
                        >
                            Save as
                        </button>
                    </div>
                    <div style={{ height: "400px", overflow: "scroll" }}>
                        <Explorer
                            chartConfigs={Object.values(this.chartConfigs)}
                            explorerProgram={program}
                            explorerProgramCode={""}
                            slug={""}
                        />
                    </div>
                    <div
                        style={{
                            height: "calc(100% - 400px)",
                            width: "100%",
                            overflow: "scroll",
                        }}
                    >
                        <HotTable
                            settings={hotSettings}
                            ref={this.hotTableComponent as any}
                            licenseKey={"non-commercial-and-evaluation"}
                        />
                    </div>
                </main>
            </AdminLayout>
        )
    }
}
