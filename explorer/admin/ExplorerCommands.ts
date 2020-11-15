import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import Handsontable from "handsontable"

export const autofillMissingColumnDefinitionsCommand = (
    program: ExplorerProgram,
    callback: (newProgram: string) => void
) => {
    const command: Handsontable.contextMenu.MenuItemConfig = {
        name: "⚡ Autofill missing column definitions",
        callback: async function () {
            const coordinates = this.getSelectedLast()
            if (!coordinates) return
            const tableSlugCell = program.getCell(
                coordinates[0],
                coordinates[1] + 1
            )
            const newProgram = await program.autofillMissingColumnDefinitionsForTable(
                tableSlugCell.value
            )
            callback(newProgram.toString())
        },
        hidden: function () {
            const coordinates = this.getSelectedLast()
            if (coordinates === undefined) return true
            const cell = program.getCell(coordinates[0], coordinates[1])
            return cell.cellDef?.keyword !== "table"
        },
    }
    return command
}
