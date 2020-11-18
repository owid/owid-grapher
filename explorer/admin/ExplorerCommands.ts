import { ExplorerRootKeywordMap } from "explorer/client/ExplorerGrammar"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import { CellPosition } from "explorer/gridLang/GridLangConstants"
import Handsontable from "handsontable"

abstract class HotCommand {
    protected program: ExplorerProgram
    protected setProgramCallback?: (newProgram: string) => void
    constructor(
        program: ExplorerProgram,
        setProgramCallback?: (newProgram: string) => void
    ) {
        this.program = program
        this.setProgramCallback = setProgramCallback
    }

    abstract name(hot: Handsontable): string
    abstract callback(hot: Handsontable): void
    abstract disabled(hot: Handsontable): boolean
    abstract hidden(hot: Handsontable): boolean

    protected selectedPosition(hot: Handsontable) {
        const coords = hot.getSelectedLast()
        if (!coords) return undefined
        return { row: coords[0], column: coords[1] } as CellPosition
    }

    protected cell(hot: Handsontable) {
        const pos = this.selectedPosition(hot)
        return pos ? this.program.getCell(pos) : undefined
    }

    protected searchResults(hot: Handsontable) {
        const pos = this.selectedPosition(hot)
        return pos ? this.program.findAll(pos) : []
    }

    // handles the "this" binding needed by HOT
    toHotCommand(): Handsontable.contextMenu.MenuItemConfig {
        const baseCommand = this
        return {
            name: function () {
                return baseCommand.name(this)
            },
            callback: function () {
                return baseCommand.callback(this)
            },
            disabled: function () {
                return baseCommand.disabled(this)
            },
            hidden: function () {
                return baseCommand.hidden(this)
            },
        }
    }
}

export class SelectAllHitsCommand extends HotCommand {
    name(hot: Handsontable) {
        const cell = this.cell(hot)
        if (!cell) return `Nothing selected`
        const searchResults = this.searchResults(hot)
        if (searchResults.length === 1) return `1 match of '${cell.value}'`
        return `Select ${searchResults.length} matches of '${cell.value}'`
    }

    callback(hot: Handsontable) {
        const searchResults = this.searchResults(hot)
        if (!searchResults.length) return
        hot.selectCells(
            searchResults.map(
                (pos) =>
                    [pos.row, pos.column, pos.row, pos.column] as [
                        number,
                        number,
                        number,
                        number
                    ]
            )
        )
    }

    hidden() {
        return false
    }

    disabled(hot: Handsontable) {
        return this.searchResults(hot).length < 2
    }
}

export class AutofillColDefCommand extends HotCommand {
    name() {
        return "⚡ Autofill missing column definitions"
    }
    commandName: keyof ExplorerProgram =
        "autofillMissingColumnDefinitionsForTableCommand"

    async callback(hot: Handsontable) {
        const selectedPosition = this.selectedPosition(hot)
        const { program, commandName } = this

        if (!selectedPosition) return
        const tableSlugCell = program.getCell({
            ...selectedPosition,
            column: selectedPosition.column + 1,
        })

        // todo: figure out typings. we need keyof ExplorerProgram but only if key is to a callable method.
        const newProgram = await (program as any)[commandName](
            tableSlugCell.value
        )
        this.setProgramCallback!(newProgram.toString())
    }

    disabled() {
        return false
    }

    hidden(hot: Handsontable) {
        const cell = this.cell(hot)
        return cell
            ? cell.cellDef?.keyword !== ExplorerRootKeywordMap.table.keyword
            : true
    }
}

export class InlineDataCommand extends AutofillColDefCommand {
    name() {
        return "⚡ Inline data and autofill columns"
    }
    commandName: keyof ExplorerProgram =
        "replaceTableWithInlineDataAndAutofilledColumnDefsCommand"
}
