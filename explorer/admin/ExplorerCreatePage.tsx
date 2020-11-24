import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "adminSite/client/AdminLayout"
import {
    AdminAppContextType,
    AdminAppContext,
} from "adminSite/client/AdminAppContext"
import { HotTable } from "@handsontable/react"
import { action, observable, computed } from "mobx"
import { ExplorerProgram, makeFullPath } from "explorer/client/ExplorerProgram"
import { readRemoteFile, writeRemoteFile } from "gitCms/GitCmsClient"
import { Prompt } from "react-router-dom"
import Handsontable from "handsontable"
import { CoreMatrix } from "coreTable/CoreTableConstants"
import { exposeInstanceOnWindow, slugify } from "grapher/utils/Util"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_PREVIEW_ROUTE,
    UNSAVED_EXPLORER_DRAFT,
    UNSAVED_EXPLORER_PREVIEW_PATCH,
} from "explorer/client/ExplorerConstants"
import {
    AutofillColDefCommand,
    InlineDataCommand,
    SelectAllHitsCommand,
} from "./ExplorerCommands"
import { isEmpty } from "explorer/gridLang/GrammarUtils"
import classNames from "classnames"

const RESERVED_NAMES = [DefaultNewExplorerSlug, "index", "new", "create"] // don't allow authors to save explorers with these names, otherwise might create some annoying situations.

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

        setInterval(() => {
            const patch = localStorage.getItem(
                `${UNSAVED_EXPLORER_PREVIEW_PATCH}${this.program.slug}`
            )
            if (patch) this.program.decisionMatrix.setValuesFromPatch(patch)
        }, 1000)
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
        this.saveDraft(code)
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
            `Create a slug (URL friendly name) for this explorer. Your new file will be pushed to the '${this.props.gitCmsBranchName}' branch on GitHub.`,
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
            `Enter a message describing this change. Your change will be pushed to the '${this.props.gitCmsBranchName}' on GitHub.`,
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
                optionKeywords,
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

            if (optionKeywords && optionKeywords.length) {
                cellProperties.type = "autocomplete"
                cellProperties.source = optionKeywords
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
                    AutofillColDefCommand: new AutofillColDefCommand(
                        program,
                        (newProgram: string) => this.setProgram(newProgram)
                    ).toHotCommand(),
                    InlineDataCommand: new InlineDataCommand(
                        program,
                        (newProgram: string) => this.setProgram(newProgram)
                    ).toHotCommand(),
                    SelectAllHitsCommand: new SelectAllHitsCommand(
                        program
                    ).toHotCommand(),
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
            height: "100%",
            manualColumnResize: true,
            manualRowMove: true,
            minCols: program.width + 3,
            minSpareCols: 2,
            minRows: 40,
            minSpareRows: 20,
            rowHeaders: true,
            search: true,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
        }

        return hotSettings
    }

    @action.bound private onSave() {
        if (this.program.isNewFile) this.saveAs()
        else if (this.isModified) this.save()
    }

    render() {
        if (!this.isReady)
            return (
                <AdminLayout title="Create Explorer">
                    {" "}
                    <LoadingIndicator />
                </AdminLayout>
            )

        const { program, isModified } = this
        const { isNewFile } = program

        const buttons = []

        buttons.push(
            <button
                key="save"
                disabled={!isModified && !isNewFile}
                className={classNames("btn", "btn-primary")}
                onClick={this.onSave}
                title="Saves file to disk, commits and pushes to GitHub"
            >
                Save
            </button>
        )

        buttons.push(
            <button
                key="saveAs"
                disabled={isNewFile}
                title={
                    isNewFile
                        ? "You need to save this file first."
                        : "Saves file to disk, commits and pushes to GitHub"
                }
                className={classNames("btn", "btn-secondary")}
                onClick={this.saveAs}
            >
                Save As
            </button>
        )

        buttons.push(
            <button
                key="preview"
                disabled={isNewFile}
                title={isNewFile ? "You need to save this file first." : ""}
                onClick={() =>
                    window.open(
                        `/admin/${EXPLORERS_PREVIEW_ROUTE}/${this.program.slug}`,
                        "_blank"
                    )
                }
                className={classNames(`btn`, "btn-secondary")}
            >
                Preview '{program.slug}'
            </button>
        )

        buttons.push(
            <button
                key="clear"
                disabled={!isModified}
                title={isModified ? "" : "No changes"}
                className={classNames("btn", "btn-secondary")}
                onClick={this.clearChanges}
            >
                Clear Changes
            </button>
        )

        const modifiedMessage = isModified
            ? "Are you sure you want to leave? You have unsaved changes."
            : "" // todo: provide an explanation of how many cells are modified.

        return (
            <AdminLayout title="Create Explorer">
                <Prompt when={isModified} message={modifiedMessage} />
                <main
                    style={{
                        padding: 0,
                        position: "relative",
                    }}
                >
                    <div className="ExplorerCreatePageButtons">{buttons}</div>
                    <HotTable
                        settings={this.hotSettings}
                        ref={this.hotTableComponent as any}
                        licenseKey={"non-commercial-and-evaluation"}
                    />
                </main>
            </AdminLayout>
        )
    }
}
