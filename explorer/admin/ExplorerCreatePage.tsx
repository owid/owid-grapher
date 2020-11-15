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
import { ExplorerProgram, makeFullPath } from "explorer/client/ExplorerProgram"
import { readRemoteFile, writeRemoteFile } from "gitCms/GitCmsClient"
import { Prompt } from "react-router-dom"
import { Link } from "adminSite/client/Link"
import Handsontable from "handsontable"
import { CoreMatrix } from "coreTable/CoreTableConstants"
import { exposeInstanceOnWindow, slugify } from "grapher/utils/Util"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { DefaultNewExplorerSlug } from "explorer/client/ExplorerConstants"

const RESERVED_NAMES = [DefaultNewExplorerSlug, "index"] // don't allow authors to save explorers with these names, otherwise might create some annoying situations.

@observer
export class ExplorerCreatePage extends React.Component<{
    slug: string
    gitCmsBranchName: string
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @action componentDidMount() {
        this.context.admin.loadingIndicatorSetting = "off"
        this.fetchExplorerProgramOnLoad()
        exposeInstanceOnWindow(this, "explorerEditor")
    }

    @observable isReady = false

    @action componentWillUnmount() {
        this.context.admin.loadingIndicatorSetting = "default"
    }

    @action.bound private async fetchExplorerProgramOnLoad() {
        const response = await readRemoteFile({
            filepath: makeFullPath(this.props.slug),
        })
        this.sourceOnDisk = response.content ?? ""
        this.setProgram(this.sourceOnDisk)
        this.isReady = true
    }

    @action.bound private setProgram(code: string) {
        this.program = new ExplorerProgram(this.program.slug, code)
        this.fetchGrapherConfigs(this.program.requiredGrapherIds)
    }

    @action.bound private async fetchGrapherConfigs(grapherIds: number[]) {
        const missing = grapherIds.filter((id) => !this.grapherConfigs.has(id))
        if (!missing.length) return
        const response = await fetch(
            `/admin/api/charts/explorer-charts.json?chartIds=${grapherIds.join(
                "~"
            )}`
        )
        const configs = await response.json()
        configs.forEach((config: any) =>
            this.grapherConfigs.set(config.id, config)
        )
    }

    @observable grapherConfigs: Map<number, GrapherInterface> = new Map()

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

    @observable sourceOnDisk = ""

    @observable.ref program = new ExplorerProgram(this.props.slug, "")

    @action.bound private async _save(slug: string, commitMessage: string) {
        this.context.admin.loadingIndicatorSetting = "loading"
        this.program.slug = slug
        await writeRemoteFile({
            filepath: this.program.fullPath,
            content: this.program.toString(),
            commitMessage,
        })
        this.context.admin.loadingIndicatorSetting = "off"
        this.sourceOnDisk = this.program.toString()
        this.setProgram(this.sourceOnDisk)
    }

    @action.bound private async saveAs() {
        const userSlug = prompt(
            "Create a slug (URL friendly name) for this explorer",
            this.program.slug
        )
        if (!userSlug) return
        const slug = slugify(userSlug)
        if (!slug) {
            alert(`'${slug}' is not a valid slug`)
            return
        }
        if (new Set(RESERVED_NAMES).has(slug.toLowerCase())) {
            alert(
                `Cannot save '${userSlug}' because that is one of the reserved names: ${RESERVED_NAMES.join(
                    ", "
                )}`
            )
            return
        }
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

    @observable gitCmsBranchName = this.props.gitCmsBranchName

    @action.bound private async autofillMissingColumnDefinitions(
        row: number,
        col: number
    ) {
        const tableSlugCell = this.program.getCell(row, col + 1)
        const newProgram = await this.program.autofillMissingColumnDefinitionsForTable(
            tableSlugCell.value
        )
        this.setProgram(newProgram.toString())
    }

    private get hotSettings() {
        const { program } = this
        const data = program.toArrays()

        const cells = function (row: number, column: number) {
            const {
                comment,
                cssClasses,
                options,
                placeholder,
            } = program.getCell(row, column)

            const cellProperties: Partial<Handsontable.CellProperties> = {}
            cellProperties.className = cssClasses?.length
                ? cssClasses.join(" ")
                : undefined
            cellProperties.comment = comment ? { value: comment } : undefined
            cellProperties.placeholder = placeholder

            if (options && options.length) {
                cellProperties.type = "autocomplete"
                cellProperties.source = options
            }

            return cellProperties
        }

        const that = this
        const hotSettings: Handsontable.GridSettings = {
            afterChange: () => this.updateProgramFromHot(),
            afterRemoveRow: () => this.updateProgramFromHot(),
            afterRemoveCol: () => this.updateProgramFromHot(),
            allowInsertColumn: false,
            allowInsertRow: true,
            autoColumnSize: false,
            cells,
            colHeaders: true,
            comments: true,
            contextMenu: {
                items: {
                    autofillMissingColumnDefinitions: {
                        name: "⚡ Autofill missing column definitions",
                        callback: function () {
                            const coordinates = this.getSelectedLast()
                            if (coordinates)
                                that.autofillMissingColumnDefinitions(
                                    coordinates[0],
                                    coordinates[1]
                                )
                        },
                        hidden: function () {
                            const coordinates = this.getSelectedLast()
                            if (coordinates === undefined) return true
                            const cell = program.getCell(
                                coordinates[0],
                                coordinates[1]
                            )
                            return cell.cellDef?.keyword !== "table"
                        },
                    },
                    sp0: { name: "---------" },
                    row_above: {},
                    row_below: {},
                    sp1: { name: "---------" },
                    remove_row: {},
                    remove_col: {},
                    sp2: { name: "---------" },
                    undo: {},
                    redo: {},
                    sp3: { name: "---------" },
                    copy: {},
                    cut: {},
                },
            },
            data,
            manualColumnResize: true,
            manualRowMove: true,
            minCols: program.width + 3,
            minSpareCols: 2,
            minRows: 20,
            minSpareRows: 20,
            rowHeaders: true,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
        }

        return hotSettings
    }

    render() {
        if (!this.isReady)
            return (
                <AdminLayout title="Create Explorer">
                    {" "}
                    <LoadingIndicator />
                </AdminLayout>
            )

        const { program } = this

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
                        {this.isModified || program.isNewFile ? (
                            <button
                                className="btn btn-primary"
                                onClick={() =>
                                    program.isNewFile
                                        ? this.saveAs()
                                        : this.save()
                                }
                                title="Saves file to disk, commits and pushes to GitHub"
                            >
                                {program.isNewFile ? `Save New File` : `Save`}{" "}
                                and Push to {this.props.gitCmsBranchName}
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
                            Save As and Push to {this.props.gitCmsBranchName}
                        </button>
                        <br />
                    </div>
                    <div style={{ height: "300px", overflow: "scroll" }}>
                        <Explorer
                            grapherConfigs={Object.values(this.grapherConfigs)}
                            explorerProgram={program}
                            /**
                             * This ensure a new Explorer is rendered everytime the code changes (more immutable/RAII this way).
                             *
                             * Perf isn't so critical here in the editor, and when guid changes that means we are changing the very code that makes this Explorer, so
                             * throwing out the old one and forcing React to re-render a completely new one is probably the right design anyway.
                             *
                             * We may want to revisit later but for now seems to work.
                             * */
                            key={program.guid}
                            program={""}
                            slug={""}
                        />
                    </div>
                    <div
                        style={{
                            height: "calc(100% - 300px)",
                            width: "100%",
                            overflow: "scroll",
                        }}
                    >
                        <HotTable
                            settings={this.hotSettings}
                            ref={this.hotTableComponent as any}
                            licenseKey={"non-commercial-and-evaluation"}
                        />
                    </div>
                </main>
            </AdminLayout>
        )
    }
}
