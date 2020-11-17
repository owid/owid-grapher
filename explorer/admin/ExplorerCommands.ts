import { ExplorerRootKeywordMap } from "explorer/client/ExplorerGrammar"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import Handsontable from "handsontable"

export const makeTableContextMenuCommand = (
    name: string,
    commandName:
        | "autofillMissingColumnDefinitionsForTableCommand"
        | "replaceTableWithInlineDataAndAutofilledColumnDefsCommand",
    program: ExplorerProgram,
    callback: (newProgram: string) => void
) => {
    const command: Handsontable.contextMenu.MenuItemConfig = {
        name,
        callback: async function () {
            const coordinates = this.getSelectedLast()
            if (!coordinates) return
            const tableSlugCell = program.getCell({
                row: coordinates[0],
                column: coordinates[1] + 1,
            })
            const newProgram = await program[commandName](tableSlugCell.value)
            callback(newProgram.toString())
        },
        hidden: function () {
            const coordinates = this.getSelectedLast()
            if (coordinates === undefined) return true
            const cell = program.getCell({
                row: coordinates[0],
                column: coordinates[1],
            })
            return (
                cell.cellDef?.keyword !== ExplorerRootKeywordMap.table.keyword
            )
        },
    }
    return command
}

export const selectAllWithThisValue = (program: ExplorerProgram) => {
    const command: Handsontable.contextMenu.MenuItemConfig = {
        name: function () {
            const coords = this.getSelectedLast()
            if (!coords) return `Nothing selected`
            const pos = { row: coords[0], column: coords[1] }
            const next = program.findAll(pos)
            const cell = program.getCell(pos)
            if (next.length === 1) return `1 match of '${cell.value}'`
            return `Select ${next.length} matches of '${cell.value}'`
        },
        callback: function () {
            const coords = this.getSelectedLast()
            if (!coords) return
            const next = program.findAll({ row: coords[0], column: coords[1] })
            if (!next.length) return
            this.selectCells(
                next.map((pos) => [pos.row, pos.column, pos.row, pos.column])
            )
        },
        disabled: function () {
            const coords = this.getSelectedLast()
            if (!coords) return true
            const cell = { row: coords[0], column: coords[1] }
            const next = program.findNext(cell)
            if (!next) return true
            return next.column === cell.column && next.row === cell.row
        },
    }
    return command
}
