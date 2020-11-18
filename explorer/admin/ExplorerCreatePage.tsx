import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "adminSite/client/AdminLayout"
import {
    AdminAppContextType,
    AdminAppContext,
} from "adminSite/client/AdminAppContext"
import { Explorer, ExplorerManager } from "explorer/client/Explorer"
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
import {
    DefaultNewExplorerSlug,
    ExplorersRouteGrapherConfigs,
    ExplorersRouteQueryParam,
} from "explorer/client/ExplorerConstants"
import {
    selectAllWithThisValue,
    makeTableContextMenuCommand,
} from "./ExplorerCommands"
import { isEmpty } from "explorer/gridLang/GrammarUtils"

const RESERVED_NAMES = [DefaultNewExplorerSlug, "index", "new", "create"] // don't allow authors to save explorers with these names, otherwise might create some annoying situations.
const UNSAVED_EXPLORER_DRAFT = "UNSAVED_EXPLORER_DRAFT"

@observer
export class ExplorerCreatePage
    extends React.Component<{
        slug: string
        gitCmsBranchName: string
    }>
    implements ExplorerManager {
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
        this.programOnDisk = new ExplorerProgram("", response.content ?? "")
        this.setProgram(this.draftIfAny ?? this.programOnDisk.toString())
        this.isReady = true
    }

    @action.bound private setProgram(code: string) {
        this.program = new ExplorerProgram(this.program.slug, code)
        this.fetchGrapherConfigs(this.program.requiredGrapherIds)

        this.saveDraft(code)
    }

    @action.bound private async fetchGrapherConfigs(grapherIds: number[]) {
        const missing = grapherIds.filter(
            (id) => !this.grapherConfigsMap.has(id)
        )
        if (!missing.length) return
        const response = await fetch(
            `/admin/api/${ExplorersRouteGrapherConfigs}?${ExplorersRouteQueryParam}=${grapherIds.join(
                "~"
            )}`
        )
        const configs = await response.json()
        configs.forEach((config: any) =>
            this.grapherConfigsMap.set(config.id, config)
        )
    }

    @observable private grapherConfigsMap: Map<
        number,
        GrapherInterface
    > = new Map()

    @computed get grapherConfigs() {
        return Array.from(this.grapherConfigsMap.values())
    }

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

    private saveDraft(code: string) {
        localStorage.setItem(UNSAVED_EXPLORER_DRAFT + this.program.slug, code)
    }

    get draftIfAny() {
        return localStorage.getItem(UNSAVED_EXPLORER_DRAFT + this.program.slug)
    }

    private clearDraft() {
        localStorage.removeItem(UNSAVED_EXPLORER_DRAFT + this.program.slug)
    }

    @observable.ref private programOnDisk = new ExplorerProgram("", "")

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
        this.programOnDisk = new ExplorerProgram("", this.program.toString())
        this.clearDraft()
        this.setProgram(this.programOnDisk.toString())
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

    @action.bound private clearChanges() {
        if (confirm("Are you sure you want to clear your local changes?"))
            this.setProgram(this.programOnDisk.toString())
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
        return this.programOnDisk.toString() !== this.program.toString()
    }

    @observable gitCmsBranchName = this.props.gitCmsBranchName

    private get hotSettings() {
        const { program, programOnDisk } = this
        const data = program.asArrays

        const { currentlySelectedGrapherRow } = program

        const cells = function (row: number, column: number) {
            const {
                comment,
                cssClasses,
                options,
                placeholder,
                value,
            } = program.getCell({ row, column })

            const diskValue = programOnDisk.getCellValue({ row, column })

            const cellProperties: Partial<Handsontable.CellProperties> = {}

            const allClasses = cssClasses?.slice() ?? []

            if (diskValue !== value) {
                if (value === "" && diskValue === undefined)
                    allClasses.push("cellCreated")
                else if (isEmpty(value)) allClasses.push("cellDeleted")
                else if (isEmpty(diskValue)) allClasses.push("cellCreated")
                else allClasses.push("cellChanged")
            }

            if (
                currentlySelectedGrapherRow &&
                currentlySelectedGrapherRow === row &&
                column
            )
                allClasses.push(`currentlySelectedGrapherRow`)

            cellProperties.className = allClasses.join(" ")
            cellProperties.comment = comment ? { value: comment } : undefined
            cellProperties.placeholder = placeholder

            if (options && options.length) {
                cellProperties.type = "autocomplete"
                cellProperties.source = options
            }

            return cellProperties
        }

        const hotSettings: Handsontable.GridSettings = {
            afterChange: () => this.updateProgramFromHot(),
            afterRemoveRow: () => this.updateProgramFromHot(),
            afterRemoveCol: () => this.updateProgramFromHot(),
            allowInsertColumn: false,
            allowInsertRow: true,
            autoRowSize: false,
            autoColumnSize: false,
            cells,
            colHeaders: true,
            comments: true,
            contextMenu: {
                items: {
                    autofillMissingColumnDefinitionsCommand: makeTableContextMenuCommand(
                        "⚡ Autofill missing column definitions",
                        "autofillMissingColumnDefinitionsForTableCommand",
                        program,
                        (newProgram) => this.setProgram(newProgram)
                    ),
                    replaceTableWithInlineDataAndAutofilledColumnDefsCommand: makeTableContextMenuCommand(
                        "⚡ Inline data and autofill columns",
                        "replaceTableWithInlineDataAndAutofilledColumnDefsCommand",
                        program,
                        (newProgram) => this.setProgram(newProgram)
                    ),
                    selectAllWithThisValue: selectAllWithThisValue(program),
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
            search: true,
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
                    message="Are you sure you want to leave? You have unsaved changes."
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
                        <br />
                        <button
                            className="btn btn-secondary"
                            onClick={this.clearChanges}
                        >
                            Clear changes
                        </button>
                    </div>
                    <div
                        style={{
                            height: "300px",
                            overflow: "scroll",
                            resize: "vertical",
                        }}
                    >
                        <Explorer
                            manager={this}
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
