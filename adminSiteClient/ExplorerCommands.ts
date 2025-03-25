import {
    ExplorerGrammar,
    ExplorerProgram,
    CellPosition,
} from "@ourworldindata/explorer"
import Handsontable from "handsontable"
import HotContextMenu from "handsontable/plugins/contextMenu"

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
    toHotCommand(): HotContextMenu.MenuItemConfig {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
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
        if (searchResults.length === 1) return `1 match of '${cell.contents}'`
        return `Select ${searchResults.length} matches of '${cell.contents}'`
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
                        number,
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
            tableSlugCell.contents
        )
        this.setProgramCallback!(newProgram.toString())
    }

    disabled() {
        return false
    }

    hidden(hot: Handsontable) {
        const cell = this.cell(hot)
        return cell
            ? cell.cellDef?.keyword !== ExplorerGrammar.table.keyword
            : true
    }
}
