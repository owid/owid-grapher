import { HotTable, HotTableClass } from "@handsontable/react"
import { CoreMatrix } from "@ourworldindata/types"
import { LoadingIndicator } from "@ourworldindata/grapher"
import {
    exposeInstanceOnWindow,
    slugify,
    toRectangularMatrix,
} from "@ourworldindata/utils"
import classNames from "classnames"
import Handsontable from "handsontable"
import { registerAllModules } from "handsontable/registry"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Component, createRef } from "react"
import { Prompt } from "react-router-dom"
import {
    DefaultNewExplorerSlug,
    ExplorerChoiceParams,
    EXPLORERS_PREVIEW_ROUTE,
    UNSAVED_EXPLORER_DRAFT,
    UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS,
    ExplorerProgram,
    isEmpty,
} from "@ourworldindata/explorer"
import { AdminManager } from "./AdminManager.js"
import {
    AutofillColDefCommand,
    SelectAllHitsCommand,
} from "./ExplorerCommands.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ENV } from "../settings/clientSettings.js"

const RESERVED_NAMES = [DefaultNewExplorerSlug, "index", "new", "create"] // don't allow authors to save explorers with these names, otherwise might create some annoying situations.

// Register all Handsontable modules
registerAllModules()

@observer
export class ExplorerCreatePage extends Component<{
    slug: string
    manager?: AdminManager
}> {
    static contextType = AdminAppContext
    declare context: AdminAppContextType
    disposers: Array<() => void> = []

    @observable showPreview: boolean = true

    constructor(props: { slug: string; manager?: AdminManager }) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager() {
        return this.props.manager ?? {}
    }

    @action.bound private loadingModalOff() {
        this.manager.loadingIndicatorSetting = "off"
    }

    @action.bound private loadingModalOn() {
        this.manager.loadingIndicatorSetting = "loading"
    }

    @action.bound private resetLoadingModal() {
        this.manager.loadingIndicatorSetting = "default"
    }

    @action componentDidMount() {
        this.loadingModalOff()
        exposeInstanceOnWindow(this, "explorerEditor")

        void this.fetchExplorerProgramOnLoad()
        this.startPollingLocalStorageForPreviewChanges()
    }

    @action.bound private startPollingLocalStorageForPreviewChanges() {
        const intervalId = setInterval(() => {
            const savedQueryParamsJSON = localStorage.getItem(
                `${UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS}${this.program.slug}`
            )
            if (typeof savedQueryParamsJSON === "string")
                this.program.decisionMatrix.setValuesFromChoiceParams(
                    JSON.parse(savedQueryParamsJSON) as ExplorerChoiceParams
                )
        }, 1000)
        this.disposers.push(() => clearInterval(intervalId))
    }

    @observable isReady = false

    @action componentWillUnmount() {
        this.resetLoadingModal()
        this.disposers.forEach((disposer) => disposer())
    }

    @action.bound private async fetchExplorerProgramOnLoad() {
        const { slug } = this.props

        let response
        if (slug === "new") {
            response = { tsv: "" }
        } else {
            response = await this.context.admin.requestJSON(
                `/api/explorers/${slug}`,
                {},
                "GET"
            )
        }

        this.programOnDisk = new ExplorerProgram("", response.tsv ?? "")
        this.setProgram(this.draftIfAny ?? this.programOnDisk.toString())
        this.isReady = true
        if (this.isModified)
            alert(
                `Your browser has a changed draft of '${slug}'. If you want to clear your local changes, click the "Clear Changes" button in the top right.`
            )
    }

    @action.bound private setProgram(code: string) {
        this.program = new ExplorerProgram(this.program.slug, code)
        this.saveDraft(code)
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

    @observable.ref private program = new ExplorerProgram(this.props.slug, "")

    @action.bound private async _save(slug: string, commitMessage: string) {
        this.loadingModalOn()
        this.program.slug = slug

        // Call the API to save the explorer
        const res = await this.context.admin.requestJSON(
            `/api/explorers/${this.program.slug}`,
            {
                tsv: this.program.toString(),
                commitMessage,
            },
            "PUT"
        )

        if (!res.success) {
            alert(`Saving the explorer failed!\n\n${res.error}`)
            return
        }

        this.loadingModalOff()
        this.programOnDisk = new ExplorerProgram("", this.program.toString())
        this.setProgram(this.programOnDisk.toString())
        this.clearDraft()
    }

    @action.bound private async saveAs() {
        const userSlug = prompt(
            `Create a slug (URL friendly name) for this explorer.`,
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
        if (!confirm("Are you sure you want to clear your local changes?"))
            return

        this.setProgram(this.programOnDisk.toString())
        this.clearDraft()
    }

    @action.bound private async save() {
        let commitMessage
        if (ENV !== "development") {
            commitMessage = prompt(
                `Enter a message describing this change.`,
                `Updated ${this.program.slug}`
            )
            if (!commitMessage) return
        } else {
            // will not get committed
            commitMessage = "Dummy message"
        }
        await this._save(this.program.slug, commitMessage)
    }

    @computed get isModified() {
        return this.programOnDisk.toString() !== this.program.toString()
    }

    @computed get whyIsExplorerProgramInvalid() {
        return this.program.whyIsExplorerProgramInvalid
    }

    @action.bound private onSave() {
        if (this.program.isNewFile) void this.saveAs()
        else if (this.isModified) void this.save()
    }

    @action.bound private onShowPreviewChanged() {
        this.showPreview = !this.showPreview
    }

    render() {
        if (!this.isReady) return <LoadingIndicator />

        const { program, isModified, whyIsExplorerProgramInvalid } = this
        const { isNewFile, slug } = program
        const previewLink = `/admin/${EXPLORERS_PREVIEW_ROUTE}/${slug}`

        const buttons = []

        buttons.push(
            <button
                key="save"
                disabled={!isModified && !isNewFile}
                className={classNames("btn", "btn-primary")}
                onClick={this.onSave}
                title="Saves explorer"
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
                        : "Saves as a new explorer"
                }
                className={classNames("btn", "btn-secondary")}
                onClick={this.saveAs}
            >
                Save As
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

        const showPreviewCheckbox = (
            <div className="form-check">
                <input
                    type="checkbox"
                    className="form-check-input"
                    id="showPreview"
                    checked={this.showPreview}
                    onChange={() => this.onShowPreviewChanged()}
                ></input>
                <label className="form-check-label" htmlFor="showPreview">
                    Show Preview
                </label>
            </div>
        )

        return (
            <>
                <Prompt when={isModified} message={modifiedMessage} />
                <main
                    style={{
                        padding: 0,
                        position: "relative",
                    }}
                >
                    <div className="ExplorerCreatePageHeader">
                        {showPreviewCheckbox}
                        <div style={{ textAlign: "right" }}>{buttons}</div>
                    </div>
                    <HotEditor
                        onChange={this.setProgram}
                        program={program}
                        programOnDisk={this.programOnDisk}
                    />
                    {this.showPreview && (
                        <PictureInPicture previewLink={previewLink} />
                    )}
                    <a className="PreviewLink" href={previewLink}>
                        Visit preview
                    </a>
                    {whyIsExplorerProgramInvalid && (
                        <div className="WhyIsExplorerProgramInvalid">
                            {whyIsExplorerProgramInvalid}
                        </div>
                    )}
                </main>
            </>
        )
    }
}

class HotEditor extends Component<{
    onChange: (code: string) => void
    program: ExplorerProgram
    programOnDisk: ExplorerProgram
}> {
    private hotTableComponent = createRef<HotTableClass>()

    constructor(props: {
        onChange: (code: string) => void
        program: ExplorerProgram
        programOnDisk: ExplorerProgram
    }) {
        super(props)
        makeObservable(this)
    }

    @computed private get program() {
        return this.props.program
    }

    @computed private get programOnDisk() {
        return this.props.programOnDisk
    }

    @action.bound private updateProgramFromHot() {
        const newVersion =
            this.hotTableComponent.current?.hotInstance?.getData() as CoreMatrix
        if (!newVersion) return

        const newProgram = ExplorerProgram.fromMatrix(
            this.program.slug,
            newVersion
        )
        if (this.program.toString() === newProgram.toString()) return
        this.props.onChange(newProgram.toString())
    }

    private get hotSettings() {
        const { program, programOnDisk } = this

        // replace literal `\n` with newlines
        const data = program.lines.map((row) =>
            row.map((cell) => cell.replace(/\\n/g, "\n"))
        )

        const { currentlySelectedGrapherRow } = program

        const cells = function (row: number, column: number) {
            const {
                comment,
                cssClasses,
                optionKeywords,
                placeholder,
                contents,
            } = program.getCell({ row, column })

            const cellContentsOnDisk = programOnDisk.getCellContents({
                row,
                column,
            })

            const cellProperties: Partial<Handsontable.CellProperties> = {}

            const allClasses = cssClasses?.slice() ?? []

            if (cellContentsOnDisk !== contents) {
                if (contents === "" && cellContentsOnDisk === undefined)
                    allClasses.push("cellCreated")
                else if (isEmpty(contents)) allClasses.push("cellDeleted")
                else if (isEmpty(cellContentsOnDisk))
                    allClasses.push("cellCreated")
                else allClasses.push("cellChanged")
            }

            if (currentlySelectedGrapherRow === row && column)
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
                        (newProgram: string) => this.props.onChange(newProgram)
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
            data: toRectangularMatrix(data, undefined),
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

    render() {
        return (
            <HotTable
                settings={this.hotSettings}
                ref={this.hotTableComponent}
                licenseKey={"non-commercial-and-evaluation"}
            />
        )
    }
}

class PictureInPicture extends Component<{
    previewLink: string
}> {
    render() {
        return (
            <iframe
                src={this.props.previewLink}
                className="ExplorerPipPreview"
            />
        )
    }
}
